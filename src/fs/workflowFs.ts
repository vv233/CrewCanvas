/**
 * Per-workflow shared filesystem.
 *
 * Backed by IndexedDB (via Dexie). IndexedDB works in every context the app
 * is served from — secure (https / localhost) and insecure (plain-HTTP LAN /
 * Tailscale) origins alike, on all browsers and on the main thread. We
 * deliberately do NOT use OPFS: it's unavailable on non-secure origins (which
 * this app explicitly supports for LAN/Tailscale access) and its main-thread
 * write path (createWritable) is unsupported on Safari, so it failed silently
 * in exactly the environments we target.
 */

import { db, type WorkflowFileRecord } from '../storage/db';
import i18n from '../i18n';

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
      throw new FsError(i18n.t('errors.fsForbiddenSegment', { seg }));
    }
  }
  return parts;
}

function toAbsolutePath(parts: string[]): string {
  return parts.length === 0 ? '/' : '/' + parts.join('/');
}

async function getWorkflowFile(
  workflowId: string,
  path: string
): Promise<WorkflowFileRecord> {
  const record = await db.workflowFiles
    .where('[workflowId+path]')
    .equals([workflowId, path])
    .first();
  if (!record) throw new FsError(i18n.t('errors.fsFileNotExist', { path }));
  return record;
}

export async function listFiles(
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

export async function readFile(
  workflowId: string,
  path: string,
  options: ReadFileOptions = {}
): Promise<{ content: string; truncated: boolean; size: number }> {
  const textLimit = options.textLimit ?? DEFAULT_TEXT_LIMIT;
  const parts = normalizePath(path);
  if (parts.length === 0) throw new FsError(i18n.t('errors.fsPathEmpty'));
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

export async function writeFile(
  workflowId: string,
  path: string,
  content: string | Blob
): Promise<number> {
  const parts = normalizePath(path);
  if (parts.length === 0) throw new FsError(i18n.t('errors.fsPathEmpty'));
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

export async function deleteEntry(
  workflowId: string,
  path: string
): Promise<void> {
  const parts = normalizePath(path);
  if (parts.length === 0) throw new FsError(i18n.t('errors.fsPathEmpty'));
  const entryPath = toAbsolutePath(parts);
  const prefix = `${entryPath}/`;
  const keys = await db.workflowFiles
    .where('workflowId')
    .equals(workflowId)
    .filter((record) => record.path === entryPath || record.path.startsWith(prefix))
    .primaryKeys();
  if (keys.length === 0) throw new FsError(i18n.t('errors.fsPathNotExist', { path: entryPath }));
  await db.workflowFiles.bulkDelete(keys as string[]);
}

export async function downloadFile(
  workflowId: string,
  path: string
): Promise<Blob> {
  const parts = normalizePath(path);
  if (parts.length === 0) throw new FsError(i18n.t('errors.fsPathEmpty'));
  const record = await getWorkflowFile(workflowId, toAbsolutePath(parts));
  return record.content;
}

function sortEntries(entries: FsEntry[]): FsEntry[] {
  return entries.sort((a, b) =>
    a.isDir === b.isDir ? a.name.localeCompare(b.name) : a.isDir ? -1 : 1
  );
}
