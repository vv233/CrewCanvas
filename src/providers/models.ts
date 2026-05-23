import type { ProviderId } from '../types';

export interface ModelOption {
  id: string;
  label: string;
}

export const MODEL_OPTIONS: Record<ProviderId, ModelOption[]> = {
  anthropic: [
    { id: 'claude-opus-4-7', label: 'Claude Opus 4.7' },
    { id: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6' },
    { id: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5' },
  ],
  openai: [
    { id: 'gpt-4o', label: 'GPT-4o' },
    { id: 'gpt-4o-mini', label: 'GPT-4o mini' },
    { id: 'o1-mini', label: 'o1-mini' },
  ],
  ollama: [
    { id: 'llama3.1', label: 'Llama 3.1' },
    { id: 'qwen2.5', label: 'Qwen 2.5' },
    { id: 'mistral', label: 'Mistral' },
  ],
  openrouter: [
    { id: 'openai/gpt-oss-120b:free', label: 'GPT-OSS 120B (free)' },
    { id: 'openai/gpt-oss-20b:free', label: 'GPT-OSS 20B (free)' },
    { id: 'meta-llama/llama-3.3-70b-instruct:free', label: 'Llama 3.3 70B (free)' },
    { id: 'deepseek/deepseek-chat-v3.1:free', label: 'DeepSeek Chat v3.1 (free)' },
    { id: 'anthropic/claude-sonnet-4', label: 'Claude Sonnet 4 (paid)' },
    { id: 'anthropic/claude-3.5-sonnet', label: 'Claude 3.5 Sonnet (paid)' },
    { id: 'openai/gpt-4o', label: 'GPT-4o (paid)' },
    { id: 'openai/gpt-4o-mini', label: 'GPT-4o mini (paid)' },
    { id: 'google/gemini-2.0-flash-exp', label: 'Gemini 2.0 Flash (paid)' },
  ],
  lmstudio: [
    { id: 'local-model', label: '当前加载的本地模型' },
  ],
};
