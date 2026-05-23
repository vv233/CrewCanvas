import type {
  AgentNodeData,
  McpServerConfig,
  Message,
  ProviderId,
  ToolCall,
  ToolDef,
} from '../types';
import { getProvider } from '../providers/registry';
import { loadLocalMcpTools, type LoadedMcp } from '../mcp/loader';
import { getWorkflowFsTools } from './builtinTools';
import { buildRagContext } from '../rag/store';

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
    onDelta?.(
      `\n⚠️ 当前 provider (${agent.provider}) 不支持工具调用，fs_read / fs_write 不会提供给模型。\n`
    );
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
      onDelta?.(`\n⚠️ MCP [${err.serverName}] 连接失败：${err.message}\n`);
    }
  }

  // Builtin per-workflow fs tools (always on when workflowId provided and
  // provider supports tool calling).
  const builtins =
    supportsTools && opts.workflowId
      ? getWorkflowFsTools(opts.workflowId)
      : null;

  // Delegation tools — exposed when the agent has subordinates declared
  // via `manage` edges. The model can call them in any order, multiple
  // times, or not at all.
  const delegationTools: ToolDef[] = [];
  const delegationHandlers = new Map<string, (args: unknown) => Promise<string>>();
  if (supportsTools && opts.delegates && opts.delegates.length > 0) {
    const team = opts.delegates;
    const enumNames = team.map((d) => d.name);
    const memberList = team
      .map((d) => `- ${d.name}: ${d.description || '(无描述)'}`)
      .join('\n');

    delegationTools.push({
      name: 'list_team',
      description: `列出你能指派的下属团队成员。当前下属：\n${memberList}`,
      inputSchema: { type: 'object', properties: {} },
    });
    delegationTools.push({
      name: 'delegate',
      description:
        '把一个具体任务派给一名下属，等待他完成并返回结果。可以多次调用、可以串行也可以基于上一次结果再派别的下属。',
      inputSchema: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            enum: enumNames,
            description: '下属姓名（必须是 list_team 列出的之一）',
          },
          task: {
            type: 'string',
            description:
              '清晰、自包含的任务描述。下属看不到你之前的上下文，请把他需要的信息都写进 task。',
          },
        },
        required: ['name', 'task'],
      },
    });

    delegationHandlers.set('list_team', async () => memberList);
    delegationHandlers.set('delegate', async (raw) => {
      const args = (raw ?? {}) as { name?: string; task?: string };
      if (!args.name) return '错误：缺少 name 参数';
      if (!args.task) return '错误：缺少 task 参数';
      const target = team.find((d) => d.name === args.name);
      if (!target) {
        return `错误：找不到下属 "${args.name}"。可用：${enumNames.join(', ')}`;
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
        .map(
          (f) =>
            `- ${f.name} (${f.content.length} chars, 首行: ${
              firstLine(f.content) || '(空)'
            })`
        )
        .join('\n'),
      KB_INDEX_CONTEXT_LIMIT,
      '知识库文件列表'
    );

    kbTools.push({
      name: 'kb_list',
      description: '列出你的私人知识库中的所有文件（名字 + 大小 + 首行预览）',
      inputSchema: { type: 'object', properties: {} },
    });
    kbTools.push({
      name: 'kb_read',
      description: '按名字读取知识库中的一个文件。大文件会被截断；优先使用 kb_search 或内置 RAG 片段。',
      inputSchema: {
        type: 'object',
        properties: {
          name: { type: 'string', description: '文件名，必须是 kb_list 列出的之一' },
        },
        required: ['name'],
      },
    });
    kbTools.push({
      name: 'kb_search',
      description:
        '在知识库所有文件里关键词搜索（多个词空格分隔，OR 关系），返回命中文件 + 周围片段。先 search 再 read 比直接读全部更省 token。',
      inputSchema: {
        type: 'object',
        properties: {
          query: { type: 'string', description: '关键词，可空格分隔多个' },
          max_hits: { type: 'number', description: '最多返回多少个命中文件（默认 5）' },
        },
        required: ['query'],
      },
    });

    kbHandlers.set('kb_list', async () => indexSummary || '(知识库为空)');
    kbHandlers.set('kb_read', async (raw) => {
      const { name } = (raw ?? {}) as { name?: string };
      if (!name) return '错误：缺少 name 参数';
      const file = kbFiles.find((f) => f.name === name);
      return file
        ? limitTextForContext(
            file.content,
            KB_READ_CONTEXT_LIMIT,
            `知识库文件 ${file.name}`
          )
        : `(知识库中无此文件: ${name}；可用文件:\n${indexSummary})`;
    });
    kbHandlers.set('kb_search', async (raw) => {
      const { query, max_hits = 5 } = (raw ?? {}) as {
        query?: string;
        max_hits?: number;
      };
      if (!query) return '错误：缺少 query 参数';
      const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
      if (terms.length === 0) return '错误：query 为空';
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
          `### ${f.name} (命中 ${positions.length} 次)\n${snippets.join('\n---\n')}`
        );
        if (hits.length >= max_hits) break;
      }
      return hits.length > 0 ? hits.join('\n\n') : '(没有命中任何关键词)';
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
    '系统提示词'
  );
  const safeKbInline = kbInline
    ? limitTextForContext(kbInline, KB_INLINE_CONTEXT_LIMIT, '个人知识背景')
    : '';
  const safeHistory = prepareHistoryMessages(opts.history ?? []);
  const safeUserMessage = limitTextForContext(
    userMessage,
    USER_MESSAGE_CONTEXT_LIMIT,
    '当前用户输入'
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
    onDelta?.(
      '\n⚠️ 检测到上下文过长，已截断部分系统提示/历史/输入；长资料建议放入资料库由 RAG 自动检索。\n'
    );
  }

  const finalSystemPrompt = [
    safeSystemPrompt,
    safeKbInline
      ? `## 个人知识背景（始终在你的上下文里）\n\n${safeKbInline}`
      : '',
    ragContext,
    builtins ? FS_TOOL_INSTRUCTIONS : '',
  ]
    .filter(Boolean)
    .join('\n\n');

  const messages: Message[] = [
    ...safeHistory,
    { role: 'user', content: safeUserMessage },
  ];

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
        return { text: finalText, toolRounds };
      }

      // Persist the assistant turn (text + tool_calls) before executing.
      messages.push({
        role: 'assistant',
        content: limitTextForContext(
          turnText,
          ASSISTANT_MESSAGE_CONTEXT_LIMIT,
          '模型工具调用前回复'
        ),
        toolCalls: turnToolCalls.map(limitToolCallForContext),
      });

      toolRounds += 1;
      if (toolRounds > maxToolRounds) {
        onDelta?.(
          `\n\n⛔ 达到工具调用次数上限（${maxToolRounds}），停止循环\n`
        );
        return { text: finalText, toolRounds };
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
          resultText = `unknown tool: ${tc.name}`;
        } else {
          onDelta?.(
            `\n\n🔧 [${tc.name}] 调用中…\n  参数: ${limitTextForContext(
              tc.arguments,
              TOOL_ARGUMENT_DISPLAY_LIMIT,
              `${tc.name} 工具参数`
            )}`
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
          `${tc.name} 工具结果`
        );
        const contextResultText = limitTextForContext(
          resultText,
          TOOL_RESULT_CONTEXT_LIMIT,
          `${tc.name} 工具结果`
        );
        onDelta?.(
          `\n${isError ? '⚠️ 工具错误' : '↩️ 工具结果'}：${displayResultText}\n`
        );
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
      `${messageRoleLabel(m.role)}历史消息`
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
      note: '工具参数已从历史上下文中截断；真实参数已用于执行工具。',
      preview: limitTextForContext(
        tc.arguments,
        TOOL_ARGUMENT_CONTEXT_LIMIT,
        `${tc.name} 工具参数`
      ),
    }),
  };
}

