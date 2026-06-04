/**
 * Minimal browser MCP client using the Streamable HTTP transport.
 *
 * Implements just enough JSON-RPC 2.0 to: initialize, tools/list, tools/call.
 * Does not handle server → client requests, resources, or prompts.
 *
 * Requires the MCP server to allow CORS from the browser origin.
 */

import { parseSSE } from '../providers/sse';
import type { ToolDef } from '../types';

interface JsonRpcRequest {
  jsonrpc: '2.0';
  id: number;
  method: string;
  params?: unknown;
}

interface JsonRpcResponse {
  jsonrpc: '2.0';
  id: number;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}

interface JsonRpcNotification {
  jsonrpc: '2.0';
  method: string;
  params?: unknown;
}

export interface McpClientOpts {
  url: string;
  authorizationToken?: string;
  /** Hard timeout for any single request, ms. */
  timeoutMs?: number;
}

export class McpHttpClient {
  private nextId = 1;
  private sessionId: string | null = null;
  private initialized = false;

  constructor(private opts: McpClientOpts) {}

  private headers(): Record<string, string> {
    const h: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
    };
    if (this.opts.authorizationToken) {
      h.Authorization = `Bearer ${this.opts.authorizationToken}`;
    }
    if (this.sessionId) {
      h['Mcp-Session-Id'] = this.sessionId;
    }
    return h;
  }

  /** Send a request and read the first JSON-RPC response that matches its id. */
  private async request<T = unknown>(method: string, params?: unknown): Promise<T> {
    const id = this.nextId++;
    const reqBody: JsonRpcRequest = { jsonrpc: '2.0', id, method, params };
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), this.opts.timeoutMs ?? 30000);
    let res: Response;
    try {
      res = await fetch(this.opts.url, {
        method: 'POST',
        headers: this.headers(),
        body: JSON.stringify(reqBody),
        signal: ctrl.signal,
      });
    } finally {
      clearTimeout(t);
    }
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(
        `MCP ${method} HTTP ${res.status}: ${text.slice(0, 200) || res.statusText}`
      );
    }
    // Capture session id if the server assigned one on initialize
    const sid = res.headers.get('Mcp-Session-Id');
    if (sid) this.sessionId = sid;

    const ct = res.headers.get('content-type') ?? '';
    if (ct.includes('text/event-stream')) {
      for await (const evt of parseSSE(res)) {
        if (!evt.data) continue;
        const parsed = parseRpcLine(evt.data);
        if (parsed && 'id' in parsed && parsed.id === id) {
          return unwrap<T>(parsed, method);
        }
      }
      throw new Error(`MCP ${method}: SSE ended without matching response`);
    }
    const text = await res.text();
    const parsed = parseRpcLine(text);
    if (!parsed || !('id' in parsed)) {
      throw new Error(`MCP ${method}: invalid response shape`);
    }
    return unwrap<T>(parsed, method);
  }

  /** Send a fire-and-forget notification. */
  private async notify(method: string, params?: unknown): Promise<void> {
    const body: JsonRpcNotification = { jsonrpc: '2.0', method, params };
    await fetch(this.opts.url, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify(body),
    }).catch(() => {
      /* notifications are best-effort */
    });
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;
    await this.request('initialize', {
      protocolVersion: '2025-03-26',
      capabilities: { tools: {} },
      clientInfo: { name: 'CrewCanvas', version: '0.1' },
    });
    await this.notify('notifications/initialized');
    this.initialized = true;
  }

  async listTools(): Promise<ToolDef[]> {
    await this.initialize();
    const result = await this.request<{ tools?: McpToolListEntry[] }>(
      'tools/list'
    );
    const out: ToolDef[] = [];
    for (const t of result.tools ?? []) {
      out.push({
        name: t.name,
        description: t.description,
        inputSchema: (t.inputSchema as Record<string, unknown>) ?? {
          type: 'object',
          properties: {},
        },
      });
    }
    return out;
  }

  async callTool(name: string, args: unknown): Promise<string> {
    await this.initialize();
    const result = await this.request<{
      content?: Array<{ type: string; text?: string }>;
      isError?: boolean;
    }>('tools/call', { name, arguments: args ?? {} });
    const text = (result.content ?? [])
      .map((c) => (c.type === 'text' ? c.text ?? '' : JSON.stringify(c)))
      .join('\n');
    if (result.isError) {
      return `[tool error] ${text}`;
    }
    return text || '(empty result)';
  }

  async close(): Promise<void> {
    if (!this.sessionId) return;
    try {
      await fetch(this.opts.url, { method: 'DELETE', headers: this.headers() });
    } catch {
      /* ignore */
    }
  }
}

interface McpToolListEntry {
  name: string;
  description?: string;
  inputSchema?: unknown;
}

function parseRpcLine(line: string): JsonRpcResponse | null {
  try {
    return JSON.parse(line) as JsonRpcResponse;
  } catch {
    return null;
  }
}

function unwrap<T>(resp: JsonRpcResponse, method: string): T {
  if (resp.error) {
    throw new Error(`MCP ${method}: ${resp.error.message} (${resp.error.code})`);
  }
  return resp.result as T;
}
