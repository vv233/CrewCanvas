import { Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useWorkflowStore } from '../state/workflowStore';
import type { FlowNode, OutputNodeData } from '../types';

interface Props {
  node: FlowNode & { data: OutputNodeData };
}

export function OutputInspector({ node }: Props) {
  const { t } = useTranslation();
  const update = useWorkflowStore((s) => s.updateNodeData);
  const remove = useWorkflowStore((s) => s.removeNode);
  return (
    <div className="space-y-3">
      <div>
        <div className="label mb-1">{t('inspector.name')}</div>
        <input
          className="input"
          value={node.data.name}
          onChange={(e) => update(node.id, { name: e.target.value })}
        />
      </div>
      <button className="btn-danger w-full" onClick={() => remove(node.id)}>
        <Trash2 size={14} /> {t('inspector.deleteNode')}
      </button>
    </div>
  );
}
