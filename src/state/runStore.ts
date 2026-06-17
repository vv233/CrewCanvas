import { create } from 'zustand';
import type { NodeRunState, NodeTrace } from '../types';
import i18n from '../i18n';

export interface DiscussionMessage {
  role: 'user' | 'assistant';
  content: string;
  ts: number;
}

export interface DiscussionState {
  messages: DiscussionMessage[];
  /** 'thinking' = AI is streaming a reply; 'idle' = waiting for user input;
   *  'done' = user clicked 完成; the runNode resolver will fire. */
  phase: 'thinking' | 'idle' | 'done';
  /** Set when the user provides a final summary in the "结论" box;
   *  if missing, the last assistant message is used as output. */
  finalOutput?: string;
}

/** Per-node pending Promise resolvers. Each is awaited by the runNode loop
 *  and triggered by sendDiscussionMessage / finishDiscussion. */
const resolvers = new Map<string, () => void>();

interface RunStore {
  isRunning: boolean;
  runId: string | null;
  nodeStates: Record<string, NodeRunState>;
  nodeTraces: Record<string, NodeTrace>;
  logs: { ts: number; nodeId?: string; level: 'info' | 'warn' | 'error'; msg: string }[];
  discussions: Record<string, DiscussionState>;

  beginRun: (runId: string) => void;
  endRun: () => void;
  setNodeState: (id: string, patch: Partial<NodeRunState>) => void;
  setNodeTrace: (id: string, trace: NodeTrace) => void;
  appendNodeOutput: (id: string, delta: string) => void;
  resetNode: (id: string) => void;
  resetAll: () => void;
  log: (level: 'info' | 'warn' | 'error', msg: string, nodeId?: string) => void;

  initDiscussion: (nodeId: string) => void;
  appendDiscussionDelta: (nodeId: string, delta: string) => void;
  setDiscussionPhase: (nodeId: string, phase: DiscussionState['phase']) => void;
  /** User typed a message and clicked send. Resumes the runNode loop. */
  sendDiscussionMessage: (nodeId: string, text: string) => void;
  /** User clicked 完成. Optionally pass a summary; otherwise the last AI
   *  message will be used downstream. Resumes the runNode loop. */
  finishDiscussion: (nodeId: string, finalOutput?: string) => void;
}

/** runNode awaits this to be unblocked by user action. */
export function waitForDiscussionEvent(
  nodeId: string,
  signal: AbortSignal
): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    if (signal.aborted) {
      reject(new DOMException('aborted', 'AbortError'));
      return;
    }
    resolvers.set(nodeId, resolve);
    const onAbort = () => {
      resolvers.delete(nodeId);
      reject(new DOMException('aborted', 'AbortError'));
    };
    signal.addEventListener('abort', onAbort, { once: true });
  });
}

function trigger(nodeId: string) {
  const r = resolvers.get(nodeId);
  if (r) {
    resolvers.delete(nodeId);
    r();
  }
}

export const useRunStore = create<RunStore>((set) => ({
  isRunning: false,
  runId: null,
  nodeStates: {},
  nodeTraces: {},
  logs: [],
  discussions: {},

  beginRun: (runId) =>
    set({ isRunning: true, runId, nodeStates: {}, nodeTraces: {}, logs: [], discussions: {} }),
  endRun: () => {
    // Unblock any pending discussion awaiters so the run can wind down.
    for (const id of Array.from(resolvers.keys())) trigger(id);
    set({ isRunning: false });
  },

  setNodeState: (id, patch) =>
    set((s) => {
      const prev = s.nodeStates[id] ?? { status: 'idle' as const, output: '' };
      const next = { ...prev, ...patch };
      // Auto-emit final output to console when a node transitions to done.
      // Errors are logged separately by the caller; only mirror successful
      // completions here.
      let logs = s.logs;
      const justDone = prev.status !== 'done' && next.status === 'done';
      if (justDone) {
        const text = (next.output ?? prev.output ?? '').trim();
        if (text) {
          logs = [
            ...logs,
            {
              ts: Date.now(),
              level: 'info' as const,
              msg: i18n.t('store.outputLog', { text }),
              nodeId: id,
            },
          ].slice(-500);
        }
      }
      return {
        nodeStates: { ...s.nodeStates, [id]: next },
        logs,
      };
    }),

  setNodeTrace: (id, trace) =>
    set((s) => ({ nodeTraces: { ...s.nodeTraces, [id]: trace } })),

  appendNodeOutput: (id, delta) =>
    set((s) => {
      const prev = s.nodeStates[id] ?? { status: 'running', output: '' };
      return {
        nodeStates: {
          ...s.nodeStates,
          [id]: { ...prev, output: (prev.output ?? '') + delta },
        },
      };
    }),

  resetNode: (id) =>
    set((s) => {
      const next = { ...s.nodeStates };
      delete next[id];
      return { nodeStates: next };
    }),

  resetAll: () => set({ nodeStates: {}, nodeTraces: {}, logs: [] }),

  log: (level, msg, nodeId) =>
    set((s) => ({
      logs: [...s.logs, { ts: Date.now(), level, msg, nodeId }].slice(-500),
    })),

  initDiscussion: (nodeId) =>
    set((s) => ({
      discussions: {
        ...s.discussions,
        [nodeId]: { messages: [], phase: 'thinking' },
      },
    })),

  appendDiscussionDelta: (nodeId, delta) =>
    set((s) => {
      const d = s.discussions[nodeId];
      if (!d) return {};
      const msgs = [...d.messages];
      const last = msgs[msgs.length - 1];
      if (last && last.role === 'assistant') {
        msgs[msgs.length - 1] = { ...last, content: last.content + delta };
      } else {
        msgs.push({ role: 'assistant', content: delta, ts: Date.now() });
      }
      return {
        discussions: { ...s.discussions, [nodeId]: { ...d, messages: msgs } },
      };
    }),

  setDiscussionPhase: (nodeId, phase) =>
    set((s) => {
      const d = s.discussions[nodeId];
      if (!d) return {};
      return {
        discussions: { ...s.discussions, [nodeId]: { ...d, phase } },
      };
    }),

  sendDiscussionMessage: (nodeId, text) => {
    set((s) => {
      const d = s.discussions[nodeId];
      if (!d) return {};
      return {
        discussions: {
          ...s.discussions,
          [nodeId]: {
            ...d,
            messages: [
              ...d.messages,
              { role: 'user', content: text, ts: Date.now() },
            ],
            phase: 'thinking',
          },
        },
      };
    });
    trigger(nodeId);
  },

  finishDiscussion: (nodeId, finalOutput) => {
    set((s) => {
      const d = s.discussions[nodeId];
      if (!d) return {};
      return {
        discussions: {
          ...s.discussions,
          [nodeId]: { ...d, phase: 'done', finalOutput },
        },
      };
    });
    trigger(nodeId);
  },
}));
