import { useState } from 'react';
import { X, Play, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { MonacoSoul } from '../lib/MonacoSoul';
import {
  compileTemplateSource,
  EXAMPLE_TEMPLATE_TS,
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
  const [src, setSrc] = useState(EXAMPLE_TEMPLATE_TS);
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
    if (
      !confirm(
        '加载会替换当前画布上的工作流，确定吗？（可先在顶栏"导出"备份）'
      )
    )
      return;
    try {
      const wf = status.template.build();
      load(wf);
      onClose();
    } catch (err) {
      setStatus({
        kind: 'fail',
        message: `build() 抛出异常: ${
          err instanceof Error ? err.message : String(err)
        }`,
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
          <div className="text-base font-semibold text-ink">从 TS 代码导入模板</div>
          <button className="btn-ghost" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-auto p-4">
          <div className="rounded border border-amber-400/30 bg-amber-400/5 p-2 text-[11px] leading-relaxed text-amber-200/90">
            <strong>⚠️ 安全提示</strong>：编译后的 JS 会在你的浏览器里执行。
            只导入你自己写的或来自可信来源的代码——恶意脚本可以读取你的
            API key（localStorage）。
          </div>

          <div className="rounded border border-line bg-bg-soft p-2 text-[11px] text-muted">
            <div className="mb-1 font-semibold text-ink">约定</div>
            <ul className="list-disc space-y-0.5 pl-4">
              <li>
                <code>export default</code> 一个含{' '}
                <code>{'{ id, name, description?, build() }'}</code> 的对象
              </li>
              <li>
                可用全局：<code>nanoid</code>、<code>defaultNodeData</code>、
                <code>SOUL_PRESETS</code>、<code>presetAgent</code>
              </li>
              <li>不能写 <code>import</code> 语句（会被剥离）</li>
              <li>TS 类型注解会被剥离，不做类型检查</li>
            </ul>
          </div>

          <MonacoSoul value={src} onChange={setSrc} minHeight={360} />

          {status.kind === 'ok' ? (
            <div className="flex items-start gap-2 rounded border border-emerald-400/30 bg-emerald-400/5 p-2 text-[12px] text-emerald-200/90">
              <CheckCircle2 size={14} className="mt-0.5 shrink-0" />
              <div>
                编译成功：
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
            取消
          </button>
          <button
            className="btn-ghost"
            onClick={compile}
            disabled={status.kind === 'compiling'}
          >
            {status.kind === 'compiling' ? (
              <Loader2 size={14} className="animate-spin" />
            ) : null}
            编译
          </button>
          <button
            className="btn-primary"
            onClick={loadToCanvas}
            disabled={status.kind !== 'ok'}
          >
            <Play size={14} /> 加载到画布
          </button>
        </div>
      </div>
    </div>
  );
}
