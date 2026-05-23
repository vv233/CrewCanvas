import {
  Play,
  Square,
  Settings as SettingsIcon,
  RotateCcw,
  Download,
  Upload,
  LayoutTemplate,
  History as HistoryIcon,
  Undo2,
  Redo2,
  FolderOpen,
  Database,
} from 'lucide-react';
import { useWorkflowStore } from '../state/workflowStore';
import { useRunStore } from '../state/runStore';
import { exportWorkflowJSON, importWorkflowJSON } from '../storage/exporter';

interface Props {
  onOpenSettings: () => void;
  onOpenTemplates: () => void;
  onOpenHistory: () => void;
  onOpenFiles: () => void;
  onOpenRagLibrary: () => void;
  onRun: () => void;
  onStop: () => void;
}

export function TopBar({
  onOpenSettings,
  onOpenTemplates,
  onOpenHistory,
  onOpenFiles,
  onOpenRagLibrary,
  onRun,
  onStop,
}: Props) {
  const workflow = useWorkflowStore((s) => s.workflow);
  const setName = useWorkflowStore((s) => s.setWorkflowName);
  const reset = useWorkflowStore((s) => s.resetWorkflow);
  const load = useWorkflowStore((s) => s.loadWorkflow);
  const undo = useWorkflowStore((s) => s.undo);
  const redo = useWorkflowStore((s) => s.redo);
  const canUndo = useWorkflowStore((s) => s.past.length > 0);
  const canRedo = useWorkflowStore((s) => s.future.length > 0);
  const isRunning = useRunStore((s) => s.isRunning);

  const handleImport = async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const wf = await importWorkflowJSON(text);
        load(wf);
      } catch (err) {
        alert('导入失败：' + (err as Error).message);
      }
    };
    input.click();
  };

  return (
    <div className="flex h-12 shrink-0 items-center gap-2 border-b border-line bg-bg-soft px-3">
      <div className="flex items-center gap-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-accent text-white text-xs font-bold">
          AI
        </div>
        <span className="text-sm font-semibold text-ink">Org Flow</span>
      </div>
      <div className="mx-3 h-5 w-px bg-line" />
      <input
        className="rounded px-2 py-1 text-sm font-medium text-ink bg-transparent hover:bg-panel focus:bg-panel focus:outline-none"
        value={workflow.name}
        onChange={(e) => setName(e.target.value)}
        style={{ width: '14rem' }}
      />
      <button
        className="btn-ghost h-8 px-2 disabled:opacity-40"
        onClick={undo}
        disabled={!canUndo}
        title="撤销 (Ctrl/Cmd+Z)"
      >
        <Undo2 size={14} />
      </button>
      <button
        className="btn-ghost h-8 px-2 disabled:opacity-40"
        onClick={redo}
        disabled={!canRedo}
        title="重做 (Ctrl/Cmd+Shift+Z)"
      >
        <Redo2 size={14} />
      </button>
      <div className="flex-1" />
      <button className="btn-ghost" onClick={onOpenTemplates} title="模板库">
        <LayoutTemplate size={14} /> 模板
      </button>
      <button className="btn-ghost" onClick={onOpenFiles} title="工作流共享文件夹">
        <FolderOpen size={14} /> 文件
      </button>
      <button className="btn-ghost" onClick={onOpenRagLibrary} title="RAG 资料库">
        <Database size={14} /> 资料库
      </button>
      <button className="btn-ghost" onClick={onOpenHistory} title="运行历史">
        <HistoryIcon size={14} /> 历史
      </button>
      <button className="btn-ghost" onClick={handleImport} title="导入工作流 JSON">
        <Upload size={14} /> 导入
      </button>
      <button
        className="btn-ghost"
        onClick={() => {
          exportWorkflowJSON(workflow).catch((err) => {
            alert('导出失败：' + (err instanceof Error ? err.message : String(err)));
          });
        }}
        title="导出工作流 JSON"
      >
        <Download size={14} /> 导出
      </button>
      <button
        className="btn-ghost"
        onClick={() => {
          if (confirm('确定重置为初始示例工作流？当前工作将丢失。')) reset();
        }}
        title="重置"
      >
        <RotateCcw size={14} />
      </button>
      <button className="btn-ghost" onClick={onOpenSettings}>
        <SettingsIcon size={14} /> 设置
      </button>
      {isRunning ? (
        <button className="btn-danger" onClick={onStop}>
          <Square size={14} /> 停止
        </button>
      ) : (
        <button className="btn-primary" onClick={onRun}>
          <Play size={14} /> 运行
        </button>
      )}
    </div>
  );
}
