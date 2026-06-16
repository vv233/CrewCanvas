import { Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useWorkflowStore } from '../state/workflowStore';
import type { DiscussNodeData, FlowNode } from '../types';
import { MonacoSoul } from '../lib/MonacoSoul';
import { Field } from '../lib/Field';
import { ProviderModelSelector } from '../lib/ProviderModelSelector';

interface Props {
  node: FlowNode & { data: DiscussNodeData };
}

export function DiscussInspector({ node }: Props) {
  const { t } = useTranslation();
  const update = useWorkflowStore((s) => s.updateNodeData);
  const remove = useWorkflowStore((s) => s.removeNode);
  const d = node.data;

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

      <ProviderModelSelector
        provider={d.provider}
        model={d.model}
        onChange={(next) => update(node.id, next)}
        modelPlaceholder={false}
      />

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

      <Field label={t('discussInspector.openingLabel')}>
        <textarea
          className="input min-h-[80px] resize-y font-mono text-[11px]"
          value={d.openingPrompt}
          onChange={(e) => update(node.id, { openingPrompt: e.target.value })}
        />
        <div className="mt-1 text-[10px] text-muted">
          {t('discussInspector.openingHintPre')} <code>{'{{input}}'}</code>
          {t('discussInspector.openingHintMid')} <code>{'{{var.X}}'}</code>
        </div>
      </Field>

      <Field label={t('discussInspector.soulLabel')}>
        <MonacoSoul
          value={d.soul}
          onChange={(v) => update(node.id, { soul: v })}
          minHeight={240}
        />
      </Field>

      <button className="btn-danger w-full" onClick={() => remove(node.id)}>
        <Trash2 size={14} /> {t('inspector.deleteNode')}
      </button>
    </div>
  );
}
