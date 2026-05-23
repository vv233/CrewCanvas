import { Trash2 } from 'lucide-react';
import { useWorkflowStore } from '../state/workflowStore';
import type { FlowNode, RouterNodeData } from '../types';

interface Props {
  node: FlowNode & { data: RouterNodeData };
}

export function RouterInspector({ node }: Props) {
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
        <div className="label mb-1">分流规则</div>
        <select
          className="input"
          value={d.rule}
          onChange={(e) =>
            update(node.id, { rule: e.target.value as RouterNodeData['rule'] })
          }
        >
          <option value="llm-judge">AI 判断（让模型选分支）</option>
          <option value="regex">正则匹配</option>
        </select>
      </div>
      {d.rule === 'regex' ? (
        <div>
          <div className="label mb-1">正则 pattern</div>
          <input
            className="input font-mono"
            value={d.pattern}
            onChange={(e) => update(node.id, { pattern: e.target.value })}
            placeholder="^是$"
          />
        </div>
      ) : null}
      <button className="btn-danger w-full" onClick={() => remove(node.id)}>
        <Trash2 size={14} /> 删除节点
      </button>
    </div>
  );
}
