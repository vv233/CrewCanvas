import { Trash2 } from 'lucide-react';
import { useWorkflowStore } from '../state/workflowStore';
import type { FlowNode, TriggerNodeData } from '../types';

interface Props {
  node: FlowNode & { data: TriggerNodeData };
}

export function TriggerInspector({ node }: Props) {
  const update = useWorkflowStore((s) => s.updateNodeData);
  const remove = useWorkflowStore((s) => s.removeNode);
  const d = node.data;
  return (
    <div className="space-y-3">
      <div>
        <div className="label mb-1">名字</div>
        <input
          className="input"
          value={d.name}
          onChange={(e) => update(node.id, { name: e.target.value })}
        />
      </div>
      <div>
        <div className="label mb-1">输入（任务描述）</div>
        <textarea
          className="input min-h-[180px] resize-y text-[13px]"
          value={d.input}
          onChange={(e) => update(node.id, { input: e.target.value })}
          placeholder="点运行时，这段内容会作为 {{input}} 传给下游"
        />
      </div>
      <button className="btn-danger w-full" onClick={() => remove(node.id)}>
        <Trash2 size={14} /> 删除节点
      </button>
    </div>
  );
}
