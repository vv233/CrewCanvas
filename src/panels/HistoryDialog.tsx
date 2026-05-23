import { useEffect, useState } from 'react';
import { X, Trash2, ChevronRight, ChevronDown } from 'lucide-react';
import { deleteRun, loadRuns, type RunRecord } from '../storage/db';

interface Props {
  open: boolean;
  onClose: () => void;
}

const STATUS_COLOR: Record<RunRecord['status'], string> = {
  done: 'text-emerald-400',
  error: 'text-accent-danger',
  aborted: 'text-amber-400',
};

export function HistoryDialog({ open, onClose }: Props) {
  const [runs, setRuns] = useState<RunRecord[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    loadRuns().then(setRuns);
  }, [open]);

  const remove = async (id: string) => {
    await deleteRun(id);
    setRuns((r) => r.filter((x) => x.id !== id));
  };

  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="card flex max-h-[90vh] w-full max-w-4xl flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <div className="text-base font-semibold text-ink">运行历史</div>
          <button className="btn-ghost" onClick={onClose}>
            <X size={16} />
          </button>
        </div>
        <div className="flex-1 overflow-auto px-2 py-2">
          {runs.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted">
              暂无历史。运行工作流后会自动保存到这里（最多保留 200 条）。
            </div>
          ) : (
            <ul className="space-y-1">
              {runs.map((r) => {
                const expanded = expandedId === r.id;
                return (
                  <li key={r.id} className="rounded-md border border-line">
                    <div
                      className="flex cursor-pointer items-center gap-2 px-3 py-2 hover:bg-panel"
                      onClick={() => setExpandedId(expanded ? null : r.id)}
                    >
                      {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                      <span className="text-sm font-medium text-ink">
                        {r.workflowName}
                      </span>
                      <span className={`text-[11px] ${STATUS_COLOR[r.status]}`}>
                        {r.status}
                      </span>
                      <span className="text-[11px] text-muted">
                        {new Date(r.startedAt).toLocaleString()} ·{' '}
                        {Math.round((r.finishedAt - r.startedAt) / 100) / 10}s
                      </span>
                      <div className="flex-1" />
                      <button
                        className="rounded p-1 text-muted hover:bg-bg hover:text-accent-danger"
                        onClick={(e) => {
                          e.stopPropagation();
                          remove(r.id);
                        }}
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                    {expanded ? (
                      <div className="space-y-3 border-t border-line bg-bg px-3 py-3 text-[12px]">
                        <Section title="输入" body={r.triggerInput} />
                        <Section title="最终输出" body={r.finalOutput} />
                        <div>
                          <div className="label mb-1">各节点输出</div>
                          <div className="space-y-2">
                            {Object.values(r.nodeOutputs).map((n, i) => (
                              <div key={i} className="rounded bg-bg-soft p-2">
                                <div className="mb-1 flex items-center gap-2">
                                  <span className="font-medium text-ink">
                                    {n.name}
                                  </span>
                                  <span className="text-[10px] text-muted">
                                    {n.status}
                                  </span>
                                </div>
                                <pre className="whitespace-pre-wrap break-words text-ink/80">
                                  {n.output || '(空)'}
                                </pre>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function Section({ title, body }: { title: string; body: string }) {
  return (
    <div>
      <div className="label mb-1">{title}</div>
      <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-words rounded bg-bg-soft p-2 text-ink/80">
        {body || '(空)'}
      </pre>
    </div>
  );
}
