/**
 * Browser MCP client over the Streamable HTTP transport, backed by the official
 * `@modelcontextprotocol/sdk`. This is a thin adapter that preserves the small
 * surface the rest of the app relies on (`listTools` / `callTool` / `close`),
 * while delegating protocol details — session management, protocol-version
 * negotiation, reconnection — to the SDK.
 *
 * Requires the MCP server to allow CORS from the browser origin. A bearer token,
 * if configured, is sent on every request via `Authorization`.
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import type { ToolDef } from '../types';

export interface McpClientOpts {
  url: string;
  authorizationToken?: string;
  /** Hard timeout for any single request, ms. */
  timeoutMs?: number;
}

interface ToolContentBlock {
  type: string;
  text?: string;
}

export class McpHttpClient {
  private client: Client | null = null;
  private transport: StreamableHTTPClientTransport | null = null;
  /** Memoizes the in-flight connect so concurrent calls share one handshake. */
  private connecting: Promise<Client> | null = null;

  constructor(private opts: McpClientOpts) {}

  private get requestOptions() {
    return { timeout: this.opts.timeoutMs ?? 30000 };
  }

  private connect(): Promise<Client> {
    if (this.connecting) return this.connecting;
    this.connecting = (async () => {
      const transport = new StreamableHTTPClientTransport(new URL(this.opts.url), {
        requestInit: this.opts.authorizationToken
          ? { headers: { Authorization: `Bearer ${this.opts.authorizationToken}` } }
          : undefined,
      });
      const client = new Client({ name: 'CrewCanvas', version: '0.1' });
      await client.connect(transport);
      this.client = client;
      this.transport = transport;
      return client;
    })();
    // If the handshake fails, clear the memo so a later call can retry.
    this.connecting.catch(() => {
      this.connecting = null;
    });
    return this.connecting;
  }

  async listTools(): Promise<ToolDef[]> {
    const client = await this.connect();
    const result = await client.listTools(undefined, this.requestOptions);
    return (result.tools ?? []).map((t) => ({
      name: t.name,
      description: t.description,
      inputSchema: (t.inputSchema as Record<string, unknown>) ?? {
        type: 'object',
        properties: {},
      },
    }));
  }

  async callTool(name: string, args: unknown): Promise<string> {
    const client = await this.connect();
    const result = await client.callTool(
      { name, arguments: (args ?? {}) as Record<string, unknown> },
      undefined,
      this.requestOptions
    );
    const content = (result.content ?? []) as ToolContentBlock[];
    const text = content
      .map((c) => (c.type === 'text' ? c.text ?? '' : JSON.stringify(c)))
      .join('\n');
    if (result.isError) {
      return `[tool error] ${text}`;
    }
    return text || '(empty result)';
  }

  async close(): Promise<void> {
    try {
      await this.transport?.close();
    } catch {
      /* ignore */
    }
    this.client = null;
    this.transport = null;
    this.connecting = null;
  }
}
