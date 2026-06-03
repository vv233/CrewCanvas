import { Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useWorkflowStore } from '../state/workflowStore';
import type { EdgeType, FlowEdge } from '../types';
import { EDGE_STYLES, EDGE_TYPE_OPTIONS } from '../canvas/edges/edgeStyles';

interface Props {
  edge: FlowEdge;
}

export function EdgeInspector({ edge }: Props) {
  const { t } = useTranslation();
  const update = useWorkflowStore((s) => s.updateEdgeData);
  const remove = useWorkflowStore((s) => s.removeEdge);
  const d = edge.data ?? { type: 'pipe' as EdgeType };
  return (
    <div className="space-y-3">
      <div>
        <div className="label mb-1">{t('edges.comm')}</div>
        <div className="space-y-1">
          {EDGE_TYPE_OPTIONS.map((opt) => {
            const style = EDGE_STYLES[opt];
            const checked = d.type === opt;
            return (
              <label
                key={opt}
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
                  onChange={() => update(edge.id, { type: opt })}
                />
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span
                      className="inline-block h-0.5 w-5 rounded"
                      style={{ background: style.stroke }}
                    />
                    <span className="font-medium text-ink">{t(`edges.types.${opt}.label`)}</span>
                  </div>
                  <div className="text-[11px] text-muted">{t(`edges.types.${opt}.description`)}</div>
                </div>
              </label>
            );
          })}
        </div>
      </div>

      <div>
        <div className="label mb-1">{t('edges.labelOptional')}</div>
        <input
          className="input"
          value={d.label ?? ''}
          placeholder={t(`edges.types.${d.type}.label`)}
          onChange={(e) => update(edge.id, { label: e.target.value })}
        />
      </div>

      <div>
        <div className="label mb-1">{t('edges.transformOptional')}</div>
        <textarea
          className="input min-h-[80px] resize-y font-mono text-[12px]"
          value={d.transform ?? ''}
          placeholder={t('edges.transformPlaceholder', { token: '{{output}}' })}
          onChange={(e) => update(edge.id, { transform: e.target.value })}
        />
      </div>

      <button className="btn-danger w-full" onClick={() => remove(edge.id)}>
        <Trash2 size={14} /> {t('inspector.deleteEdge')}
      </button>
    </div>
  );
}
