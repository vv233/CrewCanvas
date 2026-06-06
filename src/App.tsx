import { ReactFlowProvider } from '@xyflow/react';
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
import { TargetDialog } from './panels/TargetDialog';
import { useRunStore } from './state/runStore';
import { useWorkflowStore } from './state/workflowStore';
import { runWorkflow, type RunHandle } from './engine/scheduler';
import { migrateLegacyKnowledge } from './rag/store';
import { nanoid } from 'nanoid';
import { useTranslation } from 'react-i18next';
import { useMediaQuery } from './lib/useMediaQuery';
import { useUiStore } from './state/uiStore';

export default function App() {
  const { t } = useTranslation();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [filesOpen, setFilesOpen] = useState(false);
  const [ragLibraryOpen, setRagLibraryOpen] = useState(false);
  const [targetOpen, setTargetOpen] = useState(false);
  const runRef = useRef<RunHandle | null>(null);
  const isLargeScreen = useMediaQuery('(min-width: 1024px)');
  const paletteOpen = useUiStore((s) => s.paletteOpen);
  const inspectorOpen = useUiStore((s) => s.inspectorOpen);
  const setPaletteOpen = useUiStore((s) => s.setPaletteOpen);
  const setInspectorOpen = useUiStore((s) => s.setInspectorOpen);
  const selectedNodeId = useWorkflowStore((s) => s.selectedNodeId);
  const selectedEdgeId = useWorkflowStore((s) => s.selectedEdgeId);

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
      const store = useWorkflowStore.getState();
      const k = e.key.toLowerCase();

      // Delete selected nodes/edges (no modifier).
      if (k === 'delete' || k === 'backspace') {
        e.preventDefault();
        store.removeSelected();
        return;
      }

      const meta = e.metaKey || e.ctrlKey;
      if (!meta) return;

      if (k === 'z' && !e.shiftKey) {
        e.preventDefault();
        store.undo();
      } else if ((k === 'z' && e.shiftKey) || k === 'y') {
        e.preventDefault();
        store.redo();
      } else if (k === 'c') {
        // Copy selected nodes — but let native text copy win if text is selected.
        if (window.getSelection()?.toString()) return;
        const copied = useUiStore.getState().copySelection();
        if (!copied) return;
        e.preventDefault();
      } else if (k === 'v') {
        if (useUiStore.getState().clipboard.length === 0) return;
        e.preventDefault();
        useUiStore.getState().pasteClipboard();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (!isLargeScreen) return;
    setPaletteOpen(false);
    setInspectorOpen(false);
  }, [isLargeScreen, setInspectorOpen, setPaletteOpen]);

  useEffect(() => {
    if (isLargeScreen || (!selectedNodeId && !selectedEdgeId)) return;
    setInspectorOpen(true);
  }, [isLargeScreen, selectedEdgeId, selectedNodeId, setInspectorOpen]);

  const closeMobilePanels = () => {
    setPaletteOpen(false);
    setInspectorOpen(false);
  };

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-bg pt-safe">
      <TopBar
        onOpenSettings={() => setSettingsOpen(true)}
        onOpenTemplates={() => setTemplatesOpen(true)}
        onOpenHistory={() => setHistoryOpen(true)}
        onOpenFiles={() => setFilesOpen(true)}
        onOpenRagLibrary={() => setRagLibraryOpen(true)}
        onOpenTarget={() => setTargetOpen(true)}
        onTogglePalette={() => setPaletteOpen(!paletteOpen)}
        onToggleInspector={() => setInspectorOpen(!inspectorOpen)}
        paletteOpen={paletteOpen}
        inspectorOpen={inspectorOpen}
        onRun={handleRun}
        onStop={handleStop}
      />
      <ReactFlowProvider>
        <div className="relative flex min-h-0 flex-1 overflow-hidden">
          {isLargeScreen ? <NodePalette /> : null}
          <div className="flex min-w-0 flex-1 flex-col">
            <div className="min-h-0 flex-1">
              <FlowCanvas />
            </div>
            <RunConsole />
          </div>
          {isLargeScreen ? <Inspector /> : null}

          {!isLargeScreen && (paletteOpen || inspectorOpen) ? (
            <div
              className="absolute inset-0 z-30 bg-black/45 backdrop-blur-[1px]"
              onClick={closeMobilePanels}
            />
          ) : null}
          {!isLargeScreen ? (
            <>
              <div
                className={`absolute inset-y-0 left-0 z-40 w-[min(18rem,86vw)] transform transition-transform duration-200 ${
                  paletteOpen ? 'translate-x-0' : 'pointer-events-none -translate-x-full'
                }`}
              >
                <NodePalette className="w-full shadow-2xl" onAddNode={closeMobilePanels} />
              </div>
              <div
                className={`absolute inset-y-0 right-0 z-40 w-[min(22rem,92vw)] transform transition-transform duration-200 ${
                  inspectorOpen ? 'translate-x-0' : 'pointer-events-none translate-x-full'
                }`}
              >
                <Inspector className="w-full shadow-2xl" />
              </div>
            </>
          ) : null}
        </div>
      </ReactFlowProvider>
      <SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <TemplatesDialog open={templatesOpen} onClose={() => setTemplatesOpen(false)} />
      <HistoryDialog open={historyOpen} onClose={() => setHistoryOpen(false)} />
      <FilesDialog open={filesOpen} onClose={() => setFilesOpen(false)} />
      <RagLibraryDialog open={ragLibraryOpen} onClose={() => setRagLibraryOpen(false)} />
      <TargetDialog open={targetOpen} onClose={() => setTargetOpen(false)} />
    </div>
  );
}
