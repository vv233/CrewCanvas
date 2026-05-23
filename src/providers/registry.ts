import type { ChatProvider } from './types';
import { createAnthropicProvider } from './anthropic';
import { createOpenAIProvider } from './openai';
import { createOllamaProvider } from './ollama';
import { createOpenRouterProvider } from './openrouter';
import { createLMStudioProvider } from './lmstudio';
import { useSettingsStore } from '../state/settingsStore';
import type { ProviderId } from '../types';

export function getProvider(id: ProviderId): ChatProvider {
  const s = useSettingsStore.getState();
  switch (id) {
    case 'anthropic':
      return createAnthropicProvider({
        apiKey: s.anthropicKey,
        baseUrl: s.anthropicBaseUrl,
      });
    case 'openai':
      return createOpenAIProvider({
        apiKey: s.openaiKey,
        baseUrl: s.openaiBaseUrl,
      });
    case 'ollama':
      return createOllamaProvider({ baseUrl: s.ollamaBaseUrl });
    case 'openrouter':
      return createOpenRouterProvider({
        apiKey: s.openrouterKey,
        baseUrl: s.openrouterBaseUrl,
        referer: s.openrouterReferer || (typeof location !== 'undefined' ? location.origin : ''),
        title: s.openrouterTitle,
      });
    case 'lmstudio':
      return createLMStudioProvider({
        baseUrl: s.lmstudioBaseUrl,
        apiKey: s.lmstudioKey,
      });
  }
}
