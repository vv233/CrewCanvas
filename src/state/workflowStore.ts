import { create } from 'zustand';
import {
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  type Connection,
  type EdgeChange,
  type NodeChange,
} from '@xyflow/react';
import { nanoid } from 'nanoid';
import type {
  AgentNodeData,
  AnyNodeData,
  EdgeData,
  EdgeType,
  FlowEdge,
  FlowNode,
  NodeType,
  Workflow,
} from '../types';
import { defaultNodeData } from '../lib/nodeFactory';
import i18n from '../i18n';

const STORAGE_KEY = 'aiof.workflow.v1';

interface WorkflowStore {
  workflow: Workflow;
  selectedNodeId: string | null;
  selectedEdgeId: string | null;
  past: Workflow[];
  future: Workflow[];

  setWorkflowName: (name: string) => void;
  setVariables: (vars: Record<string, string>) => void;

  onNodesChange: (changes: NodeChange[]) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;
  onConnect: (conn: Connection) => void;

  addNode: (type: NodeType, position: { x: number; y: number }) => string;
  /** Batch-create agent nodes from imported role-card data. Returns new node ids. */
  addAgentNodes: (agents: AgentNodeData[]) => string[];
  /** Batch-create nodes from copied data (paste). New ids; the pasted nodes
   *  become the selection. Returns new node ids. */
  duplicateNodes: (
    items: { type: NodeType; position: { x: number; y: number }; data: AnyNodeData }[]
  ) => string[];
  updateNodeData: (id: string, patch: Partial<AnyNodeData>) => void;
  removeNode: (id: string) => void;
  /** Delete everything currently selected (nodes — with their room children —
   *  and edges) in a single undo step. Falls back to the single inspector
   *  selection if no nodes/edges carry the React Flow `selected` flag. */
  removeSelected: () => void;

  updateEdgeData: (id: string, patch: Partial<EdgeData>) => void;
  removeEdge: (id: string) => void;

  setNodeParent: (
    childId: string,
    parentId: string | null,
    relativePosition?: { x: number; y: number }
  ) => void;

  selectNode: (id: string | null) => void;
  selectEdge: (id: string | null) => void;

  loadWorkflow: (wf: Workflow) => void;
  resetWorkflow: () => void;

  undo: () => void;
  redo: () => void;
}

const MAX_HISTORY = 50;
const PERSIST_DEBOUNCE_MS = 250;
let persistTimer: number | null = null;
let pendingPersist: Workflow | null = null;

function sortByParent(nodes: FlowNode[]): FlowNode[] {
  // 父节点必须排在子节点前面（React Flow v12 要求）
  const out: FlowNode[] = [];
  const remaining = new Set(nodes.map((n) => n.id));
  const byId = new Map(nodes.map((n) => [n.id, n] as const));
  const visit = (id: string) => {
    if (!remaining.has(id)) return;
    const n = byId.get(id);
    if (!n) return;
    const p = (n as FlowNode & { parentId?: string }).parentId;
    if (p && remaining.has(p)) visit(p);
    out.push(n);
    remaining.delete(id);
  };
  for (const n of nodes) visit(n.id);
  return out;
}

function emptyWorkflow(): Workflow {
  return {
    id: nanoid(),
    name: i18n.t('store.untitledWorkflow'),
    nodes: [],
    edges: [],
    variables: {},
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

function loadFromStorage(): Workflow {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return seedWorkflow();
    const parsed = JSON.parse(raw) as Workflow;
    if (!parsed.nodes) return seedWorkflow();
    return parsed;
  } catch {
    return seedWorkflow();
  }
}

function seedWorkflow(): Workflow {
  const wf = emptyWorkflow();
  const triggerId = nanoid();
  const agentId = nanoid();
  const outputId = nanoid();
  wf.name = i18n.t('store.demoName');
  wf.nodes = [
    {
      id: triggerId,
      type: 'trigger',
      position: { x: 80, y: 200 },
      data: defaultNodeData('trigger'),
    },
    {
      id: agentId,
      type: 'agent',
      position: { x: 380, y: 180 },
      data: { ...defaultNodeData('agent'), name: i18n.t('store.demoAssistant') } as AnyNodeData,
    },
    {
      id: outputId,
      type: 'output',
      position: { x: 720, y: 200 },
      data: defaultNodeData('output'),
    },
  ];
  wf.edges = [
    {
      id: nanoid(),
      source: triggerId,
      target: agentId,
      type: 'pipe',
      data: { type: 'pipe' },
    },
    {
      id: nanoid(),
      source: agentId,
      target: outputId,
      type: 'pipe',
      data: { type: 'pipe' },
    },
  ];
  return wf;
}

function writePersist(wf: Workflow) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(wf));
  } catch {
    /* quota or private mode */
  }
}

function flushPersist() {
  if (persistTimer !== null && typeof window !== 'undefined') {
    window.clearTimeout(persistTimer);
  }
  persistTimer = null;
  const wf = pendingPersist;
  if (!wf) return;
  pendingPersist = null;
  writePersist(wf);
}

