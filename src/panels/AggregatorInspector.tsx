import { Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useWorkflowStore } from '../state/workflowStore';
import type { AggregatorNodeData, FlowNode, ProviderId } from '../types';
import { MODEL_OPTIONS } from '../providers/models';

interface Props {
  node: FlowNode & { data: AggregatorNodeData };
}

export function AggregatorInspector({ node }: Props) {
  const { t } = useTranslation();
  const update = useWorkflowStore((s) => s.updateNodeData);
  const remove = useWorkflowStore((s) => s.removeNode);
  const d = node.data;
  return (
    <div className="space-y-3">
      <div>
        <div className="label mb-1">{t('inspector.name')}</div>
        <input
          className="input"
          value={d.name}
          onChange={(e) => update(node.id, { name: e.target.value })}
        />
      </div>
      <div>
        <div className="label mb-1">{t('aggregatorInspector.strategyLabel')}</div>
        <select
          className="input"
          value={d.strategy}
          onChange={(e) =>
            update(node.id, {
              strategy: e.target.value as AggregatorNodeData['strategy'],
            })
          }
        >
          <option value="concat">{t('aggregatorInspector.concat')}</option>
          <option value="json-merge">{t('aggregatorInspector.jsonMerge')}</option>
          <option value="pick-first">{t('aggregatorInspector.pickFirst')}</option>
          <option value="summarize">{t('aggregatorInspector.summarize')}</option>
        </select>
      </div>
      {d.strategy === 'summarize' && (
        <>
          <div>
            <div className="label mb-1">{t('aggregatorInspector.summarizePromptLabel')}</div>
            <textarea
              className="input min-h-[80px] resize-y text-[13px]"
              value={d.prompt ?? ''}
              placeholder={t('aggregatorInspector.summarizePromptPlaceholder')}
              onChange={(e) => update(node.id, { prompt: e.target.value })}
            />
            <div className="mt-1 text-[10px] text-muted">
              {t('aggregatorInspector.summarizeHint')}
            </div>
          </div>
          <div>
            <div className="label mb-1">{t('fields.provider')}</div>
            <select
              className="input"
              value={d.provider ?? 'openrouter'}
              onChange={(e) => {
                const provider = e.target.value as ProviderId;
                const firstModel = MODEL_OPTIONS[provider][0]?.id ?? '';
                update(node.id, { provider, model: firstModel });
              }}
            >
              <option value="anthropic">Anthropic</option>
              <option value="openai">OpenAI</option>
              <option value="openrouter">OpenRouter</option>
              <option value="ollama">{t('providers.ollamaLocal')}</option>
              <option value="lmstudio">{t('providers.lmstudioLocal')}</option>
            </select>
          </div>
          <div>
            <div className="label mb-1">{t('fields.model')}</div>
            <input
              className="input font-mono text-[12px]"
              list={`aggregator-models-${d.provider ?? 'openrouter'}`}
              value={d.model ?? ''}
              onChange={(e) => update(node.id, { model: e.target.value })}
              placeholder={t('agentInspector.modelPlaceholder')}
            />
            <datalist id={`aggregator-models-${d.provider ?? 'openrouter'}`}>
              {MODEL_OPTIONS[d.provider ?? 'openrouter'].map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </datalist>
          </div>
        </>
      )}
      <button className="btn-danger w-full" onClick={() => remove(node.id)}>
        <Trash2 size={14} /> {t('inspector.deleteNode')}
      </button>
    </div>
  );
}
