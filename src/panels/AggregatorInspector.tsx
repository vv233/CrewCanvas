import { Trash2 } from 'lucide-react';
import { useWorkflowStore } from '../state/workflowStore';
import type { AggregatorNodeData, FlowNode } from '../types';

interface Props {
  node: FlowNode & { data: AggregatorNodeData };
}

export function AggregatorInspector({ node }: Props) {
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
        <div className="label mb-1">汇总策略</div>
        <select
          className="input"
          value={d.strategy}
          onChange={(e) =>
            update(node.id, {
              strategy: e.target.value as AggregatorNodeData['strategy'],
            })
          }
        >
          <option value="concat">拼接（直接连起来）</option>
          <option value="json-merge">JSON 合并</option>
          <option value="pick-first">取第一个返回</option>
          <option value="summarize">AI 总结（需配置 agent）</option>
        </select>
      </div>
      <button className="btn-danger w-full" onClick={() => remove(node.id)}>
        <Trash2 size={14} /> 删除节点
      </button>
    </div>
  );
}
