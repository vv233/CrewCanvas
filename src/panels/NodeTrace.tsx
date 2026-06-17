import { memo, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useRunStore } from '../state/runStore';

/** Read-only view of what a node actually received and did during the last run:
 *  the real system prompt + user message sent to the model, the upstream inputs
 *  (with edge types), RAG status, advertised tools, and every tool call. Closes
 *  the gap between the drawn graph and what really executed. */
export const NodeTrace = memo(function NodeTrace({ nodeId }: { nodeId: string }) {
  const { t } = useTranslation();
  const trace = useRunStore((s) => s.nodeTraces[nodeId]);
  if (!trace) return null;

  const upstreams = trace.upstreams ?? [];
  const toolCalls = trace.toolCalls ?? [];
  const toolsOffered = trace.toolsOffered ?? [];

  return (
    <div className="mt-4 space-y-2 border-t border-line pt-3">
      <div className="flex items-center justify-between gap-2">
        <div className="label">{t('trace.title')}</div>
        {(trace.provider || trace.model) && (
          <span className="truncate font-mono text-[10px] text-muted">
            {trace.provider}/{trace.model}
          </span>
        )}
      </div>
      {trace.trimmed && (
        <div className="text-[10px] text-amber-400">⚠ {t('trace.trimmed')}</div>
      )}

      <Section title={`${t('trace.upstreams')} (${upstreams.length})`}>
        {upstreams.length === 0 ? (
          <div className="text-[11px] text-muted">{t('trace.noUpstreams')}</div>
        ) : (
          upstreams.map((u, i) => (
            <div key={i} className="mb-1.5">
              <div className="mb-0.5 flex items-center gap-1 text-[10px]">
                <span className="rounded bg-bg px-1 font-mono text-accent">{u.type}</span>
                <span className="font-semibold text-ink">{u.name}</span>
              </div>
              <Pre>{u.text}</Pre>
            </div>
          ))
        )}
      </Section>

      <Section title={t('trace.systemPrompt')}>
        <Pre>{trace.systemPrompt}</Pre>
      </Section>
      <Section title={t('trace.userMessage')}>
        <Pre>{trace.userMessage}</Pre>
      </Section>

      <div className="text-[11px]">
        <span className="label">{t('trace.rag')}</span>{' '}
        <span className={trace.ragInjected ? 'text-emerald-400' : 'text-muted'}>
          {trace.ragInjected ? t('trace.ragHit') : t('trace.ragMiss')}
        </span>
      </div>

      {toolsOffered.length > 0 && (
        <div className="flex flex-wrap gap-1">
          <span className="label w-full">{t('trace.tools')}</span>
          {toolsOffered.map((n) => (
            <span key={n} className="rounded bg-bg px-1 font-mono text-[10px] text-muted">
              {n}
            </span>
          ))}
        </div>
      )}

      <Section title={`${t('trace.toolCalls')} (${toolCalls.length})`}>
        {toolCalls.length === 0 ? (
          <div className="text-[11px] text-muted">{t('trace.noToolCalls')}</div>
        ) : (
          toolCalls.map((c, i) => (
            <div key={i} className="mb-2">
              <div className="font-mono text-[11px]">
                <span className={c.isError ? 'text-rose-400' : 'text-accent'}>{c.name}</span>
              </div>
              <div className="mt-0.5 text-[10px] text-muted">{t('trace.args')}</div>
              <Pre>{c.args}</Pre>
              <div className="mt-0.5 text-[10px] text-muted">
                {c.isError ? t('trace.error') : t('trace.result')}
              </div>
              <Pre className={c.isError ? 'text-rose-300' : undefined}>{c.result}</Pre>
            </div>
          ))
        )}
      </Section>
    </div>
  );
});

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <details className="rounded border border-line bg-panel/40">
      <summary className="cursor-pointer select-none px-2 py-1 text-[11px] font-medium text-ink/80">
        {title}
      </summary>
      <div className="px-2 pb-2">{children}</div>
    </details>
  );
}

function Pre({ children, className }: { children?: ReactNode; className?: string }) {
  return (
    <pre
      className={`max-h-48 overflow-auto whitespace-pre-wrap break-words rounded bg-bg-soft px-2 py-1 text-[10px] leading-snug text-ink/80 ${
        className ?? ''
      }`}
    >
      {children || '—'}
    </pre>
  );
}
