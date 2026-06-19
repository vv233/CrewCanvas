#!/usr/bin/env node
/**
 * CrewCanvas Companion — a local MCP server that gives CrewCanvas agents the
 * real-OS capabilities a browser can't have: writing real files, generating
 * .pptx decks, and (opt-in) running shell commands — all confined to one
 * workspace directory.
 *
 * It speaks the MCP Streamable HTTP protocol (initialize / tools/list /
 * tools/call) that CrewCanvas's MCP client already supports. It binds to
 * 127.0.0.1 only and requires a bearer token.
 *
 *   node server.mjs --workspace ~/projects/foo [--port 8787] [--allow-exec]
 *
 * Then paste the printed URL + token into CrewCanvas → Settings → MCP.
 *
 * SECURITY: this process can write files (and, with --allow-exec, run commands)
 * inside the workspace on behalf of a web page. Only point it at a directory you
 * trust the workflow with, keep the token private, and leave --allow-exec off
 * unless you need it.
 */
import http from 'node:http';
import { randomBytes } from 'node:crypto';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { exec } from 'node:child_process';

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const key = a.slice(2);
    const next = argv[i + 1];
    if (next && !next.startsWith('--')) {
      out[key] = next;
      i++;
    } else {
      out[key] = true;
    }
  }
  return out;
}

const args = parseArgs(process.argv.slice(2));
const PORT = Number(args.port) || 8787;
const WORKSPACE = path.resolve(String(args.workspace || process.cwd()));
const TOKEN = String(args.token || randomBytes(16).toString('hex'));
const ALLOW_EXEC = !!args['allow-exec'];

/** Resolve a user-supplied path against the workspace, rejecting any escape. */
function safePath(p) {
  const resolved = path.resolve(WORKSPACE, String(p ?? ''));
  if (resolved !== WORKSPACE && !resolved.startsWith(WORKSPACE + path.sep)) {
    throw new Error(`Path escapes workspace: ${p}`);
  }
  return resolved;
}

const TOOLS = [
  {
    name: 'write_file',
    description: 'Write a UTF-8 text file inside the workspace (creates parent dirs as needed).',
    inputSchema: {
      type: 'object',
      properties: { path: { type: 'string' }, content: { type: 'string' } },
      required: ['path', 'content'],
    },
  },
  {
    name: 'read_file',
    description: 'Read a UTF-8 text file from the workspace.',
    inputSchema: { type: 'object', properties: { path: { type: 'string' } }, required: ['path'] },
  },
  {
    name: 'list_dir',
    description: 'List entries of a workspace directory (defaults to the workspace root).',
    inputSchema: { type: 'object', properties: { path: { type: 'string' } } },
  },
  {
    name: 'make_pptx',
    description:
      'Generate a PowerPoint .pptx file. `slides` is an array of { title?, bullets?: string[], body? }. Returns the saved path.',
    inputSchema: {
      type: 'object',
      properties: { filename: { type: 'string' }, slides: { type: 'array' } },
      required: ['filename', 'slides'],
    },
  },
  ...(ALLOW_EXEC
    ? [
        {
          name: 'run_command',
          description:
            'Run a shell command in the workspace and return stdout/stderr. Enabled because the companion was started with --allow-exec.',
          inputSchema: {
            type: 'object',
            properties: { command: { type: 'string' }, timeout_ms: { type: 'number' } },
            required: ['command'],
          },
        },
      ]
    : []),
];

