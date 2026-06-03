/**
 * In-process tools automatically exposed to every agent: filesystem ops on the
 * current workflow's shared folder (IndexedDB-backed). These look identical to
 * MCP tools to the provider — `runAgent` merges them into the tools list and
 * routes calls.
 */

import type { ToolDef } from '../types';
import {
  deleteEntry,
  listFiles,
  readFile,
  writeFile,
  FsError,
  TOOL_TEXT_READ_LIMIT,
} from '../fs/workflowFs';
import i18n from '../i18n';

export interface BuiltinTools {
  tools: ToolDef[];
  handlers: Map<string, (args: unknown) => Promise<string>>;
}

export function getWorkflowFsTools(workflowId: string): BuiltinTools {
  const tools: ToolDef[] = [
    {
      name: 'fs_list',
      description: i18n.t('tools.fsListDesc'),
      inputSchema: {
        type: 'object',
        properties: {
          path: { type: 'string', description: i18n.t('tools.fsListPathDesc') },
        },
      },
    },
    {
      name: 'fs_read',
      description: i18n.t('tools.fsReadDesc'),
      inputSchema: {
        type: 'object',
        properties: {
          path: { type: 'string', description: i18n.t('tools.fsReadPathDesc') },
        },
        required: ['path'],
      },
    },
    {
      name: 'fs_write',
      description: i18n.t('tools.fsWriteDesc'),
      inputSchema: {
        type: 'object',
        properties: {
          path: { type: 'string', description: i18n.t('tools.fsWritePathDesc') },
          content: { type: 'string', description: i18n.t('tools.fsWriteContentDesc') },
        },
        required: ['path', 'content'],
      },
    },
    {
      name: 'fs_delete',
      description: i18n.t('tools.fsDeleteDesc'),
      inputSchema: {
        type: 'object',
        properties: {
          path: { type: 'string', description: i18n.t('tools.fsDeletePathDesc') },
        },
        required: ['path'],
      },
    },
  ];

  const handlers = new Map<string, (args: unknown) => Promise<string>>();

  handlers.set('fs_list', async (raw) => {
    const args = (raw ?? {}) as { path?: string };
    const entries = await listFiles(workflowId, args.path ?? '/');
    if (entries.length === 0) return i18n.t('tools.emptyDir');
    return entries
      .map((e) =>
        e.isDir
          ? `📁 ${e.path}/`
          : `📄 ${e.path} (${formatSize(e.size ?? 0)})`
      )
      .join('\n');
  });

  handlers.set('fs_read', async (raw) => {
    const args = (raw ?? {}) as { path?: string };
    if (!args.path) throw new FsError(i18n.t('errors.fsPathRequired'));
    const r = await readFile(workflowId, args.path, {
      textLimit: TOOL_TEXT_READ_LIMIT,
    });
    return r.truncated
      ? i18n.t('tools.readTruncated', {
          content: r.content,
          limit: formatSize(TOOL_TEXT_READ_LIMIT),
          size: formatSize(r.size),
        })
      : r.content;
  });

  handlers.set('fs_write', async (raw) => {
    const args = (raw ?? {}) as { path?: string; content?: string };
    if (!args.path) throw new FsError(i18n.t('errors.fsPathRequired'));
    if (args.content == null) throw new FsError(i18n.t('errors.fsContentRequired'));
    const size = await writeFile(workflowId, args.path, args.content);
    return i18n.t('tools.writeOk', { path: args.path, size: formatSize(size) });
  });

  handlers.set('fs_delete', async (raw) => {
    const args = (raw ?? {}) as { path?: string };
    if (!args.path) throw new FsError(i18n.t('errors.fsPathRequired'));
    await deleteEntry(workflowId, args.path);
    return i18n.t('tools.deleteOk', { path: args.path });
  });

  return { tools, handlers };
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)}MB`;
}
