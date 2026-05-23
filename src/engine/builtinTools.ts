/**
 * In-process tools automatically exposed to every agent: filesystem ops on the
 * current workflow's OPFS folder. These look identical to MCP tools to the
 * provider — `runAgent` merges them into the tools list and routes calls.
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

export interface BuiltinTools {
  tools: ToolDef[];
  handlers: Map<string, (args: unknown) => Promise<string>>;
}

export function getWorkflowFsTools(workflowId: string): BuiltinTools {
  const tools: ToolDef[] = [
    {
      name: 'fs_list',
      description:
        '列出当前工作流共享文件夹下的内容。当你需要确认有哪些文件、查找路径、读取记忆/报告/代码前，应先调用此工具。所有 AI 节点共享同一个文件夹。',
      inputSchema: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: '相对路径，默认根目录 "/"。例如 "/" 或 "/docs"',
          },
        },
      },
    },
    {
      name: 'fs_read',
      description:
        '读取共享文件夹中一个文本文件的内容。为避免上下文过长，大文件只返回开头片段并提示截断；需要定位信息时先用资料库/RAG或让用户提供更小文件。',
      inputSchema: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: '文件相对路径，例如 "/spec.md" 或 "/data/users.json"',
          },
        },
        required: ['path'],
      },
    },
    {
      name: 'fs_write',
      description:
        '写入文本文件到共享文件夹（覆盖同名文件，必要的中间目录会自动创建）。需要保存长方案、报告、代码、JSON、记忆或给下游节点继续使用的内容时，优先调用此工具。追加文件时先 fs_read 旧内容再 fs_write 写回。',
      inputSchema: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: '文件相对路径，例如 "/plan.md"',
          },
          content: { type: 'string', description: '文件内容（文本）；特别长的内容建议分段写入，避免工具参数过长。' },
        },
        required: ['path', 'content'],
      },
    },
    {
      name: 'fs_delete',
      description: '删除一个文件或目录（目录会递归删除）。',
      inputSchema: {
        type: 'object',
        properties: {
          path: { type: 'string', description: '要删除的相对路径' },
        },
        required: ['path'],
      },
    },
  ];

  const handlers = new Map<string, (args: unknown) => Promise<string>>();

  handlers.set('fs_list', async (raw) => {
    const args = (raw ?? {}) as { path?: string };
    const entries = await listFiles(workflowId, args.path ?? '/');
    if (entries.length === 0) return '(空目录)';
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
    if (!args.path) throw new FsError('参数 path 必填');
    const r = await readFile(workflowId, args.path, {
      textLimit: TOOL_TEXT_READ_LIMIT,
    });
    return r.truncated
      ? `${r.content}\n\n[文件被截断：工具读取上限 ${formatSize(TOOL_TEXT_READ_LIMIT)}，原始大小 ${formatSize(r.size)}。请改用资料库/RAG检索，或把文件拆小后再读取。]`
      : r.content;
  });

  handlers.set('fs_write', async (raw) => {
    const args = (raw ?? {}) as { path?: string; content?: string };
    if (!args.path) throw new FsError('参数 path 必填');
    if (args.content == null) throw new FsError('参数 content 必填');
    const size = await writeFile(workflowId, args.path, args.content);
    return `已写入 ${args.path} (${formatSize(size)})`;
  });

  handlers.set('fs_delete', async (raw) => {
    const args = (raw ?? {}) as { path?: string };
    if (!args.path) throw new FsError('参数 path 必填');
    await deleteEntry(workflowId, args.path);
    return `已删除 ${args.path}`;
  });

  return { tools, handlers };
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)}MB`;
}
