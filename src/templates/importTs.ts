/**
 * Compile a user-supplied TypeScript snippet into a WorkflowTemplate.
 *
 * The snippet must `export default` an object shaped like WorkflowTemplate
 * ({ id, name, description, build() }). It must NOT use `import` statements;
 * the helpers `nanoid`, `defaultNodeData`, `SOUL_PRESETS`, `presetAgent` are
 * available as globals inside the snippet.
 *
 * The compile path is: strip imports → sucrase (TS → ESM JS) → Blob URL →
 * dynamic `import()`. Sucrase itself is loaded lazily so it stays out of the
 * main bundle.
 */
import { nanoid } from 'nanoid';
import type { AnyNodeData } from '../types';
import { defaultNodeData } from '../lib/nodeFactory';
import { SOUL_PRESETS } from './soulPresets';
import type { WorkflowTemplate } from './workflowTemplates';

declare global {
  interface Window {
    __aiof_template_globals?: TemplateGlobals;
  }
}

interface TemplateGlobals {
  nanoid: typeof nanoid;
  defaultNodeData: typeof defaultNodeData;
  SOUL_PRESETS: typeof SOUL_PRESETS;
  presetAgent: (presetId: string) => AnyNodeData;
}

function presetAgent(presetId: string): AnyNodeData {
  const preset = SOUL_PRESETS.find((p) => p.id === presetId);
  if (!preset) throw new Error(`未知 soul 预设: "${presetId}"`);
  const base = defaultNodeData('agent') as Extract<AnyNodeData, { kind: 'agent' }>;
  return { ...base, name: preset.name, avatar: preset.avatar, soul: preset.soul };
}

function ensureGlobals() {
  if (!window.__aiof_template_globals) {
    window.__aiof_template_globals = {
      nanoid,
      defaultNodeData,
      SOUL_PRESETS,
      presetAgent,
    };
  }
}

export class TemplateCompileError extends Error {
  cause?: unknown;
  constructor(msg: string, cause?: unknown) {
    super(msg);
    this.cause = cause;
  }
}

/** Strip `import ... from '...'` and `import 'foo'` lines. Anything else is
 *  left alone (the user is not supposed to use them, but we keep parsing
 *  forgiving). */
function stripImports(src: string): string {
  return src.replace(/^\s*import\s[^;\n]*;?\s*$/gm, '');
}

/** If the user pastes a bare object literal (typical when copying out of a
 *  `WORKFLOW_TEMPLATES` array entry), wrap it in `export default` so it
 *  parses. We only kick in when the trimmed source starts with `{` and ends
 *  with `}` or `},` — anything else is left untouched. */
function autoWrapObjectLiteral(src: string): string {
  const trimmed = src.trim();
  if (!trimmed.startsWith('{')) return src;
  if (!/}[,;]?\s*$/.test(trimmed)) return src;
  // Heuristic: if the user already wrote `export default`, don't double-wrap.
  if (/^\s*export\s+default\b/m.test(trimmed)) return src;
  // Strip trailing comma so `export default { ... },` doesn't become illegal.
  const cleaned = trimmed.replace(/,\s*$/, '');
  return `export default ${cleaned};\n`;
}

let sucrasePromise: Promise<typeof import('sucrase')> | null = null;
async function getSucrase() {
  if (!sucrasePromise) sucrasePromise = import('sucrase');
  return sucrasePromise;
}

export async function compileTemplateSource(
  src: string
): Promise<WorkflowTemplate> {
  ensureGlobals();

  const wrapped = autoWrapObjectLiteral(src);
  const stripped = stripImports(wrapped);
  // Inject the global helpers at the top of the module so the user can call
  // them without an import line.
  const prelude = `const { nanoid, defaultNodeData, SOUL_PRESETS, presetAgent } = window.__aiof_template_globals;\n`;

  let jsCode: string;
  try {
    const { transform } = await getSucrase();
    const result = transform(prelude + stripped, {
      transforms: ['typescript'],
      // Keep ESM `export default` as-is so dynamic import() can read it.
    });
    jsCode = result.code;
  } catch (err) {
    throw new TemplateCompileError(
      `TypeScript 编译失败: ${err instanceof Error ? err.message : String(err)}`,
      err
    );
  }

  let mod: { default?: unknown };
  let blobUrl: string | null = null;
  try {
    const blob = new Blob([jsCode], { type: 'text/javascript' });
    blobUrl = URL.createObjectURL(blob);
    mod = (await import(/* @vite-ignore */ blobUrl)) as { default?: unknown };
  } catch (err) {
    throw new TemplateCompileError(
      `执行失败: ${err instanceof Error ? err.message : String(err)}`,
      err
    );
  } finally {
    if (blobUrl) URL.revokeObjectURL(blobUrl);
  }

  const tpl = (mod.default ?? mod) as Partial<WorkflowTemplate>;
  if (
    !tpl ||
    typeof tpl !== 'object' ||
    typeof tpl.id !== 'string' ||
    typeof tpl.name !== 'string' ||
    typeof tpl.build !== 'function'
  ) {
    throw new TemplateCompileError(
      '模板必须 export default 一个含 { id: string, name: string, description?: string, build(): Workflow } 的对象'
    );
  }
  return tpl as WorkflowTemplate;
}

export const EXAMPLE_TEMPLATE_TS = `// 可用的全局变量：nanoid, defaultNodeData, SOUL_PRESETS, presetAgent
// 不能使用 import 语句

interface Foo { id: string }  // TS 类型注解可写，会被剥离

export default {
  id: 'my-translator',
  name: '我的翻译模板',
  description: '一个最简单的翻译流：trigger → translator → output',
  build() {
    const trig = nanoid();
    const ag = nanoid();
    const out = nanoid();
    return {
      id: nanoid(),
      name: '我的翻译模板',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      variables: {},
      nodes: [
        {
          id: trig,
          type: 'trigger',
          position: { x: 40, y: 200 },
          data: {
            ...defaultNodeData('trigger'),
            input: 'The quick brown fox jumps over the lazy dog.',
          },
        },
        {
          id: ag,
          type: 'agent',
          position: { x: 340, y: 200 },
          data: presetAgent('translator'),
        },
        {
          id: out,
          type: 'output',
          position: { x: 640, y: 200 },
          data: defaultNodeData('output'),
        },
      ],
      edges: [
        { id: nanoid(), source: trig, target: ag,  type: 'pipe', data: { type: 'pipe' } },
        { id: nanoid(), source: ag,   target: out, type: 'pipe', data: { type: 'pipe' } },
      ],
    };
  },
};
`;
