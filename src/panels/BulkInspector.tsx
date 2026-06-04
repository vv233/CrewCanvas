import { useState } from 'react';
import { Trash2, Wand2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useWorkflowStore } from '../state/workflowStore';
import type { AgentNodeData, FlowNode, ProviderId } from '../types';
import { MODEL_OPTIONS } from '../providers/models';

interface Props {
  nodes: FlowNode[];
}

/** Shown when more than one node is selected (box-select / shift-click).
 *  Lets you bulk-set the model source (provider + model) on every selected
 *  AI Worker at once. */
export function BulkInspector({ nodes }: Props) {
  const { t } = useTranslation();
  const updateNodesData = useWorkflowStore((s) => s.updateNodesData);
  const removeSelected = useWorkflowStore((s) => s.removeSelected);

  const agentIds = nodes.filter((n) => n.data?.kind === 'agent').map((n) => n.id);

  const [provider, setProvider] = useState<ProviderId>('openrouter');
  const [model, setModel] = useState<string>(MODEL_OPTIONS.openrouter[0]?.id ?? '');

  const applySource = () => {
    if (agentIds.length === 0) return;
    updateNodesData(agentIds, { provider, model } as Partial<AgentNodeData>);
  };

  return (
    <div className="space-y-4">
      <div className="rounded-md border border-line bg-panel/40 p-3 text-[12px]">
        <div className="font-semibold text-ink">
          {t('bulkInspector.selectedCount', { count: nodes.length })}
        </div>
        <div className="mt-0.5 text-muted">
          {t('bulkInspector.agentsCount', { count: agentIds.length })}
        </div>
      </div>

      <div>
        <div className="mb-2 flex items-center gap-1.5">
          <Wand2 size={12} className="text-accent" />
          <span className="label">{t('bulkInspector.sourceTitle')}</span>
        </div>

        {agentIds.length === 0 ? (
          <div className="text-[11px] text-muted">{t('bulkInspector.noAgents')}</div>
        ) : (
          <div className="space-y-2">
            <div>
              <div className="label mb-1">{t('fields.provider')}</div>
              <select
                className="input"
                value={provider}
                onChange={(e) => {
                  const p = e.target.value as ProviderId;
                  setProvider(p);
                  setModel(MODEL_OPTIONS[p][0]?.id ?? '');
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
                list={`bulk-models-${provider}`}
                value={model}
                onChange={(e) => setModel(e.target.value)}
                placeholder={t('agentInspector.modelPlaceholder')}
              />
              <datalist id={`bulk-models-${provider}`}>
                {MODEL_OPTIONS[provider].map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                  </option>
                ))}
              </datalist>
            </div>
            <button className="btn-primary w-full" onClick={applySource}>
              <Wand2 size={14} /> {t('bulkInspector.apply', { count: agentIds.length })}
            </button>
          </div>
        )}
      </div>

      <button className="btn-danger w-full" onClick={removeSelected}>
        <Trash2 size={14} /> {t('bulkInspector.deleteSelection', { count: nodes.length })}
      </button>
    </div>
  );
}
