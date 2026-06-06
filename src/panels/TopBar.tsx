import { useState } from 'react';
import {
  Play,
  Square,
  Settings as SettingsIcon,
  RotateCcw,
  Download,
  Upload,
  UserPlus,
  LayoutTemplate,
  History as HistoryIcon,
  Undo2,
  Redo2,
  FolderOpen,
  Database,
  Languages,
  PanelLeftOpen,
  PanelRightOpen,
  Target as TargetIcon,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useWorkflowStore } from '../state/workflowStore';
import { useRunStore } from '../state/runStore';
import { useSettingsStore } from '../state/settingsStore';
import { setLanguage, type Language } from '../i18n';
import {
  exportWorkflowJSON,
  importWorkflowJSON,
  type WorkflowExportOptions,
} from '../storage/exporter';
import {
  parseRoleCards,
  roleCardToAgentData,
  applyRoleCardLibrary,
  type RoleCard,
} from '../storage/roleCard';
import { ExportDialog } from './ExportDialog';

interface Props {
  onOpenSettings: () => void;
  onOpenTemplates: () => void;
  onOpenHistory: () => void;
  onOpenFiles: () => void;
  onOpenRagLibrary: () => void;
  onOpenTarget: () => void;
  onTogglePalette: () => void;
  onToggleInspector: () => void;
  paletteOpen: boolean;
  inspectorOpen: boolean;
  onRun: () => void;
  onStop: () => void;
}

export function TopBar({
  onOpenSettings,
  onOpenTemplates,
  onOpenHistory,
  onOpenFiles,
  onOpenRagLibrary,
  onOpenTarget,
  onTogglePalette,
  onToggleInspector,
  paletteOpen,
  inspectorOpen,
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
  const addAgentNodes = useWorkflowStore((s) => s.addAgentNodes);
  const isRunning = useRunStore((s) => s.isRunning);
  const language = useSettingsStore((s) => s.language);
  const updateSettings = useSettingsStore((s) => s.update);
  const [exportOpen, setExportOpen] = useState(false);

  const toggleLanguage = () => {
    const next: Language = language === 'en' ? 'zh' : 'en';
    setLanguage(next);
    updateSettings({ language: next });
  };

  const handleExport = (opts: WorkflowExportOptions) => {
    setExportOpen(false);
    exportWorkflowJSON(workflow, opts).catch((err) => {
      alert(t('topbar.exportFailed', { msg: err instanceof Error ? err.message : String(err) }));
    });
  };

  const handleImportRoleCards = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json';
    input.multiple = true;
    input.onchange = async () => {
      const files = Array.from(input.files ?? []);
      if (files.length === 0) return;
      const cards: RoleCard[] = [];
      for (const file of files) {
        try {
          cards.push(...parseRoleCards(await file.text()));
        } catch {
          /* skip files that aren't valid role-card JSON */
        }
      }
      if (cards.length === 0) {
        alert(t('topbar.roleCardNone'));
        return;
      }
      const ids = addAgentNodes(cards.map(roleCardToAgentData));
      const wfId = useWorkflowStore.getState().workflow.id;
      await Promise.all(cards.map((c, i) => applyRoleCardLibrary(c, wfId, ids[i])));
      alert(t('topbar.roleCardImported', { count: cards.length }));
    };
    input.click();
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
    <div className="px-safe flex min-h-12 shrink-0 items-center gap-2 overflow-x-auto whitespace-nowrap border-b border-line bg-bg-soft px-3 py-2 lg:h-12 lg:py-0">
      <div className="flex shrink-0 items-center gap-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-accent text-xs font-bold text-white">CC</div>
        <span className="hidden text-sm font-semibold text-ink sm:inline">CrewCanvas</span>
      </div>
      <button
        className="btn-ghost h-8 px-2 lg:hidden"
        onClick={onTogglePalette}
        title={t('topbar.nodes')}
        aria-label={t('topbar.nodes')}
        aria-pressed={paletteOpen}
      >
        <PanelLeftOpen size={14} />
      </button>
      <button
        className="btn-ghost h-8 px-2 lg:hidden"
        onClick={onToggleInspector}
        title={t('topbar.inspector')}
        aria-label={t('topbar.inspector')}
        aria-pressed={inspectorOpen}
      >
        <PanelRightOpen size={14} />
      </button>
      <div className="hidden h-5 w-px shrink-0 bg-line sm:block" />
      <input
        className="w-36 shrink-0 rounded bg-transparent px-2 py-1 text-sm font-medium text-ink hover:bg-panel focus:bg-panel focus:outline-none sm:w-56"
        value={workflow.name}
        onChange={(e) => setName(e.target.value)}
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
      <div className="hidden flex-1 lg:block" />
      <button className="btn-ghost" onClick={onOpenTemplates} title={t('topbar.templatesTitle')}>
        <LayoutTemplate size={14} /> <span className="hidden xl:inline">{t('topbar.templates')}</span>
      </button>
      <button className="btn-ghost" onClick={onOpenFiles} title={t('topbar.filesTitle')}>
        <FolderOpen size={14} /> <span className="hidden xl:inline">{t('topbar.files')}</span>
      </button>
      <button className="btn-ghost" onClick={onOpenRagLibrary} title={t('topbar.ragLibraryTitle')}>
        <Database size={14} /> <span className="hidden xl:inline">{t('topbar.ragLibrary')}</span>
      </button>
      <button className="btn-ghost" onClick={onOpenHistory} title={t('topbar.historyTitle')}>
        <HistoryIcon size={14} /> <span className="hidden xl:inline">{t('topbar.history')}</span>
      </button>
      <button className="btn-ghost" onClick={onOpenTarget} title={t('topbar.targetTitle')}>
        <TargetIcon size={14} /> <span className="hidden xl:inline">{t('topbar.target')}</span>
      </button>
      <button
        className="btn-ghost"
        onClick={handleImportRoleCards}
        title={t('topbar.importRoleCardTitle')}
      >
        <UserPlus size={14} /> <span className="hidden xl:inline">{t('topbar.importRoleCard')}</span>
      </button>
      <button className="btn-ghost" onClick={handleImport} title={t('topbar.importTitle')}>
        <Upload size={14} /> <span className="hidden xl:inline">{t('topbar.import')}</span>
      </button>
      <button
        className="btn-ghost"
        onClick={() => setExportOpen(true)}
        title={t('topbar.exportTitle')}
      >
        <Download size={14} /> <span className="hidden xl:inline">{t('topbar.export')}</span>
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
        <SettingsIcon size={14} /> <span className="hidden xl:inline">{t('topbar.settings')}</span>
      </button>
      <button
        className="btn-ghost"
        onClick={toggleLanguage}
        title={t('topbar.language')}
      >
        <Languages size={14} /> {language === 'en' ? '中文' : 'EN'}
      </button>
      {isRunning ? (
        <button
          className="btn-danger sticky right-0 z-10 shrink-0 shadow-[-10px_0_14px_rgba(17,20,27,0.9)]"
          onClick={onStop}
        >
          <Square size={14} /> <span>{t('topbar.stop')}</span>
        </button>
      ) : (
        <button
          className="btn-primary sticky right-0 z-10 shrink-0 shadow-[-10px_0_14px_rgba(17,20,27,0.9)]"
          onClick={onRun}
        >
          <Play size={14} /> <span>{t('topbar.run')}</span>
        </button>
      )}
      <ExportDialog
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        onExport={handleExport}
      />
    </div>
  );
}