function persist(wf: Workflow, opts?: { immediate?: boolean }) {
  pendingPersist = wf;
  if (opts?.immediate || typeof window === 'undefined') {
    flushPersist();
    return;
  }
  if (persistTimer !== null) window.clearTimeout(persistTimer);
  persistTimer = window.setTimeout(flushPersist, PERSIST_DEBOUNCE_MS);
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', flushPersist);
}

function touch(wf: Workflow): Workflow {
  return { ...wf, updatedAt: Date.now() };
}

function pushHistory(past: Workflow[], current: Workflow): Workflow[] {
  const next = [...past, current];
  if (next.length > MAX_HISTORY) next.shift();
  return next;
}

export const useWorkflowStore = create<WorkflowStore>((set, get) => ({
  workflow: loadFromStorage(),
  selectedNodeId: null,
  selectedEdgeId: null,
  past: [],
  future: [],

  setWorkflowName: (name) => {
    const wf = touch({ ...get().workflow, name });
    persist(wf);
    set({ workflow: wf });
  },

  setVariables: (variables) => {
    const wf = touch({ ...get().workflow, variables });
    persist(wf);
    set({ workflow: wf });
  },

  onNodesChange: (changes) => {
    const wf = get().workflow;
    const nodes = applyNodeChanges(changes, wf.nodes) as FlowNode[];
    const next = touch({ ...wf, nodes });
    persist(next);
    set({ workflow: next });
  },

  onEdgesChange: (changes) => {
    const wf = get().workflow;
    const edges = applyEdgeChanges(changes, wf.edges) as FlowEdge[];
    const next = touch({ ...wf, edges });
    persist(next);
    set({ workflow: next });
  },

  onConnect: (conn) => {
    const wf = get().workflow;
    const edges = addEdge(
      {
        ...conn,
        id: nanoid(),
        type: 'pipe',
        data: { type: 'pipe' as EdgeType },
      },
      wf.edges
    ) as FlowEdge[];
    const next = touch({ ...wf, edges });
    persist(next, { immediate: true });
    set({
      workflow: next,
      past: pushHistory(get().past, wf),
      future: [],
    });
  },

  addNode: (type, position) => {
    const id = nanoid();
    const wf = get().workflow;
    const newNode: FlowNode = {
      id,
      type,
      position,
      data: defaultNodeData(type),
      ...(type === 'room'
        ? { style: { width: 360, height: 260 } }
        : {}),
    };
    const next = touch({ ...wf, nodes: [...wf.nodes, newNode] });
    persist(next, { immediate: true });
    set({
      workflow: next,
      selectedNodeId: id,
      selectedEdgeId: null,
      past: pushHistory(get().past, wf),
      future: [],
    });
    return id;
  },

  addAgentNodes: (agents) => {
    if (agents.length === 0) return [];
    const wf = get().workflow;
    const ids: string[] = [];
    const newNodes: FlowNode[] = agents.map((data, i) => {
      const id = nanoid();
      ids.push(id);
      return {
        id,
        type: 'agent',
        position: { x: 80 + (i % 4) * 80, y: 80 + Math.floor(i / 4) * 80 },
        data,
      };
    });
    const next = touch({ ...wf, nodes: [...wf.nodes, ...newNodes] });
    persist(next, { immediate: true });
    set({
      workflow: next,
      selectedNodeId: ids[ids.length - 1] ?? null,
      selectedEdgeId: null,
      past: pushHistory(get().past, wf),
      future: [],
    });
    return ids;
  },

  duplicateNodes: (items) => {
    if (items.length === 0) return [];
    const wf = get().workflow;
    const ids: string[] = [];
    const newNodes: FlowNode[] = items.map((it) => {
      const id = nanoid();
      ids.push(id);
      return {
        id,
        type: it.type,
        position: it.position,
        data: it.data,
        selected: true,
        ...(it.type === 'room' ? { style: { width: 360, height: 260 } } : {}),
      };
    });
    // Deselect existing nodes so the pasted ones are the active selection.
    const nodes = [
      ...wf.nodes.map((n) => (n.selected ? { ...n, selected: false } : n)),
      ...newNodes,
    ];
    const next = touch({ ...wf, nodes });
    persist(next, { immediate: true });
    set({
      workflow: next,
      selectedNodeId: ids[ids.length - 1] ?? null,
      selectedEdgeId: null,
      past: pushHistory(get().past, wf),
      future: [],
    });
    return ids;
  },

  setNodeParent: (childId, parentId, relativePosition) => {
    const wf = get().workflow;
    const nodes = wf.nodes.map((n) => {
      if (n.id !== childId) return n;
      if (parentId == null) {
        const { parentId: _drop, extent: _e, ...rest } = n as FlowNode & {
          parentId?: string;
          extent?: string;
        };
        return { ...rest, position: relativePosition ?? n.position } as FlowNode;
      }
      return {
        ...n,
        parentId,
        extent: 'parent' as const,
        position: relativePosition ?? n.position,
      } as FlowNode;
    });
    const sorted = sortByParent(nodes);
    const next = touch({ ...wf, nodes: sorted });
    persist(next, { immediate: true });
    set({
      workflow: next,
      past: pushHistory(get().past, wf),
      future: [],
    });
  },

  updateNodeData: (id, patch) => {
    const wf = get().workflow;
    const nodes = wf.nodes.map((n) =>
      n.id === id ? { ...n, data: { ...n.data, ...patch } as AnyNodeData } : n
    );
    const next = touch({ ...wf, nodes });
    persist(next);
    set({ workflow: next });
  },

  removeNode: (id) => {
    const wf = get().workflow;
    const childIds = wf.nodes
      .filter((n) => (n as FlowNode & { parentId?: string }).parentId === id)
      .map((n) => n.id);
    const toRemove = new Set([id, ...childIds]);
    const nodes = wf.nodes.filter((n) => !toRemove.has(n.id));
    const edges = wf.edges.filter(
      (e) => !toRemove.has(e.source) && !toRemove.has(e.target)
    );
    const next = touch({ ...wf, nodes, edges });
    persist(next, { immediate: true });
    set({
      workflow: next,
      selectedNodeId: get().selectedNodeId === id ? null : get().selectedNodeId,
      past: pushHistory(get().past, wf),
      future: [],
    });
  },

  removeSelected: () => {
    const wf = get().workflow;
    const nodeIds = new Set(wf.nodes.filter((n) => n.selected).map((n) => n.id));
    const edgeIds = new Set(wf.edges.filter((e) => e.selected).map((e) => e.id));
    if (nodeIds.size === 0 && edgeIds.size === 0) {
      const { selectedNodeId, selectedEdgeId } = get();
      if (selectedNodeId) nodeIds.add(selectedNodeId);
      if (selectedEdgeId) edgeIds.add(selectedEdgeId);
    }
    if (nodeIds.size === 0 && edgeIds.size === 0) return;
    // Pull in room children of any selected node.
    for (const n of wf.nodes) {
      const pid = (n as FlowNode & { parentId?: string }).parentId;
      if (pid && nodeIds.has(pid)) nodeIds.add(n.id);
    }
    const nodes = wf.nodes.filter((n) => !nodeIds.has(n.id));
    const edges = wf.edges.filter(
      (e) => !edgeIds.has(e.id) && !nodeIds.has(e.source) && !nodeIds.has(e.target)
    );
    const next = touch({ ...wf, nodes, edges });
    persist(next, { immediate: true });
    set({
      workflow: next,
      selectedNodeId: null,
      selectedEdgeId: null,
      past: pushHistory(get().past, wf),
      future: [],
    });
  },

  updateEdgeData: (id, patch) => {
    const wf = get().workflow;
    const edges = wf.edges.map((e) =>
      e.id === id
        ? {
            ...e,
            type: patch.type ?? e.type,
            data: { ...(e.data ?? { type: 'pipe' }), ...patch } as EdgeData,
          }
        : e
    );
    const next = touch({ ...wf, edges });
    persist(next);
    set({ workflow: next });
  },

  removeEdge: (id) => {
    const wf = get().workflow;
    const edges = wf.edges.filter((e) => e.id !== id);
    const next = touch({ ...wf, edges });
    persist(next, { immediate: true });
    set({
      workflow: next,
      selectedEdgeId: get().selectedEdgeId === id ? null : get().selectedEdgeId,
      past: pushHistory(get().past, wf),
      future: [],
    });
  },

  selectNode: (id) => set({ selectedNodeId: id, selectedEdgeId: null }),
  selectEdge: (id) => set({ selectedEdgeId: id, selectedNodeId: null }),

  loadWorkflow: (wf) => {
    const prev = get().workflow;
    persist(wf, { immediate: true });
    set({
      workflow: wf,
      selectedNodeId: null,
      selectedEdgeId: null,
      past: pushHistory(get().past, prev),
      future: [],
    });
  },

  resetWorkflow: () => {
    const prev = get().workflow;
    const wf = seedWorkflow();
    persist(wf, { immediate: true });
    set({
      workflow: wf,
      selectedNodeId: null,
      selectedEdgeId: null,
      past: pushHistory(get().past, prev),
      future: [],
    });
  },

  undo: () => {
    const { past, workflow, future } = get();
    if (past.length === 0) return;
    const prev = past[past.length - 1];
    persist(prev, { immediate: true });
    set({
      workflow: prev,
      past: past.slice(0, -1),
      future: [workflow, ...future].slice(0, MAX_HISTORY),
      selectedNodeId: null,
      selectedEdgeId: null,
    });
  },

  redo: () => {
    const { past, workflow, future } = get();
    if (future.length === 0) return;
    const next = future[0];
    persist(next, { immediate: true });
    set({
      workflow: next,
      past: [...past, workflow].slice(-MAX_HISTORY),
      future: future.slice(1),
      selectedNodeId: null,
      selectedEdgeId: null,
    });
  },
}));
