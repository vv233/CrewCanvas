import type { FlowEdge, FlowNode, Workflow } from '../types';

export interface GraphIndex {
  nodes: Map<string, FlowNode>;
  incoming: Map<string, FlowEdge[]>;
  outgoing: Map<string, FlowEdge[]>;
}

export function buildIndex(wf: Workflow): GraphIndex {
  const nodes = new Map<string, FlowNode>();
  const incoming = new Map<string, FlowEdge[]>();
  const outgoing = new Map<string, FlowEdge[]>();
  for (const n of wf.nodes) {
    nodes.set(n.id, n);
    incoming.set(n.id, []);
    outgoing.set(n.id, []);
  }
  for (const e of wf.edges) {
    incoming.get(e.target)?.push(e);
    outgoing.get(e.source)?.push(e);
  }
  return { nodes, incoming, outgoing };
}

/** 顶层节点（不在任何 Room 内）。Room 内部的子节点由 roomLoop 单独调度。 */
export function topLevelNodeIds(wf: Workflow): Set<string> {
  return new Set(
    wf.nodes
      .filter((n) => !(n as FlowNode & { parentId?: string }).parentId)
      .map((n) => n.id)
  );
}

/** 被 `manage` 边指向的节点 — 它们由上司 agent 通过 delegate 工具触发，
 *  不进入主调度。 */
export function managedNodeIds(wf: Workflow): Set<string> {
  const ids = new Set<string>();
  for (const e of wf.edges) {
    const t = (e.data?.type ?? e.type) as string;
    if (t === 'manage') ids.add(e.target);
  }
  return ids;
}

/** 给定一个 manager 节点 id，返回它通过 `manage` 边指向的下属节点列表。 */
export function subordinateNodes(
  wf: Workflow,
  managerId: string,
  idx = buildIndex(wf)
): FlowNode[] {
  const out: FlowNode[] = [];
  for (const e of idx.outgoing.get(managerId) ?? []) {
    const t = (e.data?.type ?? e.type) as string;
    if (t !== 'manage') continue;
    const n = idx.nodes.get(e.target);
    if (n) out.push(n);
  }
  return out;
}

/** 给定 room 节点 id，返回它的子 agent 节点列表（按 z-order）。 */
export function roomMembers(wf: Workflow, roomId: string): FlowNode[] {
  return wf.nodes.filter(
    (n) =>
      (n as FlowNode & { parentId?: string }).parentId === roomId &&
      n.type === 'agent'
  );
}

/**
 * 拓扑排序。忽略 `report` 边（因为汇报是事后异步，对调度顺序无依赖）。
 * 仅排序顶层节点（Room 内部子节点由 Room 自己调度）。
 * 返回节点 id 的执行批次（同批可并行）。
 */
export function topoBatches(wf: Workflow, idx = buildIndex(wf)): string[][] {
  const topLevel = topLevelNodeIds(wf);
  const managed = managedNodeIds(wf);
  // Eligible = top-level AND not under a manager. Managed nodes are run
  // on-demand by delegate() calls, not by the main scheduler.
  const eligible = new Set(
    [...topLevel].filter((id) => !managed.has(id))
  );
  const indeg = new Map<string, number>();
  for (const id of eligible) {
    const incoming = (idx.incoming.get(id) ?? []).filter(
      (e) =>
        (e.data?.type ?? e.type) !== 'report' &&
        (e.data?.type ?? e.type) !== 'manage' &&
        eligible.has(e.source)
    );
    indeg.set(id, incoming.length);
  }
  const batches: string[][] = [];
  const remaining = new Set(eligible);
  while (remaining.size > 0) {
    const batch: string[] = [];
    for (const id of remaining) {
      if ((indeg.get(id) ?? 0) === 0) batch.push(id);
    }
    if (batch.length === 0) {
      batches.push(Array.from(remaining));
      break;
    }
    for (const id of batch) {
      remaining.delete(id);
      for (const e of idx.outgoing.get(id) ?? []) {
        const t = e.data?.type ?? e.type;
        if (t === 'report' || t === 'manage') continue;
        if (!eligible.has(e.target)) continue;
        indeg.set(e.target, (indeg.get(e.target) ?? 0) - 1);
      }
    }
    batches.push(batch);
  }
  return batches;
}
