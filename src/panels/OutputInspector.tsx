import { Trash2 } from 'lucide-react';
import { useWorkflowStore } from '../state/workflowStore';
import type { FlowNode, OutputNodeData } from '../types';

interface Props {
  node: FlowNode & { data: OutputNodeData };
}

export function OutputInspector({ node }: Props) {
  const update = useWorkflowStore((s) => s.updateNodeData);
  const remove = useWorkflowStore((s) => s.removeNode);
  return (
    <div className="space-y-3">
      <div>
        <div className="label mb-1">名字</div>
        <input
          className="input"
          value={node.data.name}
          onChange={(e) => update(node.id, { name: e.target.value })}
        />
      </div>
      <button className="btn-danger w-full" onClick={() => remove(node.id)}>
        <Trash2 size={14} /> 删除节点
      </button>
    </div>
  );
}
