import { useCallback, useEffect, useState } from 'react';
import {
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
import { useWorkflowStore } from '../state/workflowStore';

interface Props {
  open: boolean;
  onClose: () => void;
}

export function FilesDialog({ open, onClose }: Props) {
  const workflow = useWorkflowStore((s) => s.workflow);
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
      const list = await listFiles(workflow.id, '/');
      setEntries(list);
    } catch (err) {
      console.error('listFiles error', err);
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, [workflow.id]);

  useEffect(() => {
    if (open) {
      refresh();
      setSelected(null);
      setPreview(null);
    }
  }, [open, refresh]);

  const onSelect = async (e: FsEntry) => {
    setSelected(e);
    setPreview(null);
    if (!e.isDir) {
      try {
        const r = await readFile(workflow.id, e.path);
        setPreview(r.content);
        setPreviewTruncated(r.truncated);
      } catch (err) {
        setPreview(`(读取失败: ${err instanceof Error ? err.message : err})`);
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
        await writeFile(workflow.id, '/' + f.name, text);
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
    if (!confirm(`确定删除 ${e.path}？目录会递归删除。`)) return;
    await deleteEntry(workflow.id, e.path);
    if (selected?.path === e.path) {
      setSelected(null);
      setPreview(null);
    }
    await refresh();
  };

  const onCreateFile = async () => {
    if (!newPath.startsWith('/')) {
      alert('路径必须以 / 开头');
      return;
    }
    await writeFile(workflow.id, newPath, newContent);
    setNewOpen(false);
    setNewPath('/');
    setNewContent('');
    await refresh();
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="card flex max-h-[90vh] w-full max-w-4xl flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <div>
            <div className="text-base font-semibold text-ink">工作流共享文件夹</div>
            <div className="text-[11px] text-muted">
              所有 AI 节点可通过 fs_list / fs_read / fs_write / fs_delete 工具读写 ·
              当前工作流：{workflow.name}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              className="btn-ghost"
              onClick={() => setNewOpen((v) => !v)}
              title="新建文本文件"
            >
              <FilePlus size={14} /> 新建
            </button>
            <button className="btn-ghost" onClick={onUpload} title="上传文件">
              <Upload size={14} /> 上传
            </button>
            <button className="btn-ghost" onClick={refresh} title="刷新">
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
              <div className="label mb-1">路径（以 / 开头）</div>
              <input
                className="input font-mono text-[12px]"
                value={newPath}
                placeholder="/spec.md"
                onChange={(e) => setNewPath(e.target.value)}
              />
            </div>
            <div>
              <div className="label mb-1">内容</div>
              <textarea
                className="input min-h-[100px] resize-y font-mono text-[12px]"
                value={newContent}
                onChange={(e) => setNewContent(e.target.value)}
              />
            </div>
            <div className="flex justify-end gap-2">
              <button className="btn-ghost" onClick={() => setNewOpen(false)}>
                取消
              </button>
              <button className="btn-primary" onClick={onCreateFile}>
                创建
              </button>
            </div>
          </div>
        ) : null}

        <div className="flex min-h-0 flex-1">
          <div className="w-64 shrink-0 overflow-auto border-r border-line">
            {entries.length === 0 && !loading ? (
              <div className="p-4 text-center text-[12px] text-muted">
                空文件夹。AI 节点用 fs_write 创建文件后会出现在这里。
              </div>
            ) : (
              <ul>
                {entries.map((e) => (
                  <li
                    key={e.path}
                    className={`flex cursor-pointer items-center gap-1.5 px-3 py-1.5 text-[12px] hover:bg-panel ${
                      selected?.path === e.path ? 'bg-panel' : ''
                    }`}
                    onClick={() => onSelect(e)}
                  >
                    {e.isDir ? (
                      <Folder size={12} className="text-accent-cool" />
                    ) : (
                      <FileText size={12} className="text-muted" />
                    )}
                    <span className="flex-1 truncate text-ink">{e.name}</span>
                    {e.size != null ? (
                      <span className="text-[10px] text-muted">
                        {formatSize(e.size)}
                      </span>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="flex min-w-0 flex-1 flex-col">
            {selected ? (
              <>
                <div className="flex items-center gap-2 border-b border-line px-3 py-2">
                  <span className="flex-1 truncate font-mono text-[12px] text-ink">
                    {selected.path}
                  </span>
                  {!selected.isDir ? (
                    <button
                      className="btn-ghost h-7 px-2 text-[11px]"
                      onClick={() => onDownload(selected)}
                    >
                      <Download size={11} /> 下载
                    </button>
                  ) : null}
                  <button
                    className="btn-ghost h-7 px-2 text-[11px] text-accent-danger hover:bg-accent-danger/10"
                    onClick={() => onDelete(selected)}
                  >
                    <Trash2 size={11} /> 删除
                  </button>
                </div>
                <div className="min-h-0 flex-1 overflow-auto">
                  {selected.isDir ? (
                    <div className="p-4 text-[12px] text-muted">
                      （这是个目录，点开内部条目查看）
                    </div>
                  ) : preview == null ? (
                    <div className="p-4 text-[12px] text-muted">读取中…</div>
                  ) : (
                    <>
                      <pre className="whitespace-pre-wrap break-words p-3 text-[12px] leading-relaxed text-ink/90">
                        {preview}
                      </pre>
                      {previewTruncated ? (
                        <div className="px-3 pb-3 text-[11px] text-amber-400">
                          预览被截断（仅显示前 1MB）
                        </div>
                      ) : null}
                    </>
                  )}
                </div>
              </>
            ) : (
              <div className="flex flex-1 items-center justify-center p-8 text-center text-[12px] text-muted">
                选一个文件预览
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
