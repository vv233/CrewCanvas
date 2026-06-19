/**
 * In-browser code execution tool. Exposes `run_js` to every tool-capable agent:
 * the model writes JavaScript, we run it in a QuickJS WASM sandbox (no DOM, no
 * network, no host access), and return the captured console output + the value
 * of the last expression. This turns "write code" agents from text-only into
 * ones that can actually compute, test, and verify.
 *
 * The WASM engine is dynamically imported on first use so it stays out of the
 * main bundle.
 */

import type { QuickJSWASMModule } from 'quickjs-emscripten-core';
import type { ToolDef } from '../types';
import type { BuiltinTools } from './builtinTools';
import i18n from '../i18n';

const DEFAULT_TIMEOUT_MS = 3_000;
const MAX_TIMEOUT_MS = 15_000;
const MEMORY_LIMIT_BYTES = 64 * 1024 * 1024;
const OUTPUT_CHAR_LIMIT = 8_000;

interface RunResult {
  logs: string[];
  value?: unknown;
  error?: string;
  timedOut: boolean;
}

// The WASM engine is loaded once, on first use, from a single pinned variant
// (release-sync wasmfile) so only one .wasm ships and it stays out of the main
// bundle.
let modulePromise: Promise<QuickJSWASMModule> | null = null;
function loadQuickJS(): Promise<QuickJSWASMModule> {
  if (!modulePromise) {
    modulePromise = (async () => {
      const [{ newQuickJSWASMModuleFromVariant }, { default: variant }] = await Promise.all([
        import('quickjs-emscripten-core'),
        import('@jitl/quickjs-singlefile-browser-release-sync'),
      ]);
      return newQuickJSWASMModuleFromVariant(variant);
    })();
  }
  return modulePromise;
}

/** Run a snippet of JavaScript in an isolated QuickJS sandbox. Exposed for
 *  tests; the agent reaches it through the `run_js` tool. */
export async function runJsSandbox(code: string, timeoutMs: number): Promise<RunResult> {
  const QuickJS = await loadQuickJS();
  const ctx = QuickJS.newContext();
  const logs: string[] = [];
  let timedOut = false;
  try {
    const deadline = Date.now() + timeoutMs;
    ctx.runtime.setMemoryLimit(MEMORY_LIMIT_BYTES);
    ctx.runtime.setInterruptHandler(() => {
      if (Date.now() > deadline) {
        timedOut = true;
        return true;
      }
      return false;
    });

    // Expose a console that captures output instead of touching the host.
    const logFn = ctx.newFunction('log', (...args) => {
      logs.push(args.map((a) => formatValue(ctx.dump(a))).join(' '));
    });
    const consoleObj = ctx.newObject();
    for (const method of ['log', 'info', 'warn', 'error', 'debug']) {
      ctx.setProp(consoleObj, method, logFn);
    }
    ctx.setProp(ctx.global, 'console', consoleObj);
    consoleObj.dispose();
    logFn.dispose();

    const result = ctx.evalCode(code);
    if (result.error) {
      const dumped = formatValue(ctx.dump(result.error));
      result.error.dispose();
      return { logs, error: dumped, timedOut };
    }
    const value = ctx.dump(result.value);
    result.value.dispose();
    return { logs, value, timedOut };
  } finally {
    ctx.dispose();
  }
}

function formatValue(v: unknown): string {
  if (v === undefined) return 'undefined';
  if (v === null) return 'null';
  if (typeof v === 'string') return v;
  if (typeof v === 'object' && v !== null && 'message' in v) {
    const e = v as { name?: string; message?: string };
    return `${e.name ?? 'Error'}: ${e.message ?? ''}`.trim();
  }
  try {
    return JSON.stringify(v, null, 2) ?? String(v);
  } catch {
    return String(v);
  }
}

/** Format a run for the model, capping total size. Exported for tests. */
export function formatRunOutput(r: RunResult, timeoutMs: number): string {
  const parts: string[] = [];
  if (r.logs.length) parts.push(`[stdout]\n${r.logs.join('\n')}`);
  if (r.timedOut) parts.push(`[error]\nExecution timed out after ${timeoutMs}ms`);
  else if (r.error) parts.push(`[error]\n${r.error}`);
  else if (r.value !== undefined) parts.push(`[result]\n${formatValue(r.value)}`);
  const out = parts.join('\n\n') || '(no output)';
  return out.length > OUTPUT_CHAR_LIMIT
    ? out.slice(0, OUTPUT_CHAR_LIMIT) + '\n…(truncated)'
    : out;
}

export function getCodeTools(): BuiltinTools {
  const tools: ToolDef[] = [
    {
      name: 'run_js',
      description: i18n.t('tools.runJsDesc'),
      inputSchema: {
        type: 'object',
        properties: {
          code: { type: 'string', description: i18n.t('tools.runJsCodeDesc') },
          timeout_ms: { type: 'number', description: i18n.t('tools.runJsTimeoutDesc') },
        },
        required: ['code'],
      },
    },
  ];

  const handlers = new Map<string, (args: unknown) => Promise<string>>();
  handlers.set('run_js', async (raw) => {
    const args = (raw ?? {}) as { code?: string; timeout_ms?: number };
    if (!args.code || !args.code.trim()) return i18n.t('tools.runJsNoCode');
    const timeoutMs = Math.min(
      MAX_TIMEOUT_MS,
      Math.max(100, args.timeout_ms ?? DEFAULT_TIMEOUT_MS)
    );
    try {
      const result = await runJsSandbox(args.code, timeoutMs);
      return formatRunOutput(result, timeoutMs);
    } catch (err) {
      return `[error]\n${err instanceof Error ? err.message : String(err)}`;
    }
  });

  return { tools, handlers };
}
