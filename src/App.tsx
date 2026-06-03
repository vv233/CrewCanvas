import { useEffect, useRef, useState } from 'react';
import { FlowCanvas } from './canvas/FlowCanvas';
import { NodePalette } from './canvas/NodePalette';
import { Inspector } from './panels/Inspector';
import { TopBar } from './panels/TopBar';
import { RunConsole } from './panels/RunConsole';
import { SettingsDialog } from './panels/SettingsDialog';
import { TemplatesDialog } from './panels/TemplatesDialog';
import { HistoryDialog } from './panels/HistoryDialog';
import { FilesDialog } from './panels/FilesDialog';
import { RagLibraryDialog } from './panels/RagLibraryDialog';
import { useRunStore } from './state/runStore';
import { useWorkflowStore } from './state/workflowStore';
import { runWorkflow, type RunHandle } from './engine/scheduler';
import { migrateLegacyKnowledge } from './rag/store';
import { nanoid } from 'nanoid';
import { useTranslation } from 'react-i18next';

export default function App() {
  const { t } = useTranslation();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [filesOpen, setFilesOpen] = useState(false);
  const [ragLibraryOpen, setRagLibraryOpen] = useState(false);
  const runRef = useRef<RunHandle | null>(null);

  const handleRun = async () => {
    if (useRunStore.getState().isRunning) return;
    const wf = useWorkflowStore.getState().workflow;
    if (wf.nodes.length === 0) {
      alert(t('app.noNodes'));
      return;
    }
    useRunStore.getState().beginRun(nanoid());
    useRunStore.getState().log('info', t('app.runStart', { name: wf.name }));
    const handle = runWorkflow(wf);
    runRef.current = handle;
    try {
      await handle.promise;
    } finally {
      runRef.current = null;
      useRunStore.getState().endRun();
    }
  };

  const handleStop = () => {
    runRef.current?.abort();
    useRunStore.getState().log('warn', t('app.runAborted'));
    useRunStore.getState().endRun();
  };

  const migrationSignature = useWorkflowStore((s) =>
    [
      s.workflow.id,
      ...s.workflow.nodes
        .filter((n) => n.data.kind === 'agent')
        .map((n) => {
          const files =
            (n.data as { knowledge?: { files?: { id: string }[] } }).knowledge
              ?.files ?? [];
          return `${n.id}:${files.map((f) => f.id).join(',')}`;
        }),
    ].join('|')
  );

  useEffect(() => {
    const wf = useWorkflowStore.getState().workflow;
    migrateLegacyKnowledge(wf).catch(console.error);
  }, [migrationSignature]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tgt = e.target as HTMLElement | null;
      // Skip when typing in an input / textarea / contenteditable / Monaco editor.
      if (
        tgt &&
        (tgt.tagName === 'INPUT' ||
          tgt.tagName === 'TEXTAREA' ||
          tgt.isContentEditable ||
          tgt.closest('.monaco-editor'))
      )
        return;
      const meta = e.metaKey || e.ctrlKey;
      if (!meta) return;
      const k = e.key.toLowerCase();
      if (k === 'z' && !e.shiftKey) {
        e.preventDefault();
        useWorkflowStore.getState().undo();
      } else if ((k === 'z' && e.shiftKey) || k === 'y') {
        e.preventDefault();
        useWorkflowStore.getState().redo();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="flex h-full w-full flex-col">
      <TopBar
        onOpenSettings={() => setSettingsOpen(true)}
        onOpenTemplates={() => setTemplatesOpen(true)}
        onOpenHistory={() => setHistoryOpen(true)}
        onOpenFiles={() => setFilesOpen(true)}
        onOpenRagLibrary={() => setRagLibraryOpen(true)}
        onRun={handleRun}
        onStop={handleStop}
      />
      <div className="flex min-h-0 flex-1">
        <NodePalette />
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="min-h-0 flex-1">
            <FlowCanvas />
          </div>
          <RunConsole />
        </div>
        <Inspector />
      </div>
      <SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <TemplatesDialog open={templatesOpen} onClose={() => setTemplatesOpen(false)} />
      <HistoryDialog open={historyOpen} onClose={() => setHistoryOpen(false)} />
      <FilesDialog open={filesOpen} onClose={() => setFilesOpen(false)} />
      <RagLibraryDialog open={ragLibraryOpen} onClose={() => setRagLibraryOpen(false)} />
    </div>
  );
}
