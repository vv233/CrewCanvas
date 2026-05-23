import type { ChatProvider } from './types';
import { createOpenAICompatibleProvider } from './openaiCompatible';

interface Config {
  apiKey: string;
  baseUrl: string;
}

export function createOpenAIProvider(cfg: Config): ChatProvider {
  return createOpenAICompatibleProvider({
    id: 'openai',
    displayName: 'OpenAI',
    baseUrl: cfg.baseUrl,
    apiKey: cfg.apiKey,
    requireKey: true,
  });
}
