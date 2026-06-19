import type {
  AgentNodeData,
  McpServerConfig,
  Message,
  NodeTrace,
  ProviderId,
  ToolCall,
  TraceToolCall,
  ToolDef,
} from '../types';
import { getProvider } from '../providers/registry';
import { loadLocalMcpTools, type LoadedMcp } from '../mcp/loader';
import { getWorkflowFsTools, type BuiltinTools } from './builtinTools';
import { getCodeTools } from './codeTools';
import { buildRagContext } from '../rag/store';
import i18n from '../i18n';

export interface DelegateTarget {
  /** Display name shown to the model and used to match `delegate(name, ...)`. */
  name: string;
  /** Short description shown to the model so it can pick the right person. */
  description: string;
  /** Run the subordinate with `task` as its input, return its final output. */
  run: (task: string) => Promise<string>;
}

export interface RunAgentOpts {
  agent: AgentNodeData;
  systemPrompt: string;
  /** Initial user message (caller already templated it). */
  userMessage: string;
  /** Prior conversation if any (excludes the new userMessage). */
  history?: Message[];
  signal: AbortSignal;
  /** Per-token callback — fired for both model text deltas AND inlined
   *  tool-call / tool-result decorations. */
  onDelta?: (delta: string) => void;
  /** Cap tool-use rounds to prevent runaway loops. */
  maxToolRounds?: number;
  /** When set, builtin filesystem tools scoped to this workflow are exposed
   *  to the agent (fs_list / fs_read / fs_write / fs_delete). */
  workflowId?: string;
  /** Current node id, used to retrieve this AI's private RAG knowledge. */
  agentNodeId?: string;
  /** Extra text included in automatic RAG retrieval queries. */
  ragQueryContext?: string;
  /** Subordinates this agent can dispatch via the `delegate` tool. */
  delegates?: DelegateTarget[];
}

export interface RunAgentResult {
  /** Final assistant text after all tool loops. */
  text: string;
  toolRounds: number;
  /** What was actually sent to the model + tool calls made, for the inspector. */
  trace: NodeTrace;
}

const PROVIDERS_WITH_TOOL_SUPPORT: ReadonlySet<ProviderId> = new Set<ProviderId>([
  'openai',
  'openrouter',
  'lmstudio',
  'anthropic',
]);

const SYSTEM_PROMPT_CONTEXT_LIMIT = 24_000;
const KB_INLINE_CONTEXT_LIMIT = 8_000;
const KB_INDEX_CONTEXT_LIMIT = 6_000;
const KB_READ_CONTEXT_LIMIT = 8_000;
const USER_MESSAGE_CONTEXT_LIMIT = 40_000;
const HISTORY_MESSAGE_COUNT_LIMIT = 8;
const HISTORY_MESSAGE_CONTEXT_LIMIT = 8_000;
const ASSISTANT_MESSAGE_CONTEXT_LIMIT = 8_000;
const TOOL_ARGUMENT_CONTEXT_LIMIT = 4_000;
const TOOL_ARGUMENT_DISPLAY_LIMIT = 2_000;
const TOOL_RESULT_CONTEXT_LIMIT = 8_000;
const TOOL_RESULT_DISPLAY_LIMIT = 8_000;
const RAG_QUERY_CONTEXT_LIMIT = 16_000;
const REQUEST_MESSAGES_CONTEXT_LIMIT = 70_000;

