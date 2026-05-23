/**
 * Per-workflow shared filesystem.
 *
 * OPFS (Origin Private File System) is used when the current browser origin
 * supports it. When the page is opened from a non-secure LAN/Tailscale HTTP
 * origin, OPFS may be unavailable, so we fall back to IndexedDB while keeping
 * the same fs_list / fs_read / fs_write / fs_delete behavior.
 */

import { db, type WorkflowFileRecord } from '../storage/db';

export interface FsEntry {
  name: string;
  path: string; // absolute under workflow root, starts with /
  isDir: boolean;
  size?: number;
  modified?: number;
}

export class FsError extends Error {}

const DEFAULT_TEXT_LIMIT = 1024 * 1024; // 1 MB cap for UI previews
export const TOOL_TEXT_READ_LIMIT = 12 * 1024; // keep fs_read tool results model-safe

export interface ReadFileOptions {
  textLimit?: number;
}

function normalizePath(p: string): string[] {
  const parts = (p || '/').split('/').filter(Boolean);
  for (const seg of parts) {
    if (seg === '..' || seg === '.') {
      throw new FsError(`不允许的路径段: "${seg}"`);
    }
  }
  return parts;
}

function toAbsolutePath(parts: string[]): string {
  return parts.length === 0 ? '/' : '/' + parts.join('/');
}

function hasOpfs(): boolean {
  return Boolean(
    typeof navigator !== 'undefined' &&
      navigator.storage &&
      typeof navigator.storage.getDirectory === 'function'
  );
}

function isOpfsUnavailableError(err: unknown): boolean {
  if (err instanceof FsError && err.message.includes('OPFS')) return true;
  return (
    typeof DOMException !== 'undefined' &&
    err instanceof DOMException &&
    err.name === 'SecurityError'
  );
}

async function withFilesystem<T>(
  opfs: () => Promise<T>,
  idb: () => Promise<T>
): Promise<T> {
  if (!hasOpfs()) return idb();
  try {
    return await opfs();
  } catch (err) {
    if (isOpfsUnavailableError(err)) return idb();
    throw err;
  }
}

async function getWorkflowRoot(
  workflowId: string
): Promise<FileSystemDirectoryHandle> {
  if (!hasOpfs()) {
    throw new FsError('当前浏览器不支持 OPFS');
  }
  const root = await navigator.storage.getDirectory();
  const wfRoot = await root.getDirectoryHandle('workflows', { create: true });
  return wfRoot.getDirectoryHandle(workflowId, { create: true });
}

async function resolveDir(
  workflowId: string,
  parts: string[],
  create: boolean
): Promise<FileSystemDirectoryHandle> {
  let dir = await getWorkflowRoot(workflowId);
  for (const p of parts) {
    dir = await dir.getDirectoryHandle(p, { create });
  }
  return dir;
}

async function listFilesOpfs(
  workflowId: string,
  path = '/'
): Promise<FsEntry[]> {
  const parts = normalizePath(path);
  let dir: FileSystemDirectoryHandle;
  try {
    dir = await resolveDir(workflowId, parts, false);
  } catch (err) {
    if (isOpfsUnavailableError(err)) throw err;
    return [];
  }
  const out: FsEntry[] = [];
  // FileSystemDirectoryHandle.entries() is an async iterator (not in TS DOM
  // lib until very recent versions); cast for compatibility.
  for await (const [name, handle] of (
    dir as unknown as {
      entries: () => AsyncIterable<[string, FileSystemHandle]>;
    }
  ).entries()) {
    const entryPath = '/' + [...parts, name].join('/');
    if (handle.kind === 'file') {
      const f = await (handle as FileSystemFileHandle).getFile();
      out.push({
        name,
        path: entryPath,
        isDir: false,
        size: f.size,
        modified: f.lastModified,
      });
    } else {
      out.push({ name, path: entryPath, isDir: true });
    }
  }
  return sortEntries(out);
}

async function readFileOpfs(
  workflowId: string,
  path: string,
  textLimit = DEFAULT_TEXT_LIMIT
): Promise<{ content: string; truncated: boolean; size: number }> {
  const parts = normalizePath(path);
  if (parts.length === 0) throw new FsError('路径不能为空');
  const name = parts.pop()!;
  const dir = await resolveDir(workflowId, parts, false);
  const handle = await dir.getFileHandle(name);
  const f = await handle.getFile();
  if (f.size > textLimit) {
    const slice = await f.slice(0, textLimit).text();
    return { content: slice, truncated: true, size: f.size };
  }
  const text = await f.text();
  return { content: text, truncated: false, size: f.size };
}

async function writeFileOpfs(
  workflowId: string,
  path: string,
  content: string | Blob
): Promise<number> {
  const parts = normalizePath(path);
  if (parts.length === 0) throw new FsError('路径不能为空');
  const name = parts.pop()!;
  const dir = await resolveDir(workflowId, parts, true);
  const handle = await dir.getFileHandle(name, { create: true });
  const writable = await handle.createWritable();
  await writable.write(content);
  await writable.close();
  const f = await handle.getFile();
  return f.size;
}

async function deleteEntryOpfs(
  workflowId: string,
  path: string
): Promise<void> {
  const parts = normalizePath(path);
  if (parts.length === 0) throw new FsError('路径不能为空');
  const name = parts.pop()!;
  const dir = await resolveDir(workflowId, parts, false);
  await dir.removeEntry(name, { recursive: true });
}

