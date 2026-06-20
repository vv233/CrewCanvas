import type { ProviderId, Workflow } from '../types';
import type { SettingsState } from '../state/settingsStore';

export const PROVIDER_LABELS: Record<ProviderId, string> = {
  openai: 'OpenAI',
  anthropic: 'Anthropic',
  openrouter: 'OpenRouter',
  ollama: 'Ollama',
  lmstudio: 'LM Studio',
};

/** Cloud providers require an API key; local ones (ollama / lmstudio) don't. */
const KEY_FIELD: Partial<Record<ProviderId, keyof SettingsState>> = {
  openai: 'openaiKey',
  anthropic: 'anthropicKey',
  openrouter: 'openrouterKey',
};

/** Providers actually used by a runnable node in `wf` whose required API key is
 *  not configured. Used to catch the "click Run on a fresh install → silent
 *  failure in the console" first-run wall before the run starts. */
export function providersMissingKey(
  wf: Workflow,
  settings: SettingsState
): ProviderId[] {
  const used = new Set<ProviderId>();
  for (const n of wf.nodes) {
    const d = n.data;
    if (d.kind === 'agent' || d.kind === 'discuss') {
      used.add(d.provider);
    } else if (d.kind === 'router' && d.rule === 'llm-judge') {
      used.add(d.provider ?? 'openrouter');
    } else if (d.kind === 'aggregator' && d.strategy === 'summarize') {
      used.add(d.provider ?? 'openrouter');
    }
  }
  const missing: ProviderId[] = [];
  for (const p of used) {
    const field = KEY_FIELD[p];
    if (field && !String(settings[field] ?? '').trim()) missing.push(p);
  }
  return missing;
}