export async function runAgent(opts: RunAgentOpts): Promise<RunAgentResult> {
  const { agent, systemPrompt, userMessage, signal, onDelta } = opts;
  const maxToolRounds = opts.maxToolRounds ?? 8;

  const provider = getProvider(agent.provider);
  const supportsTools = PROVIDERS_WITH_TOOL_SUPPORT.has(agent.provider);
  if (!supportsTools && opts.workflowId) {
    onDelta?.(i18n.t('tools.noToolSupport', { provider: agent.provider }));
  }

  // Load local MCP servers if this provider supports tool calling.
  const localServers: McpServerConfig[] =
    supportsTools
      ? (agent.mcpServers ?? []).filter(
          (s) => s.enabled && s.url && (s.transport ?? 'remote') === 'local'
        )
      : [];

  let loaded: LoadedMcp | null = null;
  if (localServers.length > 0) {
    loaded = await loadLocalMcpTools(localServers);
    for (const err of loaded.errors) {
      onDelta?.(i18n.t('tools.mcpConnectFail', { server: err.serverName, msg: err.message }));
    }
  }

  // Builtin tools (when the provider supports tool calling): per-workflow fs
  // ops (need a workflowId) + the code-execution sandbox (always available).
  const builtinGroups: BuiltinTools[] = [
    ...(supportsTools && opts.workflowId ? [getWorkflowFsTools(opts.workflowId)] : []),
    ...(supportsTools ? [getCodeTools()] : []),
  ];
  const builtins: BuiltinTools | null = builtinGroups.length
    ? {
        tools: builtinGroups.flatMap((g) => g.tools),
        handlers: new Map(builtinGroups.flatMap((g) => [...g.handlers])),
      }
    : null;
  const hasFsTools = supportsTools && !!opts.workflowId;

  // Delegation tools — exposed when the agent has subordinates declared
  // via `manage` edges. The model can call them in any order, multiple
  // times, or not at all.
  const delegationTools: ToolDef[] = [];
  const delegationHandlers = new Map<string, (args: unknown) => Promise<string>>();
  if (supportsTools && opts.delegates && opts.delegates.length > 0) {
    const team = opts.delegates;
    const enumNames = team.map((d) => d.name);
    const memberList = team
      .map((d) => `- ${d.name}: ${d.description || i18n.t('tools.noDesc')}`)
      .join('\n');

    delegationTools.push({
      name: 'list_team',
      description: i18n.t('tools.listTeamDesc', { members: memberList }),
      inputSchema: { type: 'object', properties: {} },
    });
    delegationTools.push({
      name: 'delegate',
      description: i18n.t('tools.delegateDesc'),
      inputSchema: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            enum: enumNames,
            description: i18n.t('tools.delegateNameDesc'),
          },
          task: {
            type: 'string',
            description: i18n.t('tools.delegateTaskDesc'),
          },
        },
        required: ['name', 'task'],
      },
    });

    delegationHandlers.set('list_team', async () => memberList);
    delegationHandlers.set('delegate', async (raw) => {
      const args = (raw ?? {}) as { name?: string; task?: string };
      if (!args.name) return i18n.t('tools.errMissingName');
      if (!args.task) return i18n.t('tools.errMissingTask');
      const target = team.find((d) => d.name === args.name);
      if (!target) {
        return i18n.t('tools.errNoSubordinate', {
          name: args.name,
          available: enumNames.join(', '),
        });
      }
      return await target.run(args.task);
    });
  }

  // Per-agent private knowledge base.
  const kbInline = (agent.knowledge?.inline ?? '').trim();
  const kbFiles = agent.knowledge?.files ?? [];

  const kbTools: ToolDef[] = [];
  const kbHandlers = new Map<string, (args: unknown) => Promise<string>>();
  if (supportsTools && kbFiles.length > 0) {
    const indexSummary = limitTextForContext(
      kbFiles
        .map((f) =>
          i18n.t('tools.kbFileEntry', {
            name: f.name,
            chars: f.content.length,
            firstLine: firstLine(f.content) || i18n.t('common.empty'),
          })
        )
        .join('\n'),
      KB_INDEX_CONTEXT_LIMIT,
      i18n.t('tools.kbIndexLabel')
    );

    kbTools.push({
      name: 'kb_list',
      description: i18n.t('tools.kbListDesc'),
      inputSchema: { type: 'object', properties: {} },
    });
    kbTools.push({
      name: 'kb_read',
      description: i18n.t('tools.kbReadDesc'),
      inputSchema: {
        type: 'object',
        properties: {
          name: { type: 'string', description: i18n.t('tools.kbReadNameDesc') },
        },
        required: ['name'],
      },
    });
    kbTools.push({
      name: 'kb_search',
      description: i18n.t('tools.kbSearchDesc'),
      inputSchema: {
        type: 'object',
        properties: {
          query: { type: 'string', description: i18n.t('tools.kbSearchQueryDesc') },
          max_hits: { type: 'number', description: i18n.t('tools.kbSearchMaxDesc') },
        },
        required: ['query'],
      },
    });

    kbHandlers.set('kb_list', async () => indexSummary || i18n.t('tools.kbEmpty'));
    kbHandlers.set('kb_read', async (raw) => {
      const { name } = (raw ?? {}) as { name?: string };
      if (!name) return i18n.t('tools.errMissingName');
      const file = kbFiles.find((f) => f.name === name);
      return file
        ? limitTextForContext(
            file.content,
            KB_READ_CONTEXT_LIMIT,
            i18n.t('tools.kbFileLabel', { name: file.name })
          )
        : i18n.t('tools.kbNoFile', { name, index: indexSummary });
    });
    kbHandlers.set('kb_search', async (raw) => {
      const { query, max_hits = 5 } = (raw ?? {}) as {
        query?: string;
        max_hits?: number;
      };
      if (!query) return i18n.t('tools.errMissingQuery');
      const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
      if (terms.length === 0) return i18n.t('tools.errEmptyQuery');
      const hits: string[] = [];
      for (const f of kbFiles) {
        const lower = f.content.toLowerCase();
        const positions: number[] = [];
        for (const t of terms) {
          let i = 0;
          while ((i = lower.indexOf(t, i)) !== -1) {
            positions.push(i);
            i += t.length;
          }
        }
        if (positions.length === 0) continue;
        positions.sort((a, b) => a - b);
        const snippets = positions.slice(0, 3).map((p) => {
          const start = Math.max(0, p - 80);
          const end = Math.min(f.content.length, p + 160);
          const head = start > 0 ? '…' : '';
          const tail = end < f.content.length ? '…' : '';
          return head + f.content.slice(start, end) + tail;
        });
        hits.push(
          `${i18n.t('tools.kbHitHeader', { name: f.name, count: positions.length })}\n${snippets.join('\n---\n')}`
        );
        if (hits.length >= max_hits) break;
      }
      return hits.length > 0 ? hits.join('\n\n') : i18n.t('tools.kbNoHit');
    });
  }

  const allTools = [
    ...(builtins?.tools ?? []),
    ...delegationTools,
    ...kbTools,
    ...(loaded?.tools ?? []),
  ];

  const ragQuery = buildRetrievalQuery(
    userMessage,
    opts.ragQueryContext,
    opts.history
  );
  const ragContext = await buildRagContext(
    opts.workflowId,
    opts.agentNodeId,
    ragQuery
  );

  const safeSystemPrompt = limitTextForContext(
    systemPrompt,
    SYSTEM_PROMPT_CONTEXT_LIMIT,
    i18n.t('tools.labelSystemPrompt')
  );
  const safeKbInline = kbInline
    ? limitTextForContext(kbInline, KB_INLINE_CONTEXT_LIMIT, i18n.t('tools.labelKbInline'))
    : '';
  const safeHistory = prepareHistoryMessages(opts.history ?? []);
  const safeUserMessage = limitTextForContext(
    userMessage,
    USER_MESSAGE_CONTEXT_LIMIT,
    i18n.t('tools.labelUserMessage')
  );
  const originalHistory = opts.history ?? [];
  const recentOriginalHistory = originalHistory.slice(-HISTORY_MESSAGE_COUNT_LIMIT);
  const wasTrimmed =
    safeSystemPrompt !== systemPrompt ||
    safeKbInline !== kbInline ||
    safeUserMessage !== userMessage ||
    safeHistory.length !== originalHistory.length ||
    safeHistory.some((m, idx) => m.content !== recentOriginalHistory[idx]?.content);
  if (wasTrimmed) {
    onDelta?.(i18n.t('tools.contextTrimmed'));
  }

  const finalSystemPrompt = [
    safeSystemPrompt,
    safeKbInline ? `${i18n.t('tools.kbInlineHeader')}\n\n${safeKbInline}` : '',
    ragContext,
    hasFsTools ? i18n.t('tools.fsInstructions') : '',
  ]
    .filter(Boolean)
    .join('\n\n');

  const messages: Message[] = [
    ...safeHistory,
    { role: 'user', content: safeUserMessage },
  ];

  // Captured for the run inspector — what the model actually saw + did.
  const traceToolCalls: TraceToolCall[] = [];
  const makeResult = (text: string, rounds: number): RunAgentResult => ({
    text,
    toolRounds: rounds,
    trace: {
      provider: agent.provider,
      model: agent.model,
      systemPrompt: finalSystemPrompt,
      userMessage: safeUserMessage,
      ragQuery,
      ragInjected: !!ragContext,
      toolsOffered: allTools.map((t) => t.name),
      toolCalls: traceToolCalls,
      trimmed: wasTrimmed,
    },
  });

  let finalText = '';
  let toolRounds = 0;
  try {
    while (true) {
      if (signal.aborted) throw new DOMException('aborted', 'AbortError');

      let turnText = '';
      const turnToolCalls: ToolCall[] = [];
      let finish: 'stop' | 'tool_use' | 'length' | 'other' = 'stop';

      for await (const chunk of provider.stream({
        model: agent.model,
        systemPrompt: finalSystemPrompt,
        messages: prepareMessagesForRequest(messages),
        temperature: agent.temperature,
        maxTokens: agent.maxTokens,
        mcpServers: agent.mcpServers, // honored only by Anthropic (remote)
        tools: allTools.length ? allTools : undefined,
        signal,
      })) {
        if (chunk.delta) {
          turnText += chunk.delta;
          onDelta?.(chunk.delta);
        }
        if (chunk.toolCall) {
          turnToolCalls.push(chunk.toolCall);
        }
        if (chunk.done && chunk.finishReason) {
          finish = chunk.finishReason;
        }
      }

      finalText = turnText;

      if (
        turnToolCalls.length === 0 ||
        finish !== 'tool_use' ||
        (!loaded && !builtins && delegationTools.length === 0 && kbTools.length === 0)
      ) {
        return makeResult(finalText, toolRounds);
      }

      // Persist the assistant turn (text + tool_calls) before executing.
      messages.push({
        role: 'assistant',
        content: limitTextForContext(
          turnText,
          ASSISTANT_MESSAGE_CONTEXT_LIMIT,
          i18n.t('tools.labelAssistantPreTool')
        ),
        toolCalls: turnToolCalls.map(limitToolCallForContext),
      });

      toolRounds += 1;
      if (toolRounds > maxToolRounds) {
        onDelta?.(i18n.t('tools.maxToolRounds', { max: maxToolRounds }));
        return makeResult(finalText, toolRounds);
      }

      // Execute each tool call sequentially. Append a tool message per call.
      for (const tc of turnToolCalls) {
        if (signal.aborted) throw new DOMException('aborted', 'AbortError');
        const builtinHandler = builtins?.handlers.get(tc.name);
        const kbHandler = builtinHandler ? null : kbHandlers.get(tc.name) ?? null;
        const delegateHandler =
          builtinHandler || kbHandler
            ? null
            : delegationHandlers.get(tc.name) ?? null;
        const route =
          builtinHandler || kbHandler || delegateHandler
            ? null
            : loaded?.resolve(tc.name) ?? null;
        let resultText: string;
        let isError = false;
        if (!builtinHandler && !kbHandler && !delegateHandler && !route) {
          isError = true;
          resultText = i18n.t('tools.unknownTool', { name: tc.name });
        } else {
          onDelta?.(
            i18n.t('tools.toolCalling', { name: tc.name }) +
              limitTextForContext(
                tc.arguments,
                TOOL_ARGUMENT_DISPLAY_LIMIT,
                i18n.t('tools.labelToolArgs', { name: tc.name })
              )
          );
          try {
            let parsedArgs: unknown = {};
            try {
              parsedArgs = JSON.parse(tc.arguments || '{}');
            } catch {
              parsedArgs = {};
            }
            if (builtinHandler) {
              resultText = await builtinHandler(parsedArgs);
            } else if (kbHandler) {
              resultText = await kbHandler(parsedArgs);
            } else if (delegateHandler) {
              resultText = await delegateHandler(parsedArgs);
            } else {
              resultText = await route!.client.callTool(
                route!.rawName,
                parsedArgs
              );
            }
          } catch (err) {
            isError = true;
            resultText = err instanceof Error ? err.message : String(err);
          }
        }
        const displayResultText = limitTextForContext(
          resultText,
          TOOL_RESULT_DISPLAY_LIMIT,
          i18n.t('tools.labelToolResult', { name: tc.name })
        );
        const contextResultText = limitTextForContext(
          resultText,
          TOOL_RESULT_CONTEXT_LIMIT,
          i18n.t('tools.labelToolResult', { name: tc.name })
        );
        onDelta?.(
          `\n${isError ? i18n.t('tools.toolError') : i18n.t('tools.toolResult')}：${displayResultText}\n`
        );
        traceToolCalls.push({
          name: tc.name,
          args: tc.arguments.slice(0, TOOL_ARGUMENT_DISPLAY_LIMIT),
          result: displayResultText,
          isError,
        });
        messages.push({
          role: 'tool',
          content: contextResultText,
          toolCallId: tc.id,
          toolName: tc.name,
        });
      }
      // loop continues — start a new model turn with the tool results
    }
  } finally {
    if (loaded) {
      loaded.close().catch(() => {
        /* best effort */
      });
    }
  }
}

