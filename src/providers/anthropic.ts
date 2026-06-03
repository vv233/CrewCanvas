import type { ChatProvider, StreamChunk, StreamOpts } from './types';
import { ProviderError } from './types';
import { parseSSE } from './sse';
import type { Message } from '../types';
import i18n from '../i18n';

function truncate(s: string, n: number): string {
  if (s.length <= n) return s;
  return s.slice(0, n) + '…';
}

function extractMcpResultText(cb: {
  content?: Array<{ type?: string; text?: string }>;
}): string {
  if (!cb.content || !Array.isArray(cb.content)) return '';
  return cb.content
    .map((c) => (c.type === 'text' ? c.text ?? '' : JSON.stringify(c)))
    .join(' ');
}

function toAnthropicMessage(m: Message): Record<string, unknown> {
  if (m.role === 'tool') {
    return {
      role: 'user',
      content: [
        {
          type: 'tool_result',
          tool_use_id: m.toolCallId,
          content: m.content,
        },
      ],
    };
  }
  if (m.role === 'assistant' && m.toolCalls && m.toolCalls.length > 0) {
    const blocks: unknown[] = [];
    if (m.content) blocks.push({ type: 'text', text: m.content });
    for (const tc of m.toolCalls) {
      let input: unknown = {};
      try {
        input = JSON.parse(tc.arguments);
      } catch {
        input = {};
      }
      blocks.push({
        type: 'tool_use',
        id: tc.id,
        name: tc.name,
        input,
      });
    }
    return { role: 'assistant', content: blocks };
  }
  return { role: m.role, content: m.content };
}

interface Config {
  apiKey: string;
  baseUrl: string;
}

