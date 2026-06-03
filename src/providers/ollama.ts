import type { ChatProvider, StreamChunk, StreamOpts } from './types';
import { ProviderError } from './types';
import i18n from '../i18n';

interface Config {
  baseUrl: string;
}

export function createOllamaProvider(cfg: Config): ChatProvider {
  return {
    id: 'ollama',
    async *stream(opts: StreamOpts): AsyncIterable<StreamChunk> {
      const url = `${cfg.baseUrl.replace(/\/$/, '')}/api/chat`;
      const body = {
        model: opts.model,
        stream: true,
        options: { temperature: opts.temperature ?? 0.7 },
        messages: [
          { role: 'system', content: opts.systemPrompt },
          ...opts.messages.filter((m) => m.role !== 'system'),
        ],
      };
      const res = await fetch(url, {
        method: 'POST',
        signal: opts.signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok || !res.body) {
        const text = await res.text().catch(() => '');
        throw new ProviderError(
          i18n.t('errors.ollamaRequestFailed', { status: res.status, body: text.slice(0, 200) })
        );
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buf = '';
      let usage: { input: number; output: number } | undefined;
      while (true) {
        if (opts.signal?.aborted) throw new DOMException('aborted', 'AbortError');
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split('\n');
        buf = lines.pop() ?? '';
        for (const line of lines) {
          const t = line.trim();
          if (!t) continue;
          try {
            const j = JSON.parse(t);
            if (j.message?.content) {
              yield { delta: j.message.content, done: false };
            }
            if (j.done) {
              usage = {
                input: j.prompt_eval_count ?? 0,
                output: j.eval_count ?? 0,
              };
            }
          } catch {
            /* skip */
          }
        }
      }
      yield { delta: '', done: true, usage };
    },

    async ping() {
      const res = await fetch(`${cfg.baseUrl.replace(/\/$/, '')}/api/tags`);
      if (!res.ok) {
        throw new ProviderError(
          i18n.t('errors.ollamaPingFailed', { status: res.status })
        );
      }
      return true;
    },
  };
}