function firstLine(s: string): string {
  if (!s) return '';
  for (const line of s.split('\n')) {
    const t = line.trim();
    if (t) return t.length > 80 ? t.slice(0, 80) + '…' : t;
  }
  return '';
}

function buildRetrievalQuery(
  userMessage: string,
  extra?: string,
  history?: Message[]
): string {
  const recentHistory = (history ?? [])
    .slice(-4)
    .map((m) => compactForRetrieval(m.content, Math.floor(RAG_QUERY_CONTEXT_LIMIT / 4)))
    .join('\n');
  const query = [userMessage, extra ?? '', recentHistory]
    .filter(Boolean)
    .join('\n\n');
  return compactForRetrieval(query, RAG_QUERY_CONTEXT_LIMIT);
}

function prepareHistoryMessages(history: Message[]): Message[] {
  return history.slice(-HISTORY_MESSAGE_COUNT_LIMIT).map((m) => ({
    ...m,
    content: limitTextForContext(
      m.content,
      HISTORY_MESSAGE_CONTEXT_LIMIT,
      i18n.t('tools.labelHistory', { role: messageRoleLabel(m.role) })
    ),
  }));
}

function prepareMessagesForRequest(messages: Message[]): Message[] {
  const currentUserIndex = findLastMessageIndex(messages, (m) => m.role === 'user');
  if (currentUserIndex < 0) {
    return keepRecentGroups(groupMessagesForContext(messages), REQUEST_MESSAGES_CONTEXT_LIMIT);
  }

  const anchorUser = messages[currentUserIndex];
  const afterGroups = groupMessagesForContext(messages.slice(currentUserIndex + 1));
  const keptAfter: Message[][] = [];
  let used = messageContextSize(anchorUser);

  for (let i = afterGroups.length - 1; i >= 0; i -= 1) {
    const group = afterGroups[i];
    const size = groupContextSize(group);
    if (used + size > REQUEST_MESSAGES_CONTEXT_LIMIT && keptAfter.length > 0) {
      continue;
    }
    if (used + size <= REQUEST_MESSAGES_CONTEXT_LIMIT || keptAfter.length === 0) {
      keptAfter.unshift(group);
      used += size;
    }
  }

  const beforeGroups = groupMessagesForContext(
    messages
      .slice(0, currentUserIndex)
      .filter((m) => m.role !== 'tool')
      .map(stripToolCallsForHistory)
  );
  const keptBefore: Message[][] = [];
  for (let i = beforeGroups.length - 1; i >= 0; i -= 1) {
    const group = beforeGroups[i];
    const size = groupContextSize(group);
    if (used + size > REQUEST_MESSAGES_CONTEXT_LIMIT) continue;
    keptBefore.unshift(group);
    used += size;
  }

  return [...keptBefore.flat(), anchorUser, ...keptAfter.flat()];
}

