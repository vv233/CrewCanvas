import { useState } from 'react';
import { X, Download } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { WorkflowExportOptions } from '../storage/exporter';

interface Props {
  open: boolean;
  onClose: () => void;
  onExport: (opts: WorkflowExportOptions) => void;
}

export function ExportDialog({ open, onClose, onExport }: Props) {
  const { t } = useTranslation();
  const [includeKnowledge, setIncludeKnowledge] = useState(true);
  const [includeSensitive, setIncludeSensitive] = useState(false);

  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3 sm:p-4"
      onClick={onClose}
    >
      <div className="card w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <div className="text-base font-semibold text-ink">{t('exportDialog.title')}</div>
          <button className="btn-ghost" onClick={onClose}>
            <X size={16} />
          </button>
        </div>
        <div className="space-y-3 px-4 py-4">
          <label className="flex cursor-pointer items-start gap-2">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={includeKnowledge}
              onChange={(e) => setIncludeKnowledge(e.target.checked)}
            />
            <span>
              <span className="text-sm text-ink">{t('exportDialog.includeKnowledge')}</span>
              <span className="mt-0.5 block text-[11px] text-muted">
                {t('exportDialog.includeKnowledgeDesc')}
              </span>
            </span>
          </label>
          <label className="flex cursor-pointer items-start gap-2">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={includeSensitive}
              onChange={(e) => setIncludeSensitive(e.target.checked)}
            />
            <span>
              <span className="text-sm text-ink">{t('exportDialog.includeSensitive')}</span>
              <span className="mt-0.5 block text-[11px] text-amber-200/80">
                {t('exportDialog.includeSensitiveDesc')}
              </span>
            </span>
          </label>
        </div>
        <div className="flex flex-wrap justify-end gap-2 border-t border-line px-4 py-3">
          <button className="btn-ghost" onClick={onClose}>
            {t('exportDialog.cancel')}
          </button>
          <button
            className="btn-primary"
            onClick={() => onExport({ includeKnowledge, includeSensitive })}
          >
            <Download size={14} /> {t('exportDialog.export')}
          </button>
        </div>
      </div>
    </div>
  );
}
