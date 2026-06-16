import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import type { ProviderId } from '../types';
import { MODEL_OPTIONS } from '../providers/models';
import { Field } from './Field';

/** The five provider <option>s, shared by every model-source selector. */
function ProviderOptions() {
  const { t } = useTranslation();
  return (
    <>
      <option value="anthropic">Anthropic</option>
      <option value="openai">OpenAI</option>
      <option value="openrouter">OpenRouter</option>
      <option value="ollama">{t('providers.ollamaLocal')}</option>
      <option value="lmstudio">{t('providers.lmstudioLocal')}</option>
    </>
  );
}

interface Props {
  provider: ProviderId;
  model: string;
  /** Called with both fields. Changing the provider resets the model to that
   *  provider's first known option. */
  onChange: (next: { provider: ProviderId; model: string }) => void;
  /** Namespaces the <datalist> id so multiple selectors never collide. */
  idPrefix?: string;
  /** Whether to show the model placeholder hint (default true). */
  modelPlaceholder?: boolean;
}

/** Provider <select> + model <input list=…> pair, previously duplicated across
 *  the agent / discuss / router / aggregator / bulk inspectors. */
export const ProviderModelSelector = memo(function ProviderModelSelector({
  provider,
  model,
  onChange,
  idPrefix = 'models',
  modelPlaceholder = true,
}: Props) {
  const { t } = useTranslation();
  const listId = `${idPrefix}-${provider}`;
  return (
    <>
      <Field label={t('fields.provider')}>
        <select
          className="input"
          value={provider}
          onChange={(e) => {
            const p = e.target.value as ProviderId;
            onChange({ provider: p, model: MODEL_OPTIONS[p][0]?.id ?? '' });
          }}
        >
          <ProviderOptions />
        </select>
      </Field>
      <Field label={t('fields.model')}>
        <input
          className="input font-mono text-[12px]"
          list={listId}
          value={model}
          onChange={(e) => onChange({ provider, model: e.target.value })}
          placeholder={modelPlaceholder ? t('agentInspector.modelPlaceholder') : undefined}
        />
        <datalist id={listId}>
          {MODEL_OPTIONS[provider].map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
            </option>
          ))}
        </datalist>
      </Field>
    </>
  );
});
