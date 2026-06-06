import { Fragment, useCallback, useEffect, useState } from 'react';
import {
  ChevronRight,
  CornerUpLeft,
  X,
  RefreshCw,
  Upload,
  Download,
  Trash2,
  FilePlus,
  Folder,
  FileText,
} from 'lucide-react';
import {
  deleteEntry,
  downloadFile,
  listFiles,
  readFile,
  writeFile,
  type FsEntry,
} from '../fs/workflowFs';
import { useTranslation } from 'react-i18next';
import { useWorkflowStore } from '../state/workflowStore';

interface Props {
  open: boolean;
  onClose: () => void;
}

export function FilesDialog({ open, onClose }: Props) {
  const { t } = useTranslation();
  const workflow = useWorkflowStore((s) => s.workflow);
  const [currentPath, setCurrentPath] = useState('/');
  const [entries, setEntries] = useState<FsEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<FsEntry | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [previewTruncated, setPreviewTruncated] = useState(false);
  const [newOpen, setNewOpen] = useState(false);
  const [newPath, setNewPath] = useState('/');
  const [newContent, setNewContent] = useState('');

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const list = await listFiles(workflow.id, currentPath);
      setEntries(list);
    } catch (err) {
      console.error('listFiles error', err);
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, [workflow.id, currentPath]);

  useEffect(() => {
    if (open) {
      refresh();
    }
  }, [open, refresh]);

  useEffect(() => {
    setCurrentPath('/');
  }, [workflow.id]);

  useEffect(() => {
    if (open) {
      setSelected(null);
      setPreview(null);
      setPreviewTruncated(false);
    }
  }, [open, currentPath]);

  const openDirectory = (path: string) => {
    setCurrentPath(path);
  };

  const goToParent = () => {
    setCurrentPath(parentPath(currentPath));
  };

  const onToggleNew = () => {
    if (!newOpen) {
      setNewPath(currentPath === '/' ? '/' : `${currentPath}/`);
      setNewContent('');
    }
    setNewOpen((v) => !v);
  };

  const onSelect = async (e: FsEntry) => {
    setSelected(e);
    setPreview(null);
    if (!e.isDir) {
      try {
        const r = await readFile(workflow.id, e.path);
        setPreview(r.content);
        setPreviewTruncated(r.truncated);
      } catch (err) {
        setPreview(t('files.readFailed', { msg: err instanceof Error ? err.message : err }));
        setPreviewTruncated(false);
      }
    }
  };

  const onUpload = async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.onchange = async () => {
      const files = Array.from(input.files ?? []);
      for (const f of files) {
        const text = await f.text().catch(() => '');
        await writeFile(workflow.id, joinPath(currentPath, f.name), text);
      }
      await refresh();
    };
    input.click();
  };

  const onDownload = async (e: FsEntry) => {
    const blob = await downloadFile(workflow.id, e.path);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = e.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const onDelete = async (e: FsEntry) => {
    if (!confirm(t('files.deleteConfirm', { path: e.path }))) return;
    await deleteEntry(workflow.id, e.path);
    if (selected?.path === e.path) {
      setSelected(null);
      setPreview(null);
    }
    await refresh();
  };

  const onCreateFile = async () => {
    if (!newPath.startsWith('/')) {
      alert(t('files.pathMustStart'));
      return;
    }
    await writeFile(workflow.id, newPath, newContent);
    setNewOpen(false);
    setNewPath('/');
    setNewContent('');
    const nextPath = parentPath(newPath);
    if (nextPath === currentPath) {
      await refresh();
    } else {
      setCurrentPath(nextPath);
    }
  };

  if (!open) return null;

  const crumbs = pathCrumbs(currentPath);

  return (
    <div
      className="fixed inset-0 z-50 flex items-stretch justify-center bg-black/60 p-0 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="card flex h-full max-h-none w-full max-w-4xl flex-col rounded-none sm:h-auto sm:max-h-[90vh] sm:rounded-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-wrap items-start justify-between gap-2 border-b border-line px-4 py-3">
          <div className="min-w-0">
            <div className="text-base font-semibold text-ink">{t('files.title')}</div>
            <div className="text-[11px] text-muted">
              {t('files.subtitle', { name: workflow.name })}
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <button
              className="btn-ghost"
              onClick={onToggleNew}
              title={t('files.newTitle')}
            >
              <FilePlus size={14} /> {t('files.new')}
            </button>
            <button className="btn-ghost" onClick={onUpload} title={t('files.uploadTitle')}>
              <Upload size={14} /> {t('files.upload')}
            </button>
            <button className="btn-ghost" onClick={refresh} title={t('common.refresh')}>
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            </button>
            <button className="btn-ghost" onClick={onClose}>
              <X size={16} />
            </button>
          </div>
        </div>

        {newOpen ? (
          <div className="space-y-2 border-b border-line bg-bg-soft px-4 py-3">
            <div>
              <div className="label mb-1">{t('files.pathLabel')}</div>
              <input
                className="input font-mono text-[12px]"
                value={newPath}
                placeholder={t('files.pathPlaceholder')}
                onChange={(e) => setNewPath(e.target.value)}
              />
            </div>
            <div>
              <div className="label mb-1">{t('files.contentLabel')}</div>
              <textarea
                className="input min-h-[100px] resize-y font-mono text-[12px]"
                value={newContent}
                onChange={(e) => setNewContent(e.target.value)}
              />
            </div>
            <div className="flex justify-end gap-2">
              <button className="btn-ghost" onClick={() => setNewOpen(false)}>
                {t('common.cancel')}
              </button>
              <button className="btn-primary" onClick={onCreateFile}>
                {t('common.create')}
              </button>
            </div>
          </div>
        ) : null}

        <div className="flex min-h-0 flex-1 flex-col sm:flex-row">
          <div className="max-h-44 w-full shrink-0 overflow-auto border-b border-line sm:max-h-none sm:w-64 sm:border-b-0 sm:border-r">
            <div className="flex items-center gap-1 border-b border-line px-2 py-2">
              <button
                className="btn-ghost h-7 w-7 shrink-0 px-0 disabled:cursor-not-allowed disabled:opacity-40"
                onClick={goToParent}
                disabled={currentPath === '/'}
                title={t('files.parent')}
              >
                <CornerUpLeft size={13} />
              </button>
              <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto font-mono text-[11px] text-muted">
                <button
                  className={`rounded px-1.5 py-1 hover:bg-bg-soft hover:text-ink ${
                    currentPath === '/' ? 'bg-bg-soft text-ink' : ''
                  }`}
                  onClick={() => setCurrentPath('/')}
                  title={t('files.root')}
                >
                  /
                </button>
                {crumbs.map((crumb) => (
                  <Fragment key={crumb.path}>
                    <ChevronRight size={11} className="shrink-0 text-muted/70" />
                    <button
                      className={`max-w-28 truncate rounded px-1.5 py-1 hover:bg-bg-soft hover:text-ink ${
                        currentPath === crumb.path ? 'bg-bg-soft text-ink' : ''
                      }`}
                      onClick={() => setCurrentPath(crumb.path)}
                      title={crumb.path}
                    >
                      {crumb.name}
                    </button>
                  </Fragment>
                ))}
              </div>
            </div>
            {entries.length === 0 && !loading ? (
              <div className="p-4 text-center text-[12px] text-muted">
                {t('files.empty')}
              </div>
            ) : (
              <ul>
                {entries.map((e) => (
                  <li
                    key={e.path}
                    className={`group flex items-center text-[12px] hover:bg-panel ${
                      selected?.path === e.path ? 'bg-panel' : ''
                    }`}
                  >
                    <button
                      className="flex min-w-0 flex-1 cursor-pointer items-center gap-1.5 px-3 py-1.5 text-left"
                      onClick={() => (e.isDir ? openDirectory(e.path) : onSelect(e))}
                      title={e.path}
                    >
                      {e.isDir ? (
                        <Folder size={12} className="shrink-0 text-accent-cool" />
                      ) : (
                        <FileText size={12} className="shrink-0 text-muted" />
                      )}
                      <span className="flex-1 truncate text-ink">{e.name}</span>
                      {e.size != null ? (
                        <span className="shrink-0 text-[10px] text-muted">
                          {formatSize(e.size)}
                        </span>
                      ) : null}
                    </button>
                    {e.isDir ? (
                      <button
                        className="mr-1 flex h-7 w-7 shrink-0 items-center justify-center rounded text-muted opacity-70 hover:bg-accent-danger/10 hover:text-accent-danger sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
                        onClick={() => onDelete(e)}
                        title={t('common.delete')}
                      >
                        <Trash2 size={11} />
                      </button>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="flex min-h-0 min-w-0 flex-1 flex-col">
            {selected ? (
              <>
                <div className="flex flex-wrap items-center gap-2 border-b border-line px-3 py-2">
                  <span className="flex-1 truncate font-mono text-[12px] text-ink">
                    {selected.path}
                  </span>
                  {!selected.isDir ? (
                    <button
                      className="btn-ghost h-7 px-2 text-[11px]"
                      onClick={() => onDownload(selected)}
                    >
                      <Download size={11} /> {t('files.download')}
                    </button>
                  ) : null}
                  <button
                    className="btn-ghost h-7 px-2 text-[11px] text-accent-danger hover:bg-accent-danger/10"
                    onClick={() => onDelete(selected)}
                  >
                    <Trash2 size={11} /> {t('common.delete')}
                  </button>
                </div>
                <div className="min-h-0 flex-1 overflow-auto">
                  {selected.isDir ? (
                    <div className="p-4 text-[12px] text-muted">
                      {t('files.isDir')}
                    </div>
                  ) : preview == null ? (
                    <div className="p-4 text-[12px] text-muted">{t('files.reading')}</div>
                  ) : (
                    <>
                      <pre className="whitespace-pre-wrap break-words p-3 text-[12px] leading-relaxed text-ink/90">
                        {preview}
                      </pre>
                      {previewTruncated ? (
                        <div className="px-3 pb-3 text-[11px] text-amber-400">
                          {t('files.truncated')}
                        </div>
                      ) : null}
                    </>
                  )}
                </div>
              </>
            ) : (
              <div className="flex flex-1 items-center justify-center p-8 text-center text-[12px] text-muted">
                {t('files.selectToPreview')}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)}MB`;
}

function joinPath(dir: string, name: string): string {
  return dir === '/' ? `/${name}` : `${dir}/${name}`;
}

function parentPath(path: string): string {
  const parts = path.split('/').filter(Boolean);
  parts.pop();
  return parts.length === 0 ? '/' : `/${parts.join('/')}`;
}

function pathCrumbs(path: string): Array<{ name: string; path: string }> {
  const parts = path.split('/').filter(Boolean);
  return parts.map((name, index) => ({
    name,
    path: `/${parts.slice(0, index + 1).join('/')}`,
  }));
}
