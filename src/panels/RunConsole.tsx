import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronUp, ChevronDown, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useRunStore } from '../state/runStore';
import { useWorkflowStore } from '../state/workflowStore';

export function RunConsole() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(true);
  const logs = useRunStore((s) => s.logs);
  const nodeStateCount = useRunStore((s) => Object.keys(s.nodeStates).length);
  const resetAll = useRunStore((s) => s.resetAll);
  const workflowNodes = useWorkflowStore((s) => s.workflow.nodes);
  const scrollRef = useRef<HTMLDivElement>(null);

  const nodeNameById = useMemo(
    () => new Map(workflowNodes.map((n) => [n.id, n.data?.name as string | undefined])),
    [workflowNodes]
  );

  useEffect(() => {
    if (open && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs, open]);

  const nameOf = (id: string) => nodeNameById.get(id);

  return (
    <div className="pb-safe shrink-0 border-t border-line bg-bg-soft">
      <div
        className="flex min-h-9 cursor-pointer items-center justify-between gap-2 px-3 py-1 hover:bg-panel"
        onClick={() => setOpen(!open)}
      >
        <div className="flex min-w-0 items-center gap-2">
          <span className="shrink-0 text-xs font-medium uppercase tracking-wider text-muted">
            {t('runConsole.title')}
          </span>
          <span className="truncate text-[11px] text-muted">
            {t('runConsole.stats', { logs: logs.length, nodes: nodeStateCount })}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {logs.length > 0 ? (
            <button
              className="rounded p-1 text-muted hover:bg-bg hover:text-ink"
              onClick={(e) => {
                e.stopPropagation();
                resetAll();
              }}
              title={t('runConsole.clear')}
            >
              <Trash2 size={12} />
            </button>
          ) : null}
          {open ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
        </div>
      </div>
      {open ? (
        <div
          ref={scrollRef}
          className="h-32 overflow-auto px-3 py-2 font-mono text-[11px] leading-relaxed sm:h-44"
        >
          {logs.length === 0 ? (
            <div className="text-muted">{t('runConsole.empty')}</div>
          ) : (
            logs.map((l, i) => (
              <div key={i} className="grid grid-cols-[auto_auto_minmax(0,1fr)] gap-2">
                <span className="shrink-0 text-muted">
                  {new Date(l.ts).toLocaleTimeString()}
                </span>
                <span
                  className={
                    l.level === 'error'
                      ? 'text-accent-danger'
                      : l.level === 'warn'
                      ? 'text-amber-400'
                      : 'text-ink/80'
                  }
                >
                  {l.nodeId ? `[${nameOf(l.nodeId) ?? l.nodeId.slice(0, 6)}]` : '[engine]'}
                </span>
                <span className="whitespace-pre-wrap break-words text-ink/90">
                  {l.msg}
                </span>
              </div>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}
