import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  FilePlus,
  FileText,
  Loader2,
  RefreshCw,
  Search,
  Trash2,
  Upload,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { RagScope, RagSourceRecord } from '../storage/db';
import {
  addRagSource,
  deleteRagSource,
  listRagSources,
  reindexRagSource,
} from '../rag/store';

const ACCEPTED_TEXT_TYPES = '.txt,.md,.csv,.json,.yaml,.yml,.html,.xml,.log,text/*';

interface Props {
  workflowId: string;
  scope: RagScope;
  agentNodeId?: string;
  title?: string;
  compact?: boolean;
}

export function RagSourcesPanel({
  workflowId,
  scope,
  agentNodeId,
  title: titleProp,
  compact = false,
}: Props) {
  const { t } = useTranslation();
  const title =
    titleProp ?? t(scope === 'shared' ? 'rag.sharedLibrary' : 'rag.privateLibrary');
  const [sources, setSources] = useState<RagSourceRecord[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [newOpen, setNewOpen] = useState(false);
  const [newName, setNewName] = useState(() => t('rag.defaultName'));
  const [newContent, setNewContent] = useState('');
  const [busy, setBusy] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async () => {
    if (!workflowId) return;
    const list = await listRagSources(workflowId, scope, agentNodeId);
    setSources(list);
    setSelectedId((prev) => (prev && list.some((s) => s.id === prev) ? prev : null));
  }, [agentNodeId, scope, workflowId]);

  useEffect(() => {
    refresh().catch(console.error);
  }, [refresh]);

  const selected = sources.find((s) => s.id === selectedId) ?? null;
  const totalChars = sources.reduce((n, s) => n + s.content.length, 0);

  const addText = async (name: string, content: string) => {
    setBusy(true);
    try {
      const created = await addRagSource({
        workflowId,
        scope,
        agentNodeId,
        name,
        content,
      });
      setSelectedId(created.id);
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  const onUpload = async (filelist: FileList | null) => {
    if (!filelist) return;
    setBusy(true);
    try {
      for (const file of Array.from(filelist)) {
        const content = await file.text().catch(() => '');
        await addRagSource({
          workflowId,
          scope,
          agentNodeId,
          name: file.name,
          content,
        });
      }
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  const createManual = async () => {
    await addText(newName || t('rag.defaultName'), newContent);
    setNewOpen(false);
    setNewName(t('rag.defaultName'));
    setNewContent('');
  };

  const remove = async (id: string) => {
    if (!confirm(t('rag.deleteConfirm'))) return;
    await deleteRagSource(id);
    await refresh();
  };

  const rebuild = async (id: string) => {
    setBusy(true);
    try {
      await reindexRagSource(id);
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <Search size={12} className="text-muted" />
            <span className="label">{title}</span>
          </div>
          <div className="text-[10px] text-muted">
            {t('rag.stats', { files: sources.length, chars: totalChars })}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            className="rounded p-1 text-muted hover:bg-panel hover:text-ink"
            onClick={() => setNewOpen((v) => !v)}
            title={t('rag.newTitle')}
          >
            <FilePlus size={12} />
          </button>
          <button
            className="rounded p-1 text-muted hover:bg-panel hover:text-ink"
            onClick={() => fileInputRef.current?.click()}
            title={t('rag.uploadTitle')}
            disabled={busy}
          >
            <Upload size={12} />
          </button>
          <button
            className="rounded p-1 text-muted hover:bg-panel hover:text-ink"
            onClick={() => refresh().catch(console.error)}
            title={t('common.refresh')}
          >
            <RefreshCw size={12} />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept={ACCEPTED_TEXT_TYPES}
            className="hidden"
            onChange={(e) => {
              onUpload(e.target.files).catch(console.error);
              e.target.value = '';
            }}
          />
        </div>
      </div>

      {newOpen ? (
        <div className="space-y-1.5 rounded border border-line bg-bg-soft p-2 text-[11px]">
          <input
            className="input h-7 text-[11px] font-mono"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
          />
          <textarea
            className="input min-h-[96px] resize-y text-[11px] font-mono"
            value={newContent}
            onChange={(e) => setNewContent(e.target.value)}
          />
          <div className="flex justify-end gap-1">
            <button className="btn-ghost h-7 px-2 text-[11px]" onClick={() => setNewOpen(false)}>
              {t('common.cancel')}
            </button>
            <button className="btn-primary h-7 px-2 text-[11px]" onClick={createManual} disabled={busy}>
              {t('common.create')}
            </button>
          </div>
        </div>
      ) : null}

      {busy ? (
        <div className="flex items-center gap-1.5 rounded border border-line bg-bg-soft p-2 text-[11px] text-muted">
          <Loader2 size={12} className="animate-spin" /> {t('rag.processing')}
        </div>
      ) : null}

      {sources.length === 0 ? (
        <div className="rounded border border-dashed border-line p-3 text-center text-[11px] text-muted">
          {t('rag.empty')}
        </div>
      ) : (
        <div className={compact ? 'space-y-1' : 'grid min-h-0 gap-3 lg:grid-cols-[18rem_1fr]'}>
          <ul className="space-y-1">
            {sources.map((s) => (
              <li
                key={s.id}
                className={`flex cursor-pointer items-center gap-1.5 rounded border px-2 py-1.5 text-[12px] ${
                  selectedId === s.id
                    ? 'border-accent bg-panel'
                    : 'border-line bg-bg-soft hover:bg-panel'
                }`}
                onClick={() => setSelectedId(s.id)}
              >
                <FileText size={12} className="shrink-0 text-muted" />
                <span className="min-w-0 flex-1 truncate font-medium text-ink">{s.name}</span>
                <StatusIcon source={s} />
                <button
                  className="rounded p-0.5 text-muted hover:bg-bg hover:text-accent-danger"
                  onClick={(e) => {
                    e.stopPropagation();
                    remove(s.id).catch(console.error);
                  }}
                  title={t('common.delete')}
                >
                  <Trash2 size={11} />
                </button>
              </li>
            ))}
          </ul>

          {!compact && selected ? (
            <SourcePreview source={selected} onReindex={() => rebuild(selected.id)} />
          ) : null}
        </div>
      )}

      {compact && selected ? (
        <SourcePreview source={selected} onReindex={() => rebuild(selected.id)} compact />
      ) : null}
    </div>
  );
}

function StatusIcon({ source }: { source: RagSourceRecord }) {
  if (source.status === 'indexing') {
    return <Loader2 size={12} className="shrink-0 animate-spin text-muted" />;
  }
  if (source.status === 'error') {
    return <AlertCircle size={12} className="shrink-0 text-accent-danger" />;
  }
  return <CheckCircle2 size={12} className="shrink-0 text-emerald-400" />;
}

function SourcePreview({
  source,
  onReindex,
  compact = false,
}: {
  source: RagSourceRecord;
  onReindex: () => Promise<void>;
  compact?: boolean;
}) {
  const { t } = useTranslation();
  return (
    <div className="min-w-0 rounded border border-line bg-bg-soft">
      <div className="flex items-center gap-2 border-b border-line px-2 py-1.5 text-[11px]">
        <span className="min-w-0 flex-1 truncate font-mono text-ink">{source.name}</span>
        <span className="text-[10px] text-muted">{formatSize(source.size)}</span>
        <button className="btn-ghost h-7 px-2 text-[11px]" onClick={() => onReindex().catch(console.error)}>
          <RefreshCw size={11} /> {t('rag.rebuild')}
        </button>
      </div>
      {source.status === 'error' ? (
        <div className="p-2 text-[11px] text-accent-danger">
          {source.error || t('rag.indexFailed')}
        </div>
      ) : null}
      <pre
        className={`overflow-auto whitespace-pre-wrap break-words p-2 font-mono text-[11px] leading-relaxed text-ink/80 ${
          compact ? 'max-h-40' : 'max-h-[28rem]'
        }`}
      >
        {source.content || t('common.empty')}
      </pre>
    </div>
  );
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)}MB`;
}