async function downloadFileOpfs(
  workflowId: string,
  path: string
): Promise<Blob> {
  const parts = normalizePath(path);
  const name = parts.pop()!;
  const dir = await resolveDir(workflowId, parts, false);
  const handle = await dir.getFileHandle(name);
  return await handle.getFile();
}

async function getWorkflowFile(
  workflowId: string,
  path: string
): Promise<WorkflowFileRecord> {
  const record = await db.workflowFiles
    .where('[workflowId+path]')
    .equals([workflowId, path])
    .first();
  if (!record) throw new FsError(`文件不存在: ${path}`);
  return record;
}

async function listFilesIdb(
  workflowId: string,
  path = '/'
): Promise<FsEntry[]> {
  const parts = normalizePath(path);
  const dirPath = toAbsolutePath(parts);
  const prefix = dirPath === '/' ? '/' : `${dirPath}/`;
  const records = await db.workflowFiles
    .where('workflowId')
    .equals(workflowId)
    .toArray();
  const byPath = new Map<string, FsEntry>();

  for (const record of records) {
    if (!record.path.startsWith(prefix)) continue;
    const rest = record.path.slice(prefix.length);
    if (!rest) continue;
    const slash = rest.indexOf('/');
    if (slash >= 0) {
      const name = rest.slice(0, slash);
      const entryPath = prefix === '/' ? `/${name}` : `${dirPath}/${name}`;
      if (!byPath.has(entryPath)) {
        byPath.set(entryPath, { name, path: entryPath, isDir: true });
      }
    } else {
      byPath.set(record.path, {
        name: rest,
        path: record.path,
        isDir: false,
        size: record.size,
        modified: record.modified,
      });
    }
  }

  return sortEntries([...byPath.values()]);
}

async function readFileIdb(
  workflowId: string,
  path: string,
  textLimit = DEFAULT_TEXT_LIMIT
): Promise<{ content: string; truncated: boolean; size: number }> {
  const parts = normalizePath(path);
  if (parts.length === 0) throw new FsError('路径不能为空');
  const record = await getWorkflowFile(workflowId, toAbsolutePath(parts));
  const blob = record.content;
  if (record.size > textLimit) {
    const slice = await blob.slice(0, textLimit).text();
    return { content: slice, truncated: true, size: record.size };
  }
  return {
    content: await blob.text(),
    truncated: false,
    size: record.size,
  };
}

async function writeFileIdb(
  workflowId: string,
  path: string,
  content: string | Blob
): Promise<number> {
  const parts = normalizePath(path);
  if (parts.length === 0) throw new FsError('路径不能为空');
  const filePath = toAbsolutePath(parts);
  const blob = content instanceof Blob ? content : new Blob([content]);
  await db.workflowFiles.put({
    id: `${workflowId}:${filePath}`,
    workflowId,
    path: filePath,
    content: blob,
    size: blob.size,
    modified: Date.now(),
  });
  return blob.size;
}

async function deleteEntryIdb(workflowId: string, path: string): Promise<void> {
  const parts = normalizePath(path);
  if (parts.length === 0) throw new FsError('路径不能为空');
  const entryPath = toAbsolutePath(parts);
  const prefix = `${entryPath}/`;
  const keys = await db.workflowFiles
    .where('workflowId')
    .equals(workflowId)
    .filter((record) => record.path === entryPath || record.path.startsWith(prefix))
    .primaryKeys();
  if (keys.length === 0) throw new FsError(`路径不存在: ${entryPath}`);
  await db.workflowFiles.bulkDelete(keys as string[]);
}

async function downloadFileIdb(workflowId: string, path: string): Promise<Blob> {
  const parts = normalizePath(path);
  if (parts.length === 0) throw new FsError('路径不能为空');
  const record = await getWorkflowFile(workflowId, toAbsolutePath(parts));
  return record.content;
}

export async function listFiles(
  workflowId: string,
  path = '/'
): Promise<FsEntry[]> {
  return withFilesystem(
    () => listFilesOpfs(workflowId, path),
    () => listFilesIdb(workflowId, path)
  );
}

export async function readFile(
  workflowId: string,
  path: string,
  options: ReadFileOptions = {}
): Promise<{ content: string; truncated: boolean; size: number }> {
  const textLimit = options.textLimit ?? DEFAULT_TEXT_LIMIT;
  return withFilesystem(
    () => readFileOpfs(workflowId, path, textLimit),
    () => readFileIdb(workflowId, path, textLimit)
  );
}

export async function writeFile(
  workflowId: string,
  path: string,
  content: string | Blob
): Promise<number> {
  return withFilesystem(
    () => writeFileOpfs(workflowId, path, content),
    () => writeFileIdb(workflowId, path, content)
  );
}

export async function deleteEntry(
  workflowId: string,
  path: string
): Promise<void> {
  return withFilesystem(
    () => deleteEntryOpfs(workflowId, path),
    () => deleteEntryIdb(workflowId, path)
  );
}

export async function downloadFile(
  workflowId: string,
  path: string
): Promise<Blob> {
  return withFilesystem(
    () => downloadFileOpfs(workflowId, path),
    () => downloadFileIdb(workflowId, path)
  );
}

function sortEntries(entries: FsEntry[]): FsEntry[] {
  return entries.sort((a, b) =>
    a.isDir === b.isDir ? a.name.localeCompare(b.name) : a.isDir ? -1 : 1
  );
}
