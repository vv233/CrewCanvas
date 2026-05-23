import type { McpServerConfig, ToolDef } from '../types';
import { McpHttpClient } from './client';

export interface LoadedMcp {
  /** All tool definitions to advertise to the model. Names are namespaced as
   *  `serverName__toolName` to avoid collisions across servers. */
  tools: ToolDef[];
  /** Resolve a namespaced tool name to its server + original name. */
  resolve: (namespacedName: string) => { client: McpHttpClient; rawName: string } | null;
  /** Close all MCP connections. */
  close: () => Promise<void>;
  /** Connection errors per server, for surfacing to the UI / logs. */
  errors: Array<{ serverName: string; message: string }>;
}

const TOOL_SEP = '__';

export function namespaceTool(serverName: string, toolName: string): string {
  return `${sanitize(serverName)}${TOOL_SEP}${toolName}`;
}

function sanitize(s: string): string {
  return s.replace(/[^a-zA-Z0-9_-]/g, '_');
}

export async function loadLocalMcpTools(
  servers: McpServerConfig[]
): Promise<LoadedMcp> {
  const tools: ToolDef[] = [];
  const routes = new Map<string, { client: McpHttpClient; rawName: string }>();
  const clients: McpHttpClient[] = [];
  const errors: LoadedMcp['errors'] = [];

  await Promise.all(
    servers.map(async (s) => {
      const client = new McpHttpClient({
        url: s.url,
        authorizationToken: s.authorizationToken,
      });
      clients.push(client);
      try {
        const all = await client.listTools();
        const allowed = s.allowedTools && s.allowedTools.length > 0
          ? new Set(s.allowedTools)
          : null;
        for (const t of all) {
          if (allowed && !allowed.has(t.name)) continue;
          const namespaced = namespaceTool(s.name, t.name);
          routes.set(namespaced, { client, rawName: t.name });
          tools.push({
            name: namespaced,
            description: t.description
              ? `[${s.name}] ${t.description}`
              : `[${s.name}] ${t.name}`,
            inputSchema: t.inputSchema,
          });
        }
      } catch (err) {
        errors.push({
          serverName: s.name,
          message: err instanceof Error ? err.message : String(err),
        });
      }
    })
  );

  return {
    tools,
    resolve: (n) => routes.get(n) ?? null,
    close: async () => {
      await Promise.all(clients.map((c) => c.close()));
    },
    errors,
  };
}
