import { useState } from 'react';
import { X, Play, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { MonacoSoul } from '../lib/MonacoSoul';
import {
  compileTemplateSource,
  exampleTemplateTs,
} from '../templates/importTs';
import { useWorkflowStore } from '../state/workflowStore';
import type { WorkflowTemplate } from '../templates/workflowTemplates';

interface Props {
  open: boolean;
  onClose: () => void;
}

type Status =
  | { kind: 'idle' }
  | { kind: 'compiling' }
  | { kind: 'ok'; template: WorkflowTemplate }
  | { kind: 'fail'; message: string };

export function ImportTsDialog({ open, onClose }: Props) {
  const { t } = useTranslation();
  const [src, setSrc] = useState(() => exampleTemplateTs());
  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  const load = useWorkflowStore((s) => s.loadWorkflow);

  if (!open) return null;

  const compile = async () => {
    setStatus({ kind: 'compiling' });
    try {
      const template = await compileTemplateSource(src);
      setStatus({ kind: 'ok', template });
    } catch (err) {
      setStatus({
        kind: 'fail',
        message: err instanceof Error ? err.message : String(err),
      });
    }
  };

  const loadToCanvas = () => {
    if (status.kind !== 'ok') return;
    if (!confirm(t('importTs.loadConfirm'))) return;
    try {
      const wf = status.template.build();
      load(wf);
      onClose();
    } catch (err) {
      setStatus({
        kind: 'fail',
        message: t('importTs.buildThrew', {
          msg: err instanceof Error ? err.message : String(err),
        }),
      });
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="card flex max-h-[90vh] w-full max-w-3xl flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <div className="text-base font-semibold text-ink">{t('importTs.title')}</div>
          <button className="btn-ghost" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-auto p-4">
          <div className="rounded border border-amber-400/30 bg-amber-400/5 p-2 text-[11px] leading-relaxed text-amber-200/90">
            <strong>⚠️ {t('importTs.securityTitle')}</strong> {t('importTs.securityBody')}
          </div>

          <div className="rounded border border-line bg-bg-soft p-2 text-[11px] text-muted">
            <div className="mb-1 font-semibold text-ink">{t('importTs.convTitle')}</div>
            <ul className="list-disc space-y-0.5 pl-4">
              <li>{t('importTs.conv1')}</li>
              <li>{t('importTs.conv2')}</li>
              <li>{t('importTs.conv3')}</li>
              <li>{t('importTs.conv4')}</li>
            </ul>
          </div>

          <MonacoSoul value={src} onChange={setSrc} minHeight={360} />

          {status.kind === 'ok' ? (
            <div className="flex items-start gap-2 rounded border border-emerald-400/30 bg-emerald-400/5 p-2 text-[12px] text-emerald-200/90">
              <CheckCircle2 size={14} className="mt-0.5 shrink-0" />
              <div>
                {t('importTs.compileOk')}{' '}
                <span className="font-semibold">{status.template.name}</span>
                {status.template.description ? (
                  <span className="ml-1 text-muted">
                    — {status.template.description}
                  </span>
                ) : null}
              </div>
            </div>
          ) : null}

          {status.kind === 'fail' ? (
            <div className="flex items-start gap-2 rounded border border-accent-danger/30 bg-accent-danger/5 p-2 text-[12px] text-accent-danger">
              <AlertCircle size={14} className="mt-0.5 shrink-0" />
              <pre className="whitespace-pre-wrap break-words font-mono text-[11px]">
                {status.message}
              </pre>
            </div>
          ) : null}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-line px-4 py-3">
          <button className="btn-ghost" onClick={onClose}>
            {t('common.cancel')}
          </button>
          <button
            className="btn-ghost"
            onClick={compile}
            disabled={status.kind === 'compiling'}
          >
            {status.kind === 'compiling' ? (
              <Loader2 size={14} className="animate-spin" />
            ) : null}
            {t('importTs.compile')}
          </button>
          <button
            className="btn-primary"
            onClick={loadToCanvas}
            disabled={status.kind !== 'ok'}
          >
            <Play size={14} /> {t('importTs.loadToCanvas')}
          </button>
        </div>
      </div>
    </div>
  );
}