async function callTool(name, a = {}) {
  switch (name) {
    case 'write_file': {
      const p = safePath(a.path);
      await fsp.mkdir(path.dirname(p), { recursive: true });
      const content = String(a.content ?? '');
      await fsp.writeFile(p, content, 'utf8');
      return `Wrote ${path.relative(WORKSPACE, p) || '.'} (${Buffer.byteLength(content)} bytes)`;
    }
    case 'read_file':
      return await fsp.readFile(safePath(a.path), 'utf8');
    case 'list_dir': {
      const entries = await fsp.readdir(safePath(a.path ?? '.'), { withFileTypes: true });
      if (!entries.length) return '(empty)';
      return entries
        .map((e) => (e.isDirectory() ? `📁 ${e.name}/` : `📄 ${e.name}`))
        .join('\n');
    }
    case 'make_pptx': {
      const { default: PptxGenJS } = await import('pptxgenjs');
      const pptx = new PptxGenJS();
      const slides = Array.isArray(a.slides) ? a.slides : [];
      for (const s of slides) {
        const slide = pptx.addSlide();
        if (s.title) {
          slide.addText(String(s.title), { x: 0.5, y: 0.3, w: 9, h: 1, fontSize: 28, bold: true });
        }
        if (Array.isArray(s.bullets) && s.bullets.length) {
          slide.addText(
            s.bullets.map((b) => ({ text: String(b), options: { bullet: true } })),
            { x: 0.7, y: 1.4, w: 8.6, h: 4.5, fontSize: 18 }
          );
        } else if (s.body) {
          slide.addText(String(s.body), { x: 0.7, y: 1.4, w: 8.6, h: 4.5, fontSize: 18 });
        }
      }
      const fn = String(a.filename || 'presentation.pptx');
      const p = safePath(fn.endsWith('.pptx') ? fn : `${fn}.pptx`);
      await fsp.mkdir(path.dirname(p), { recursive: true });
      await pptx.writeFile({ fileName: p });
      return `Wrote ${path.relative(WORKSPACE, p)} (${slides.length} slides)`;
    }
    case 'run_command': {
      if (!ALLOW_EXEC) throw new Error('run_command is disabled (start with --allow-exec)');
      const timeout = Math.min(Number(a.timeout_ms) || 60_000, 300_000);
      return await new Promise((resolve) => {
        exec(
          String(a.command),
          { cwd: WORKSPACE, timeout, maxBuffer: 4 * 1024 * 1024 },
          (err, stdout, stderr) => {
            const out = [
              stdout && `[stdout]\n${stdout}`,
              stderr && `[stderr]\n${stderr}`,
              err && `[exit] ${err.code ?? err.message}`,
            ]
              .filter(Boolean)
              .join('\n');
            resolve(out || '(no output)');
          }
        );
      });
    }
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

async function handleRpc(msg) {
  const { id, method, params } = msg || {};
  if (method === 'initialize') {
    return {
      jsonrpc: '2.0',
      id,
      result: {
        protocolVersion: params?.protocolVersion ?? '2025-06-18',
        capabilities: { tools: {} },
        serverInfo: { name: 'crewcanvas-companion', version: '0.1.0' },
      },
    };
  }
  if (method === 'tools/list') return { jsonrpc: '2.0', id, result: { tools: TOOLS } };
  if (method === 'tools/call') {
    const { name, arguments: a } = params || {};
    try {
      const text = await callTool(name, a || {});
      return { jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: String(text) }] } };
    } catch (err) {
      return {
        jsonrpc: '2.0',
        id,
        result: { content: [{ type: 'text', text: err?.message || String(err) }], isError: true },
      };
    }
  }
  if (id !== undefined) {
    return { jsonrpc: '2.0', id, error: { code: -32601, message: `method not found: ${method}` } };
  }
  return null; // notification — no response body
}

function setCors(req, res) {
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, DELETE, OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization, Mcp-Session-Id, MCP-Protocol-Version, Accept'
  );
  res.setHeader('Access-Control-Expose-Headers', 'Mcp-Session-Id');
}

const server = http.createServer(async (req, res) => {
  setCors(req, res);
  if (req.method === 'OPTIONS') return void res.writeHead(204).end();

  if ((req.headers.authorization || '') !== `Bearer ${TOKEN}`) {
    res.writeHead(401, { 'Content-Type': 'application/json' });
    return void res.end(JSON.stringify({ error: 'unauthorized' }));
  }
  if (req.method === 'GET') return void res.writeHead(405).end(); // no server->client stream
  if (req.method === 'DELETE') return void res.writeHead(200).end();
  if (req.method !== 'POST') return void res.writeHead(405).end();

  let raw = '';
  for await (const chunk of req) raw += chunk;
  let body;
  try {
    body = raw ? JSON.parse(raw) : undefined;
  } catch {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    return void res.end(JSON.stringify({ error: 'invalid json' }));
  }

  const resp = await handleRpc(body);
  if (resp == null) return void res.writeHead(202).end();
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(resp));
});

server.listen(PORT, '127.0.0.1', () => {
  const url = `http://127.0.0.1:${PORT}/mcp`;
  process.stdout.write(
    [
      '',
      'CrewCanvas Companion running',
      `  Workspace : ${WORKSPACE}`,
      `  URL       : ${url}`,
      `  Token     : ${TOKEN}`,
      `  Exec      : ${ALLOW_EXEC ? 'ENABLED (--allow-exec)' : 'disabled'}`,
      '',
      'In CrewCanvas → Settings → MCP, add a local server with the URL and token above.',
      '',
    ].join('\n')
  );
});