function keepRecentGroups(groups: Message[][], limit: number): Message[] {
  const kept: Message[][] = [];
  let used = 0;
  for (let i = groups.length - 1; i >= 0; i -= 1) {
    const group = groups[i];
    const size = groupContextSize(group);
    if (used + size > limit && kept.length > 0) continue;
    kept.unshift(group);
    used += size;
    if (used >= limit) break;
  }
  return kept.flat();
}

function groupMessagesForContext(messages: Message[]): Message[][] {
  const groups: Message[][] = [];
  for (let i = 0; i < messages.length; ) {
    const message = messages[i];
    if (message.role === 'tool') {
      i += 1;
      continue;
    }
    if (message.role === 'assistant' && message.toolCalls?.length) {
      const group = [message];
      i += 1;
      while (i < messages.length && messages[i].role === 'tool') {
        group.push(messages[i]);
        i += 1;
      }
      groups.push(group);
      continue;
    }
    groups.push([message]);
    i += 1;
  }
  return groups;
}

function stripToolCallsForHistory(message: Message): Message {
  if (message.role !== 'assistant' || !message.toolCalls?.length) return message;
  return { role: 'assistant', content: message.content };
}

function groupContextSize(group: Message[]): number {
  return group.reduce((sum, message) => sum + messageContextSize(message), 0);
}

