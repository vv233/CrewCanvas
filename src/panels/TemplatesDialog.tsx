import { useState } from 'react';
import { X, Code2 } from 'lucide-react';
import { WORKFLOW_TEMPLATES } from '../templates/workflowTemplates';
import { useWorkflowStore } from '../state/workflowStore';
import { ImportTsDialog } from './ImportTsDialog';

interface Props {
  open: boolean;
  onClose: () => void;
}

export function TemplatesDialog({ open, onClose }: Props) {
  const load = useWorkflowStore((s) => s.loadWorkflow);
  const [tsOpen, setTsOpen] = useState(false);
  if (!open) return null;
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
          <div className="text-base font-semibold text-ink">从模板创建</div>
          <div className="flex items-center gap-2">
            <button
              className="btn-ghost"
              onClick={() => setTsOpen(true)}
              title="粘贴 TS 代码创建自定义模板"
            >
              <Code2 size={14} /> 从 TS 导入
            </button>
            <button className="btn-ghost" onClick={onClose}>
              <X size={16} />
            </button>
          </div>
        </div>
        <div className="grid gap-3 overflow-auto px-4 py-4 sm:grid-cols-2">
          {WORKFLOW_TEMPLATES.map((t) => (
            <button
              key={t.id}
              className="card flex flex-col gap-2 px-3 py-3 text-left transition-colors hover:border-accent"
              onClick={() => {
                if (
                  !confirm(
                    '加载模板会替换当前画布上的工作流，确定吗？（可先用顶栏"导出"备份）'
                  )
                )
                  return;
                load(t.build());
                onClose();
              }}
            >
              <div className="text-sm font-semibold text-ink">{t.name}</div>
              <div className="text-[12px] leading-relaxed text-muted">
                {t.description}
              </div>
            </button>
          ))}
        </div>
      </div>
      <ImportTsDialog open={tsOpen} onClose={() => setTsOpen(false)} />
    </div>
  );
}
