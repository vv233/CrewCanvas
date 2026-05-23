/**
 * 简易 mustache 变量插值。支持：
 *   {{input}}                  → ctx.input
 *   {{upstream.NodeName}}      → 指定上游节点的输出
 *   {{upstream.NodeName.output}} (同上 .output 是显式语法)
 *   {{var.X}}                  → 工作流变量
 *   {{room.history}}           → 群聊室聊天记录（M4）
 *
 * 找不到的变量保留原样。
 */
export interface InterpolateContext {
  input?: string;
  upstreams?: Record<string, string>; // 上游节点名 → 输出
  vars?: Record<string, string>;
  room?: { history?: string };
}

export function interpolate(template: string, ctx: InterpolateContext): string {
  return template.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (whole, expr: string) => {
    const path = expr.trim();
    if (path === 'input') return ctx.input ?? '';
    if (path === 'room.history') return ctx.room?.history ?? '';
    if (path.startsWith('upstream.')) {
      const rest = path.slice('upstream.'.length);
      const [name, ...tail] = rest.split('.');
      const v = ctx.upstreams?.[name];
      if (v == null) return whole;
      if (tail.length === 0 || tail.join('.') === 'output') return v;
      return whole;
    }
    if (path.startsWith('var.')) {
      const key = path.slice('var.'.length);
      return ctx.vars?.[key] ?? whole;
    }
    // Bare-identifier fallback: `{{members}}` reads ctx.vars.members.
    // Keeps older prompts working alongside the explicit `{{var.X}}` form.
    if (/^[a-zA-Z_][\w]*$/.test(path)) {
      const v = ctx.vars?.[path];
      if (v != null) return v;
    }
    return whole;
  });
}
