import type { ChatProvider } from './types';
import { createOpenAICompatibleProvider } from './openaiCompatible';

interface Config {
  apiKey: string;
  baseUrl: string;
  /** Optional, shown in the OpenRouter dashboard activity feed. */
  referer?: string;
  title?: string;
}

export function createOpenRouterProvider(cfg: Config): ChatProvider {
  const extra: Record<string, string> = {};
  if (cfg.referer) extra['HTTP-Referer'] = cfg.referer;
  if (cfg.title) extra['X-Title'] = cfg.title;
  return createOpenAICompatibleProvider({
    id: 'openrouter',
    displayName: 'OpenRouter',
    baseUrl: cfg.baseUrl,
    apiKey: cfg.apiKey,
    requireKey: true,
    extraHeaders: extra,
  });
}
