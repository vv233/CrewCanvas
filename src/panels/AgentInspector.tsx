import { Trash2, UserRoundCheck } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useWorkflowStore } from '../state/workflowStore';
import type { AgentNodeData, FlowNode, ProviderId } from '../types';
import { MODEL_OPTIONS } from '../providers/models';
import { MonacoSoul } from '../lib/MonacoSoul';
import { SOUL_PRESETS } from '../templates/soulPresets';
import { McpServersField } from './McpServersField';
import { AgentKnowledgeField } from './AgentKnowledgeField';
import { buildRoleCard, downloadRoleCard } from '../storage/roleCard';

interface Props {
  node: FlowNode & { data: AgentNodeData };
}

export function AgentInspector({ node }: Props) {
  const { t } = useTranslation();
  const update = useWorkflowStore((s) => s.updateNodeData);
  const remove = useWorkflowStore((s) => s.removeNode);
  const workflowId = useWorkflowStore((s) => s.workflow.id);
  const d = node.data;

  const exportRoleCard = async () => {
    // Single-card export: include knowledge, but strip MCP auth tokens by default.
    const card = await buildRoleCard(d, workflowId, node.id, {
      includeKnowledge: true,
      includeSensitive: false,
    });
    downloadRoleCard(card);
  };

  return (
    <div className="space-y-3">
      <Field label={t('fields.avatar')}>
        <input
          className="input"
          value={d.avatar}
          maxLength={4}
          onChange={(e) => update(node.id, { avatar: e.target.value })}
        />
      </Field>
      <Field label={t('fields.name')}>
        <input
          className="input"
          value={d.name}
          onChange={(e) => update(node.id, { name: e.target.value })}
        />
      </Field>

      <Field label={t('fields.provider')}>
        <select
          className="input"
          value={d.provider}
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
      </Field>
      <Field label={t('fields.model')}>
        <input
          className="input font-mono text-[12px]"
          list={`models-${d.provider}`}
          value={d.model}
          onChange={(e) => update(node.id, { model: e.target.value })}
          placeholder={t('agentInspector.modelPlaceholder')}
        />
        <datalist id={`models-${d.provider}`}>
          {MODEL_OPTIONS[d.provider].map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
            </option>
          ))}
        </datalist>
      </Field>

      <div className="grid grid-cols-2 gap-2">
        <Field label={t('fields.temperature')}>
          <input
            type="number"
            step="0.1"
            min="0"
            max="2"
            className="input"
            value={d.temperature}
            onChange={(e) =>
              update(node.id, { temperature: parseFloat(e.target.value) || 0 })
            }
          />
        </Field>
        <Field label={t('fields.maxTokens')}>
          <input
            type="number"
            step="128"
            min="64"
            className="input"
            value={d.maxTokens}
            onChange={(e) =>
              update(node.id, { maxTokens: parseInt(e.target.value) || 1024 })
            }
          />
        </Field>
      </div>

      <Field label={t('agentInspector.memory')}>
        <select
          className="input"
          value={d.memory}
          onChange={(e) =>
            update(node.id, { memory: e.target.value as 'none' | 'session' })
          }
        >
          <option value="session">{t('agentInspector.memorySession')}</option>
          <option value="none">{t('agentInspector.memoryNone')}</option>
        </select>
      </Field>

      <Field label={t('agentInspector.soulLabel')}>
        <div className="mb-1 flex gap-1">
          <select
            className="input h-7 text-[11px]"
            value=""
            onChange={(e) => {
              const preset = SOUL_PRESETS.find((p) => p.id === e.target.value);
              if (preset) {
                if (d.soul.trim() && !confirm(t('agentInspector.presetOverwrite')))
                  return;
                update(node.id, { name: preset.name, avatar: preset.avatar, soul: preset.soul });
              }
            }}
          >
            <option value="">{t('agentInspector.fillFromPreset')}</option>
            {SOUL_PRESETS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.avatar} {p.name}
              </option>
            ))}
          </select>
        </div>
        <MonacoSoul
          value={d.soul}
          onChange={(v) => update(node.id, { soul: v })}
          minHeight={280}
        />
        <div className="mt-1 text-[10px] text-muted">
          {t('agentInspector.soulVars')} <code>{'{{input}}'}</code>,{' '}
          <code>{'{{upstream.NodeName}}'}</code>, <code>{'{{var.X}}'}</code>
        </div>
      </Field>

      <McpServersField
        value={d.mcpServers ?? []}
        provider={d.provider}
        onChange={(mcpServers) => update(node.id, { mcpServers })}
      />

      <AgentKnowledgeField
        value={d.knowledge}
        workflowId={workflowId}
        agentNodeId={node.id}
        onChange={(knowledge) => update(node.id, { knowledge })}
      />

      <button
        className="btn-ghost w-full"
        onClick={exportRoleCard}
        title={t('agentInspector.exportRoleCardTitle')}
      >
        <UserRoundCheck size={14} /> {t('agentInspector.exportRoleCard')}
      </button>

      <button
        className="btn-danger w-full"
        onClick={() => remove(node.id)}
      >
        <Trash2 size={14} /> {t('inspector.deleteNode')}
      </button>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="label mb-1">{label}</div>
      {children}
    </div>
  );
}
