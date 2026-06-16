/**
 * One-shot smoke test for the library migrations. Run with: `npm run test:smoke`.
 *
 * Covers:
 *   - RAG (MiniSearch): CJK + English ranking and agent-scope isolation.
 *   - MCP (official SDK): full protocol round-trip against a real local server,
 *     driven by the actual `McpHttpClient`, including bearer-token wiring and
 *     isError → "[tool error]" mapping.
 *
 * (① ollama → streamLines is a pure refactor covered by `tsc -b` + `npm run build`.
 *  CSP behavior of the MCP SDK can only be verified in a browser — see chat.)
 */
import { createServer } from 'node:http';
import MiniSearch from 'minisearch';
import { McpHttpClient } from '../src/mcp/client';

let failures = 0;
function eq(label: string, got: unknown, want: unknown) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  console.log(`  ${ok ? '✅' : '❌'} ${label}: ${JSON.stringify(got)}${ok ? '' : ` (want ${JSON.stringify(want)})`}`);
  if (!ok) failures++;
}

// --- ② RAG / MiniSearch ----------------------------------------------------
// Mirrors the index config + tokenizer in src/rag/ragIndex.ts + retrieval.ts.
function ragSmoke() {
  console.log('RAG (MiniSearch):');
  const CJK_RE = /[㐀-鿿]/;
  const WORD_RE = /[a-z0-9_]+/g;
  const tokenize = (text: string): string[] => {
    const lower = text.toLowerCase();
    const terms = new Set<string>();
    for (const m of lower.matchAll(WORD_RE)) if (m[0].length >= 2) terms.add(m[0]);
    const cjk = Array.from(lower).filter((ch) => CJK_RE.test(ch));
    for (let i = 0; i < cjk.length - 1; i++) terms.add(cjk[i] + cjk[i + 1]);
    for (const ch of cjk) terms.add(ch);
    return [...terms];
  };
  const mini = new MiniSearch({
    idField: 'id',
    fields: ['text', 'sourceName'],
    storeFields: ['sourceId', 'sourceName', 'chunkIndex', 'text', 'scope', 'agentNodeId'],
    tokenize: (t) => tokenize(t),
    processTerm: (t) => t,
  });
  mini.addAll([
    { id: 'a:0', text: 'Vector databases enable retrieval augmented generation.', sourceName: 'en', sourceId: 'a', chunkIndex: 0, scope: 'shared' },
    { id: 'b:0', text: '检索增强生成通过向量数据库为大语言模型提供外部知识。', sourceName: '中文', sourceId: 'b', chunkIndex: 0, scope: 'shared' },
    { id: 'c:0', text: 'private note', sourceName: 'secret', sourceId: 'c', chunkIndex: 0, scope: 'agent', agentNodeId: 'X' },
  ]);
  const f = (q: string, agent?: string) =>
    mini
      .search(q, {
        combineWith: 'OR',
        boost: { sourceName: 2 },
        filter: (r) => r.scope === 'shared' || (r.scope === 'agent' && !!agent && r.agentNodeId === agent),
      })
      .map((r) => r.id);
  eq('CJK "向量数据库" -> b:0', f('向量数据库'), ['b:0']);
  eq('EN "vector retrieval" -> a:0', f('vector retrieval'), ['a:0']);
  eq('scope: private hidden w/o agent', f('private', undefined), []);
  eq('scope: private visible as X', f('private', 'X'), ['c:0']);
}

// --- ③ MCP / official SDK (real client vs. real HTTP server) ---------------
const TOOLS = [
  { name: 'echo', description: 'Echo', inputSchema: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'] } },
  { name: 'add', description: 'Add', inputSchema: { type: 'object', properties: { a: { type: 'number' }, b: { type: 'number' } }, required: ['a', 'b'] } },
  { name: 'boom', description: 'Errors', inputSchema: { type: 'object', properties: {} } },
];
let authSeen: string | undefined;
function handle(m: any): any {
  const { id, method, params } = m;
  if (method === 'initialize')
    return { jsonrpc: '2.0', id, result: { protocolVersion: params?.protocolVersion ?? '2025-06-18', capabilities: { tools: {} }, serverInfo: { name: 't', version: '0' } } };
  if (method === 'tools/list') return { jsonrpc: '2.0', id, result: { tools: TOOLS } };
  if (method === 'tools/call') {
    const { name, arguments: a } = params ?? {};
    if (name === 'echo') return { jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: String(a?.text ?? '') }] } };
    if (name === 'add') return { jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: String((a?.a ?? 0) + (a?.b ?? 0)) }] } };
    if (name === 'boom') return { jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: 'kaboom' }], isError: true } };
  }
  return id !== undefined ? { jsonrpc: '2.0', id, error: { code: -32601, message: 'nf' } } : null;
}

async function mcpSmoke() {
  console.log('MCP (official SDK, real client):');
  const server = createServer(async (req, res) => {
    if (req.headers.authorization) authSeen = req.headers.authorization as string;
    if (req.method === 'GET') return void res.writeHead(405).end();
    if (req.method === 'DELETE') return void res.writeHead(200).end();
    let raw = '';
    for await (const c of req) raw += c;
    const r = handle(raw ? JSON.parse(raw) : undefined);
    if (r === null) return void res.writeHead(202).end();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(r));
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', () => r()));
  const port = (server.address() as any).port;
  const client = new McpHttpClient({ url: `http://127.0.0.1:${port}/mcp`, authorizationToken: 'secret-xyz' });
  try {
    const tools = await client.listTools();
    eq('listTools names', tools.map((t) => t.name).sort(), ['add', 'boom', 'echo']);
    eq('inputSchema preserved', (tools.find((t) => t.name === 'echo')!.inputSchema as any).required, ['text']);
    eq('callTool add(2,3)', await client.callTool('add', { a: 2, b: 3 }), '5');
    eq('callTool echo', await client.callTool('echo', { text: 'hi' }), 'hi');
    eq('isError -> [tool error]', await client.callTool('boom', {}), '[tool error] kaboom');
    eq('bearer token reached server', authSeen, 'Bearer secret-xyz');
  } finally {
    await client.close();
    server.close();
  }
}

ragSmoke();
await mcpSmoke();
console.log(failures === 0 ? '\n✅ smoke: all passed' : `\n❌ smoke: ${failures} failed`);
process.exit(failures === 0 ? 0 : 1);
