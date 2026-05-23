import type { ChatProvider } from './types';
import { createOpenAICompatibleProvider } from './openaiCompatible';

interface Config {
  baseUrl: string;
  /** Optional. LM Studio accepts any string here; some setups require it set. */
  apiKey?: string;
}

export function createLMStudioProvider(cfg: Config): ChatProvider {
  return createOpenAICompatibleProvider({
    id: 'lmstudio',
    displayName: 'LM Studio',
    baseUrl: cfg.baseUrl,
    apiKey: cfg.apiKey ?? 'lm-studio',
    requireKey: false,
  });
}