function messageContextSize(message: Message): number {
  const toolCallSize = (message.toolCalls ?? []).reduce(
    (sum, tc) => sum + tc.name.length + tc.arguments.length + 80,
    0
  );
  return message.content.length + toolCallSize + 120;
}

function findLastMessageIndex(
  messages: Message[],
  predicate: (message: Message) => boolean
): number {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    if (predicate(messages[i])) return i;
  }
  return -1;
}

function limitToolCallForContext(tc: ToolCall): ToolCall {
  if (tc.arguments.length <= TOOL_ARGUMENT_CONTEXT_LIMIT) return tc;
  return {
    ...tc,
    arguments: JSON.stringify({
      truncated: true,
      tool: tc.name,
      originalChars: tc.arguments.length,
      note: i18n.t('tools.argsTruncatedNote'),
      preview: limitTextForContext(
        tc.arguments,
        TOOL_ARGUMENT_CONTEXT_LIMIT,
        i18n.t('tools.labelToolArgs', { name: tc.name })
      ),
    }),
  };
}

function limitTextForContext(text: string, limit: number, label: string): string {
  if (text.length <= limit) return text;
  const note = i18n.t('tools.truncatedNote', { label, chars: text.length });
  const keep = Math.max(0, limit - note.length);
  if (keep <= 0) return note.slice(0, limit);
  const headLen = Math.ceil(keep * 0.65);
  const tailLen = keep - headLen;
  const tail = tailLen > 0 ? text.slice(-tailLen) : '';
  return text.slice(0, headLen) + note + tail;
}

function compactForRetrieval(text: string, limit: number): string {
  if (text.length <= limit) return text;
  const headLen = Math.ceil(limit * 0.65);
  const tailLen = limit - headLen;
  return `${text.slice(0, headLen)}

${text.slice(-tailLen)}`;
}

function messageRoleLabel(role: Message['role']): string {
  switch (role) {
    case 'assistant':
      return i18n.t('tools.roleAI');
    case 'tool':
      return i18n.t('tools.roleTool');
    case 'system':
      return i18n.t('tools.roleSystem');
    case 'user':
    default:
      return i18n.t('tools.roleUser');
  }
}