function limitTextForContext(text: string, limit: number, label: string): string {
  if (text.length <= limit) return text;
  const note = `

[${label}已截断：原始 ${text.length} 字符，仅保留前后片段以避免超过模型上下文。]

`;
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
      return 'AI ';
    case 'tool':
      return '工具';
    case 'system':
      return '系统';
    case 'user':
    default:
      return '用户';
  }
}


const FS_TOOL_INSTRUCTIONS = `## 工作流共享文件夹工具

你可以使用共享文件夹工具在本工作流内读写文件：
- fs_list({ "path": "/" })：查看目录内容
- fs_read({ "path": "/file.md" })：读取已有文本文件（大文件只返回有限片段）
- fs_write({ "path": "/file.md", "content": "..." })：写入或覆盖文本文件
- fs_delete({ "path": "/file.md" })：删除文件或目录

使用规则：
- 自动 RAG 已经把相关知识片段注入上下文；只有需要精确查看共享文件时再调用 fs_list 或 fs_read。
- fs_read 面向模型有读取上限，遇到截断时不要反复读取同一个大文件；改用资料库检索、让用户拆分文件，或只处理已返回片段。
- 需要把长方案、报告、代码、JSON、记忆或下游要继续使用的内容保存下来时，优先调用 fs_write；对话里只简短说明写入路径和内容摘要。
- 追加文件时，先 fs_read 读取旧内容，再 fs_write 写回「旧内容 + 新内容」；如果旧内容被截断，先说明无法安全追加完整文件。
- 只有工具返回成功后，才能说自己已读取或已写入某个文件。`;