export function createAnthropicProvider(cfg: Config): ChatProvider {
  return {
    id: 'anthropic',
    async *stream(opts: StreamOpts): AsyncIterable<StreamChunk> {
      if (!cfg.apiKey) {
        throw new ProviderError(i18n.t('errors.anthropicNoKey'));
      }
      const url = `${cfg.baseUrl.replace(/\/$/, '')}/messages`;
      // Only remote-transport MCP servers are sent to Anthropic's API; local
      // ones are handled upstream by the agent runner via `opts.tools`.
      const enabledMcp = (opts.mcpServers ?? []).filter(
        (s) =>
          s.enabled &&
          s.url &&
          s.name &&
          (s.transport ?? 'remote') === 'remote'
      );
      const body: Record<string, unknown> = {
        model: opts.model,
        max_tokens: opts.maxTokens ?? 2048,
        temperature: opts.temperature ?? 0.7,
        system: opts.systemPrompt,
        messages: opts.messages
          .filter((m) => m.role !== 'system')
          .map(toAnthropicMessage),
        stream: true,
      };
      if (opts.tools && opts.tools.length > 0) {
        body.tools = opts.tools.map((t) => ({
          name: t.name,
          description: t.description ?? '',
          input_schema: t.inputSchema,
        }));
      }
      if (enabledMcp.length > 0) {
        body.mcp_servers = enabledMcp.map((s) => {
          const entry: Record<string, unknown> = {
            type: 'url',
            url: s.url,
            name: s.name,
          };
          if (s.authorizationToken) entry.authorization_token = s.authorizationToken;
          if (s.allowedTools && s.allowedTools.length > 0) {
            entry.tool_configuration = { allowed_tools: s.allowedTools };
          }
          return entry;
        });
      }
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'x-api-key': cfg.apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      };
      if (enabledMcp.length > 0) {
        headers['anthropic-beta'] = 'mcp-client-2025-04-04';
      }
      const res = await fetch(url, {
        method: 'POST',
        signal: opts.signal,
        headers,
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new ProviderError(
          i18n.t('errors.anthropicRequestFailed', {
            status: res.status,
            statusText: res.statusText,
          }),
          { status: res.status, body: text }
        );
      }
      let usage: { input: number; output: number } | undefined;
      let finishReason: StreamChunk['finishReason'] = 'stop';
      // Track per-content-block state so we can pretty-print MCP tool calls
      // as they stream in. Anthropic sends partial JSON for tool input, then
      // a separate mcp_tool_result block for the response.
      const blockKinds = new Map<
        number,
        'text' | 'mcp_tool_use' | 'mcp_tool_result' | 'tool_use' | 'other'
      >();
      const toolInputBuf = new Map<number, string>(); // index → partial JSON
      const toolMeta = new Map<number, { server: string; name: string }>();
      // Local tool_use blocks (those we have to execute) keep id+name.
      const localToolMeta = new Map<number, { id: string; name: string }>();

      for await (const evt of parseSSE(res, opts.signal)) {
        if (!evt.data || evt.data === '[DONE]') continue;
        try {
          const data = JSON.parse(evt.data);
          if (data.type === 'content_block_start') {
            const idx: number = data.index;
            const cb = data.content_block ?? {};
            if (cb.type === 'text') {
              blockKinds.set(idx, 'text');
            } else if (cb.type === 'mcp_tool_use') {
              blockKinds.set(idx, 'mcp_tool_use');
              const server = cb.server_name ?? '?';
              const name = cb.name ?? '?';
              toolMeta.set(idx, { server, name });
              toolInputBuf.set(idx, '');
              yield {
                delta: i18n.t('tools.remoteToolCalling', { name: `${server}.${name}` }),
                done: false,
              };
            } else if (cb.type === 'mcp_tool_result') {
              blockKinds.set(idx, 'mcp_tool_result');
              const txt = extractMcpResultText(cb);
              const tag = cb.is_error ? i18n.t('tools.toolError') : i18n.t('tools.toolResult');
              yield {
                delta: `\n${tag}：${truncate(txt, 400)}\n`,
                done: false,
              };
            } else if (cb.type === 'tool_use') {
              // Local tool call: caller will execute it after the stream ends.
              blockKinds.set(idx, 'tool_use');
              localToolMeta.set(idx, { id: cb.id ?? '', name: cb.name ?? '' });
              toolInputBuf.set(idx, '');
            } else {
              blockKinds.set(idx, 'other');
            }
          } else if (data.type === 'content_block_delta') {
            const idx: number = data.index;
            const kind = blockKinds.get(idx);
            const delta = data.delta ?? {};
            if (kind === 'text' && typeof delta.text === 'string') {
              yield { delta: delta.text, done: false };
            } else if (
              (kind === 'mcp_tool_use' || kind === 'tool_use') &&
              delta.type === 'input_json_delta' &&
              typeof delta.partial_json === 'string'
            ) {
              toolInputBuf.set(idx, (toolInputBuf.get(idx) ?? '') + delta.partial_json);
            }
          } else if (data.type === 'content_block_stop') {
            const idx: number = data.index;
            const kind = blockKinds.get(idx);
            if (kind === 'mcp_tool_use') {
              const meta = toolMeta.get(idx);
              const raw = toolInputBuf.get(idx) ?? '';
              let argSummary = raw;
              try {
                argSummary = JSON.stringify(JSON.parse(raw));
              } catch {
                /* keep raw */
              }
              if (meta) {
                yield {
                  delta: i18n.t('tools.argsLine', { args: truncate(argSummary, 200) }),
                  done: false,
                };
              }
            } else if (kind === 'tool_use') {
              const meta = localToolMeta.get(idx);
              if (meta && meta.id && meta.name) {
                yield {
                  done: false,
                  toolCall: {
                    id: meta.id,
                    name: meta.name,
                    arguments: toolInputBuf.get(idx) || '{}',
                  },
                };
              }
            }
          } else if (data.type === 'message_delta') {
            if (data.usage) {
              usage = {
                input: data.usage.input_tokens ?? 0,
                output: data.usage.output_tokens ?? 0,
              };
            }
            if (data.delta?.stop_reason) {
              const sr = data.delta.stop_reason;
              if (sr === 'tool_use') finishReason = 'tool_use';
              else if (sr === 'max_tokens') finishReason = 'length';
              else if (sr === 'end_turn' || sr === 'stop_sequence') finishReason = 'stop';
              else finishReason = 'other';
            }
          } else if (data.type === 'message_stop') {
            yield { done: true, usage, finishReason };
            return;
          } else if (data.type === 'error') {
            throw new ProviderError(
              i18n.t('errors.anthropicError', {
                msg: data.error?.message ?? i18n.t('errors.anthropicUnknown'),
              })
            );
          }
        } catch (e) {
          if (e instanceof ProviderError) throw e;
        }
      }
      yield { done: true, usage, finishReason };
    },

    async ping() {
      if (!cfg.apiKey) throw new ProviderError(i18n.t('errors.anthropicNoKeyShort'));
      const res = await fetch(`${cfg.baseUrl.replace(/\/$/, '')}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': cfg.apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 8,
          messages: [{ role: 'user', content: 'ping' }],
        }),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new ProviderError(
          i18n.t('errors.anthropicPingFailed', { status: res.status, body: text.slice(0, 200) })
        );
      }
      return true;
    },
  };
}
