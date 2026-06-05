import { X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useWorkflowStore } from '../state/workflowStore';
import { RagSourcesPanel } from './RagSourcesPanel';

interface Props {
  open: boolean;
  onClose: () => void;
}

export function RagLibraryDialog({ open, onClose }: Props) {
  const { t } = useTranslation();
  const workflow = useWorkflowStore((s) => s.workflow);
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-stretch justify-center bg-black/60 p-0 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="card flex h-full max-h-none w-full max-w-5xl flex-col rounded-none sm:h-auto sm:max-h-[90vh] sm:rounded-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-2 border-b border-line px-4 py-3">
          <div className="min-w-0">
            <div className="text-base font-semibold text-ink">{t('ragLibrary.title')}</div>
            <div className="text-[11px] text-muted">
              {t('ragLibrary.currentWorkflow', { name: workflow.name })}
            </div>
          </div>
          <button className="btn-ghost" onClick={onClose}>
            <X size={16} />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-auto p-4">
          <RagSourcesPanel workflowId={workflow.id} scope="shared" title={t('rag.sharedLibrary')} />
        </div>
      </div>
    </div>
  );
}
