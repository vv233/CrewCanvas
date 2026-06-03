import { Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useWorkflowStore } from '../state/workflowStore';
import type { AggregatorNodeData, FlowNode } from '../types';

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
      <button className="btn-danger w-full" onClick={() => remove(node.id)}>
        <Trash2 size={14} /> {t('inspector.deleteNode')}
      </button>
    </div>
  );
}
