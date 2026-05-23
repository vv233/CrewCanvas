import type { ChatProvider, StreamChunk, StreamOpts } from './types';
import { ProviderError } from './types';
import { parseSSE } from './sse';
import type { Message } from '../types';

export interface OpenAICompatibleConfig {
  /** Provider id used internally (e.g. 'openai', 'openrouter', 'lmstudio'). */
  id: string;
  /** Display name used in error messages. */
  displayName: string;
  /** Base URL up to and including `/v1` (no trailing slash needed). */
  baseUrl: string;
  /** API key. May be empty when `requireKey` is false (e.g. LM Studio). */
  apiKey: string;
  /** If true, requests will fail early when no key is provided. */
  requireKey: boolean;
  /** Extra HTTP headers added to every request (e.g. OpenRouter referer). */
  extraHeaders?: Record<string, string>;
}

function toOpenAIMessage(m: Message): Record<string, unknown> {
  if (m.role === 'tool') {
    return {
      role: 'tool',
      tool_call_id: m.toolCallId,
      content: m.content,
    };
  }
  if (m.role === 'assistant' && m.toolCalls && m.toolCalls.length > 0) {
    return {
      role: 'assistant',
      content: m.content || null,
      tool_calls: m.toolCalls.map((tc) => ({
        id: tc.id,
        type: 'function',
        function: { name: tc.name, arguments: tc.arguments },
      })),
    };
  }
  return { role: m.role, content: m.content };
}

export function createOpenAICompatibleProvider(
  cfg: OpenAICompatibleConfig
): ChatProvider {
  const authHeader = (): Record<string, string> =>
    cfg.apiKey ? { Authorization: `Bearer ${cfg.apiKey}` } : {};
  const buildHeaders = (): Record<string, string> => ({
    'Content-Type': 'application/json',
    ...authHeader(),
    ...(cfg.extraHeaders ?? {}),
  });

  return {
    id: cfg.id,
    async *stream(opts: StreamOpts): AsyncIterable<StreamChunk> {
      if (cfg.requireKey && !cfg.apiKey) {
        throw new ProviderError(
          `${cfg.displayName} API key 未配置，请先在「设置」里录入。`
        );
      }
      const url = `${cfg.baseUrl.replace(/\/$/, '')}/chat/completions`;
      const body: Record<string, unknown> = {
        model: opts.model,
        temperature: opts.temperature ?? 0.7,
        max_tokens: opts.maxTokens ?? 2048,
        stream: true,
        stream_options: { include_usage: true },
        messages: [
          { role: 'system', content: opts.systemPrompt },
          ...opts.messages
            .filter((m) => m.role !== 'system')
            .map(toOpenAIMessage),
        ],
      };
      if (opts.tools && opts.tools.length > 0) {
        body.tools = opts.tools.map((t) => ({
          type: 'function',
          function: {
            name: t.name,
            description: t.description ?? '',
            parameters: t.inputSchema,
          },
        }));
      }
      const res = await fetch(url, {
        method: 'POST',
        signal: opts.signal,
        headers: buildHeaders(),
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new ProviderError(
          `${cfg.displayName} 请求失败：${res.status} ${res.statusText}`,
          { status: res.status, body: text }
        );
      }
      let usage: { input: number; output: number } | undefined;
      let finishReason: StreamChunk['finishReason'] = 'stop';
      // Per-index buffers for streamed tool_calls.
      type Buf = { id?: string; name?: string; args: string };
      const toolBufs = new Map<number, Buf>();

      for await (const evt of parseSSE(res, opts.signal)) {
        if (!evt.data) continue;
        if (evt.data === '[DONE]') {
          // Flush any complete tool_calls before signaling done.
          for (const buf of toolBufs.values()) {
            if (buf.id && buf.name != null) {
              yield {
                done: false,
                toolCall: {
                  id: buf.id,
                  name: buf.name,
                  arguments: buf.args || '{}',
                },
              };
            }
          }
          yield { done: true, usage, finishReason };
          return;
        }
        try {
          const data = JSON.parse(evt.data);
          const choice = data.choices?.[0];
          const delta = choice?.delta;
          if (delta?.content && typeof delta.content === 'string') {
            yield { delta: delta.content, done: false };
          }
          if (Array.isArray(delta?.tool_calls)) {
            for (const tc of delta.tool_calls) {
              const idx: number = tc.index ?? 0;
              const buf = toolBufs.get(idx) ?? { args: '' };
              if (tc.id) buf.id = tc.id;
              if (tc.function?.name) buf.name = tc.function.name;
              if (typeof tc.function?.arguments === 'string') {
                buf.args += tc.function.arguments;
              }
              toolBufs.set(idx, buf);
            }
          }
          if (choice?.finish_reason) {
            const fr = choice.finish_reason;
            if (fr === 'tool_calls') finishReason = 'tool_use';
            else if (fr === 'length') finishReason = 'length';
            else if (fr === 'stop') finishReason = 'stop';
            else finishReason = 'other';
          }
          if (data.usage) {
            usage = {
              input: data.usage.prompt_tokens ?? 0,
              output: data.usage.completion_tokens ?? 0,
            };
          }
        } catch {
          /* ignore keepalive / non-json lines */
        }
      }
      for (const buf of toolBufs.values()) {
        if (buf.id && buf.name != null) {
          yield {
            done: false,
            toolCall: {
              id: buf.id,
              name: buf.name,
              arguments: buf.args || '{}',
            },
          };
        }
      }
      yield { done: true, usage, finishReason };
    },

    async ping() {
      if (cfg.requireKey && !cfg.apiKey) {
        throw new ProviderError('未配置 API key');
      }
      const res = await fetch(`${cfg.baseUrl.replace(/\/$/, '')}/models`, {
        headers: authHeader(),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new ProviderError(
          `${cfg.displayName} ping 失败：${res.status} — ${text.slice(0, 200)}`
        );
      }
      return true;
    },
  };
}
