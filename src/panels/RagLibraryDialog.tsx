import { X } from 'lucide-react';
import { useWorkflowStore } from '../state/workflowStore';
import { RagSourcesPanel } from './RagSourcesPanel';

interface Props {
  open: boolean;
  onClose: () => void;
}

export function RagLibraryDialog({ open, onClose }: Props) {
  const workflow = useWorkflowStore((s) => s.workflow);
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="card flex max-h-[90vh] w-full max-w-5xl flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <div>
            <div className="text-base font-semibold text-ink">资料库</div>
            <div className="text-[11px] text-muted">当前工作流：{workflow.name}</div>
          </div>
          <button className="btn-ghost" onClick={onClose}>
            <X size={16} />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-auto p-4">
          <RagSourcesPanel workflowId={workflow.id} scope="shared" title="共享资料库" />
        </div>
      </div>
    </div>
  );
}
