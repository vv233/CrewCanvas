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
  Languages,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useWorkflowStore } from '../state/workflowStore';
import { useRunStore } from '../state/runStore';
import { useSettingsStore } from '../state/settingsStore';
import { setLanguage, type Language } from '../i18n';
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
  const { t } = useTranslation();
  const workflow = useWorkflowStore((s) => s.workflow);
  const setName = useWorkflowStore((s) => s.setWorkflowName);
  const reset = useWorkflowStore((s) => s.resetWorkflow);
  const load = useWorkflowStore((s) => s.loadWorkflow);
  const undo = useWorkflowStore((s) => s.undo);
  const redo = useWorkflowStore((s) => s.redo);
  const canUndo = useWorkflowStore((s) => s.past.length > 0);
  const canRedo = useWorkflowStore((s) => s.future.length > 0);
  const isRunning = useRunStore((s) => s.isRunning);
  const language = useSettingsStore((s) => s.language);
  const updateSettings = useSettingsStore((s) => s.update);

  const toggleLanguage = () => {
    const next: Language = language === 'en' ? 'zh' : 'en';
    setLanguage(next);
    updateSettings({ language: next });
  };

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
        alert(t('topbar.importFailed', { msg: (err as Error).message }));
      }
    };
    input.click();
  };

  return (
    <div className="flex h-12 shrink-0 items-center gap-2 border-b border-line bg-bg-soft px-3">
      <div className="flex items-center gap-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-accent text-white text-xs font-bold">CC</div>
        <span className="text-sm font-semibold text-ink">CrewCanvas</span>
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
        title={t('topbar.undo')}
      >
        <Undo2 size={14} />
      </button>
      <button
        className="btn-ghost h-8 px-2 disabled:opacity-40"
        onClick={redo}
        disabled={!canRedo}
        title={t('topbar.redo')}
      >
        <Redo2 size={14} />
      </button>
      <div className="flex-1" />
      <button className="btn-ghost" onClick={onOpenTemplates} title={t('topbar.templatesTitle')}>
        <LayoutTemplate size={14} /> {t('topbar.templates')}
      </button>
      <button className="btn-ghost" onClick={onOpenFiles} title={t('topbar.filesTitle')}>
        <FolderOpen size={14} /> {t('topbar.files')}
      </button>
      <button className="btn-ghost" onClick={onOpenRagLibrary} title={t('topbar.ragLibraryTitle')}>
        <Database size={14} /> {t('topbar.ragLibrary')}
      </button>
      <button className="btn-ghost" onClick={onOpenHistory} title={t('topbar.historyTitle')}>
        <HistoryIcon size={14} /> {t('topbar.history')}
      </button>
      <button className="btn-ghost" onClick={handleImport} title={t('topbar.importTitle')}>
        <Upload size={14} /> {t('topbar.import')}
      </button>
      <button
        className="btn-ghost"
        onClick={() => {
          exportWorkflowJSON(workflow).catch((err) => {
            alert(t('topbar.exportFailed', { msg: err instanceof Error ? err.message : String(err) }));
          });
        }}
        title={t('topbar.exportTitle')}
      >
        <Download size={14} /> {t('topbar.export')}
      </button>
      <button
        className="btn-ghost"
        onClick={() => {
          if (confirm(t('topbar.resetConfirm'))) reset();
        }}
        title={t('topbar.resetTitle')}
      >
        <RotateCcw size={14} />
      </button>
      <button className="btn-ghost" onClick={onOpenSettings}>
        <SettingsIcon size={14} /> {t('topbar.settings')}
      </button>
      <button
        className="btn-ghost"
        onClick={toggleLanguage}
        title={t('topbar.language')}
      >
        <Languages size={14} /> {language === 'en' ? '中文' : 'EN'}
      </button>
      {isRunning ? (
        <button className="btn-danger" onClick={onStop}>
          <Square size={14} /> {t('topbar.stop')}
        </button>
      ) : (
        <button className="btn-primary" onClick={onRun}>
          <Play size={14} /> {t('topbar.run')}
        </button>
      )}
    </div>
  );
}
