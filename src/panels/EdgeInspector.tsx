import { Trash2 } from 'lucide-react';
import { useWorkflowStore } from '../state/workflowStore';
import type { EdgeType, FlowEdge } from '../types';
import { EDGE_STYLES, EDGE_TYPE_OPTIONS } from '../canvas/edges/edgeStyles';

interface Props {
  edge: FlowEdge;
}

export function EdgeInspector({ edge }: Props) {
  const update = useWorkflowStore((s) => s.updateEdgeData);
  const remove = useWorkflowStore((s) => s.removeEdge);
  const d = edge.data ?? { type: 'pipe' as EdgeType };
  return (
    <div className="space-y-3">
      <div>
        <div className="label mb-1">沟通方式</div>
        <div className="space-y-1">
          {EDGE_TYPE_OPTIONS.map((t) => {
            const style = EDGE_STYLES[t];
            const checked = d.type === t;
            return (
              <label
                key={t}
                className={`flex cursor-pointer items-start gap-2 rounded-md border px-2 py-1.5 text-sm transition-colors ${
                  checked
                    ? 'border-accent bg-accent/10'
                    : 'border-line hover:border-line/80'
                }`}
              >
                <input
                  type="radio"
                  className="mt-0.5"
                  checked={checked}
                  onChange={() => update(edge.id, { type: t })}
                />
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span
                      className="inline-block h-0.5 w-5 rounded"
                      style={{ background: style.stroke }}
                    />
                    <span className="font-medium text-ink">{style.label}</span>
                  </div>
                  <div className="text-[11px] text-muted">{style.description}</div>
                </div>
              </label>
            );
          })}
        </div>
      </div>

      <div>
        <div className="label mb-1">标签（可选）</div>
        <input
          className="input"
          value={d.label ?? ''}
          placeholder={EDGE_STYLES[d.type].label}
          onChange={(e) => update(edge.id, { label: e.target.value })}
        />
      </div>

      <div>
        <div className="label mb-1">输出变换（可选）</div>
        <textarea
          className="input min-h-[80px] resize-y font-mono text-[12px]"
          value={d.transform ?? ''}
          placeholder="留空则透传，例：请评审：{{output}}"
          onChange={(e) => update(edge.id, { transform: e.target.value })}
        />
      </div>

      <button className="btn-danger w-full" onClick={() => remove(edge.id)}>
        <Trash2 size={14} /> 删除连线
      </button>
    </div>
  );
}
