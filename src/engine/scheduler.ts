import type {
  AgentNodeData,
  AggregatorNodeData,
  DiscussNodeData,
  EdgeType,
  FlowEdge,
  FlowNode,
  Message,
  RoomNodeData,
  RouterNodeData,
  TriggerNodeData,
  Workflow,
} from '../types';
import { useRunStore, waitForDiscussionEvent } from '../state/runStore';
import { interpolate } from './interpolate';
import {
  buildIndex,
  roomMembers,
  topoBatches,
} from './graph';
import { ProviderError } from '../providers/types';
import { getProvider } from '../providers/registry';
import { runRoom } from './roomLoop';
import { runAgent, type DelegateTarget } from './runAgent';
import { createBufferedTextSink } from './streamBuffer';
import { saveRun, type RunRecord } from '../storage/db';
import { nanoid } from 'nanoid';
import i18n from '../i18n';
import { useWorkflowStore } from '../state/workflowStore';
import {
  createTargetReview,
  formatTargetForPrompt,
  targetRetrievalContext,
  withTargetSystemPrompt,
} from '../lib/target';

/** Default model for lightweight internal model calls (router LLM-judge,
 *  aggregator summarize) when a node has no explicit model bound. */
const DEFAULT_JUDGE_MODEL = 'openai/gpt-oss-120b:free';

export interface RunHandle {
  abort: () => void;
  promise: Promise<void>;
}

type UpstreamSummary = { name: string; type: EdgeType; text: string };

/** Shared state threaded through a single workflow run. Bundling these into one
 *  object keeps the per-node handlers to a readable signature instead of the
 *  seven positional args the dispatcher used to carry. */
interface NodeRunCtx {
  wf: Workflow;
  idx: ReturnType<typeof buildIndex>;
  /** nodeId → output text produced by that node. */
  outputs: Map<string, string>;
  /** routerId → chosen source handle ('a' | 'b'). */
  routerChoices: Map<string, string>;
  /** nodes skipped because they sit on a branch the router did not take. */
  skipped: Set<string>;
  signal: AbortSignal;
  run: ReturnType<typeof useRunStore.getState>;
}

export function runWorkflow(wf: Workflow): RunHandle {
  const controller = new AbortController();
  const promise = execute(wf, controller.signal);
  return {
    abort: () => controller.abort(),
    promise,
  };
}

async function execute(wf: Workflow, signal: AbortSignal): Promise<void> {
  const run = useRunStore.getState();
  const idx = buildIndex(wf);
  const ctx: NodeRunCtx = {
    wf,
    idx,
    outputs: new Map<string, string>(),
    routerChoices: new Map<string, string>(),
    skipped: new Set<string>(),
    signal,
    run,
  };
  const { outputs } = ctx;
  const batches = topoBatches(wf, idx);
  const startedAt = Date.now();
  let status: RunRecord['status'] = 'done';

  run.log(
    'info',
    i18n.t('engine.graphParsed', { nodes: wf.nodes.length, batches: batches.length })
  );
  for (const n of wf.nodes) {
    run.setNodeState(n.id, { status: 'queued', output: '' });
  }

  for (const batch of batches) {
    if (signal.aborted) {
      status = 'aborted';
      break;
    }
    await Promise.all(
      batch.map((id) => {
        const node = idx.nodes.get(id);
        if (!node) return;
        return runNode(node, ctx).catch((err) => {
          if (signal.aborted) return;
          const msg = err instanceof Error ? err.message : String(err);
          run.setNodeState(id, { status: 'error', error: msg });
          run.log('error', msg, id);
          status = 'error';
        });
      })
    );
  }

  // 写入历史
  const finalOutput =
    wf.nodes
      .filter((n) => n.type === 'output')
      .map((n) => outputs.get(n.id) ?? '')
      .join('\n\n---\n\n') || '';
  const triggerInput =
    wf.nodes
      .filter((n) => n.type === 'trigger')
      .map((n) => (n.data as { input?: string }).input ?? '')
      .join('\n') || '';
  const nodeOutputs: RunRecord['nodeOutputs'] = {};
  const currentStates = useRunStore.getState().nodeStates;
  for (const n of wf.nodes) {
    const st = currentStates[n.id];
    if (!st) continue;
    nodeOutputs[n.id] = {
      name: (n.data as { name?: string }).name ?? n.id.slice(0, 6),
      output: st.output ?? '',
      status: st.status,
    };
  }
  const targetReview = createTargetReview(wf);
  await saveRun({
    id: nanoid(),
    workflowId: wf.id,
    workflowName: wf.name,
    startedAt,
    finishedAt: Date.now(),
    status,
    nodeOutputs,
    finalOutput,
    triggerInput,
    targetSnapshot: wf.target?.enabled ? wf.target : undefined,
    targetReview,
  }).catch(() => {
    /* ignore storage errors */
  });

  if (targetReview) {
    const workflowStore = useWorkflowStore.getState();
    if (workflowStore.workflow.id === wf.id) {
      workflowStore.setTargetReview(targetReview);
    }
    run.log('info', i18n.t('engine.targetReviewLog', {
      status: targetReview.status,
      done: targetReview.checklistDone,
      total: targetReview.checklistTotal,
    }));
  }

  run.log('info', i18n.t('engine.runEnded', { status }));
}

/** Dispatcher: resolves a node's active upstream inputs, then hands off to the
 *  per-kind handler. Trigger nodes are the one exception — they are graph entry
 *  points and have no upstream to collect. */
async function runNode(node: FlowNode, ctx: NodeRunCtx): Promise<void> {
  const { run, idx, outputs, routerChoices, skipped } = ctx;
  const data = node.data;

  // 入口节点：用 trigger 的 input 作为输出
  if (data.kind === 'trigger') {
    const out = (data as TriggerNodeData).input ?? '';
    outputs.set(node.id, out);
    run.setNodeState(node.id, {
      status: 'done',
      output: out,
      startedAt: Date.now(),
      finishedAt: Date.now(),
    });
    return;
  }

  // 收集上游（忽略 report 边）
  const incomingEdges = (idx.incoming.get(node.id) ?? []).filter(
    (e) => (e.data?.type ?? e.type) !== 'report'
  );
  // An incoming edge is "active" only when its source actually ran and, if the
  // source is a router, the edge leaves the chosen branch handle.
  const activeIncoming = incomingEdges.filter((e) => {
    if (skipped.has(e.source)) return false;
    const src = idx.nodes.get(e.source);
    if (src?.data.kind === 'router') {
      const choice = routerChoices.get(e.source) ?? 'a';
      if ((e.sourceHandle ?? 'a') !== choice) return false;
    }
    return true;
  });

  // Dead branch: this node has upstream edges but none are active (e.g. it sits
  // on the router branch that wasn't taken). Skip it and propagate the skip.
  if (incomingEdges.length > 0 && activeIncoming.length === 0) {
    skipped.add(node.id);
    outputs.set(node.id, '');
    run.setNodeState(node.id, {
      status: 'skipped',
      output: '',
      startedAt: Date.now(),
      finishedAt: Date.now(),
    });
    run.log('info', i18n.t('engine.skipped'), node.id);
    return;
  }

  const upstreams: Record<string, string> = {};
  const upstreamSummaries: UpstreamSummary[] = [];
  for (const e of activeIncoming) {
    const src = idx.nodes.get(e.source);
    if (!src) continue;
    const rawOut = outputs.get(src.id) ?? '';
    const transformed = applyEdgeTransform(e, rawOut);
    const srcName = (src.data as { name?: string }).name ?? src.id.slice(0, 6);
    upstreams[srcName] = transformed;
    upstreamSummaries.push({
      name: srcName,
      type: (e.data?.type ?? (e.type as EdgeType) ?? 'pipe') as EdgeType,
      text: transformed,
    });
  }

  switch (data.kind) {
    case 'output':
      return runOutputNode(node, upstreamSummaries, ctx);
    case 'aggregator':
      return runAggregatorNode(
        node as FlowNode & { data: AggregatorNodeData },
        upstreamSummaries,
        ctx
      );
    case 'router':
      return runRouterNode(
        node as FlowNode & { data: RouterNodeData },
        upstreamSummaries,
        ctx
      );
    case 'room':
      return runRoomNode(
        node as FlowNode & { data: RoomNodeData },
        upstreamSummaries,
        ctx
      );
    case 'discuss':
      return runDiscussNode(
        node as FlowNode & { data: DiscussNodeData },
        upstreamSummaries,
        ctx
      );
    case 'agent':
      return runAgentNode(
        node as FlowNode & { data: AgentNodeData },
        upstreams,
        upstreamSummaries,
        ctx
      );
  }
}

/** Output node: join all active upstream outputs for display. */
function runOutputNode(
  node: FlowNode,
  upstreamSummaries: UpstreamSummary[],
  ctx: NodeRunCtx
): void {
  const { outputs, run } = ctx;
  const out =
    upstreamSummaries.map((u) => u.text).join('\n\n---\n\n') ||
    i18n.t('engine.noUpstream');
  outputs.set(node.id, out);
  run.setNodeState(node.id, {
    status: 'done',
    output: out,
    startedAt: Date.now(),
    finishedAt: Date.now(),
  });
}

/** Aggregator node: merge upstreams via the chosen strategy. `summarize` runs a
 *  model call; the rest are synchronous string ops. */
async function runAggregatorNode(
  node: FlowNode & { data: AggregatorNodeData },
  upstreamSummaries: UpstreamSummary[],
  ctx: NodeRunCtx
): Promise<void> {
  const { outputs, run, wf, signal } = ctx;
  const agg = node.data;
  if (agg.strategy === 'summarize') {
    run.setNodeState(node.id, { status: 'running', startedAt: Date.now() });
    run.log('info', i18n.t('engine.calling', {
      provider: agg.provider ?? 'openrouter',
      model: agg.model ?? DEFAULT_JUDGE_MODEL,
    }), node.id);
    const out = await summarizeAggregate(agg, upstreamSummaries, wf, signal);
    outputs.set(node.id, out);
    run.setNodeState(node.id, { status: 'done', output: out, finishedAt: Date.now() });
    return;
  }
  const out = aggregate(agg, upstreamSummaries);
  outputs.set(node.id, out);
  run.setNodeState(node.id, {
    status: 'done',
    output: out,
    startedAt: Date.now(),
    finishedAt: Date.now(),
  });
}

/** Router node: decide a branch and record it so downstream edges on the other
 *  handle get filtered out (their targets are skipped). */
async function runRouterNode(
  node: FlowNode & { data: RouterNodeData },
  upstreamSummaries: UpstreamSummary[],
  ctx: NodeRunCtx
): Promise<void> {
  const { outputs, routerChoices, run, wf, signal } = ctx;
  const router = node.data;
  const input = upstreamSummaries[0]?.text ?? '';
  run.setNodeState(node.id, { status: 'running', startedAt: Date.now() });
  const branch = await routeBranch(router, input, wf, signal);
  routerChoices.set(node.id, branch);
  outputs.set(node.id, input);
  run.setNodeState(node.id, {
    status: 'done',
    // Show the chosen branch on the canvas; downstream still gets clean input.
    output: i18n.t('engine.routePrefix', { branch }) + input,
    finishedAt: Date.now(),
  });
  run.log('info', i18n.t('engine.routedTo', { branch }), node.id);
}

/** Room node: run a group-chat loop across the room's member agents. */
async function runRoomNode(
  node: FlowNode & { data: RoomNodeData },
  upstreamSummaries: UpstreamSummary[],
  ctx: NodeRunCtx
): Promise<void> {
  const { outputs, run, wf, signal } = ctx;
  const members = roomMembers(wf, node.id) as (FlowNode & { data: AgentNodeData })[];
  const topic =
    upstreamSummaries.map((u) => u.text).join('\n').trim() || i18n.t('engine.pleaseDiscuss');
  run.setNodeState(node.id, { status: 'running', startedAt: Date.now(), output: '' });
  for (const m of members) {
    run.setNodeState(m.id, { status: 'queued', output: '' });
  }
  const { output } = await runRoom({ room: node, members, topic, workflow: wf, signal });
  outputs.set(node.id, output);
  run.setNodeState(node.id, { status: 'done', finishedAt: Date.now() });
  for (const m of members) {
    run.setNodeState(m.id, { status: 'done' });
  }
}

/** Agent node: the core LLM call, with target-aware prompting, RAG retrieval,
 *  and delegation to subordinate nodes via `manage` edges. */
async function runAgentNode(
  node: FlowNode & { data: AgentNodeData },
  upstreams: Record<string, string>,
  upstreamSummaries: UpstreamSummary[],
  ctx: NodeRunCtx
): Promise<void> {
  const { outputs, run, wf, idx, signal } = ctx;
  const agent = node.data;
  const ic = {
    input: upstreamSummaries.map((u) => u.text).join('\n\n').trim() || '',
    upstreams,
    vars: wf.variables,
  };
  const system = withTargetSystemPrompt(interpolate(agent.soul, ic), wf);
  const userMsg = buildUserMessage(upstreamSummaries, ic.input);

  run.setNodeState(node.id, {
    status: 'running',
    output: '',
    startedAt: Date.now(),
  });
  run.log(
    'info',
    i18n.t('engine.calling', { provider: agent.provider, model: agent.model }),
    node.id
  );

  const outputSink = createBufferedTextSink((d) => run.appendNodeOutput(node.id, d));
  try {
    const delegates = buildDelegates(node.id, wf, idx, signal, new Set([node.id]));
    const result = await runAgent({
      agent,
      systemPrompt: system,
      userMessage: userMsg,
      signal,
      workflowId: wf.id,
      agentNodeId: node.id,
      ragQueryContext: targetRetrievalContext(wf, ic.input),
      delegates,
      onDelta: outputSink.push,
    });
    outputSink.flush();
    outputs.set(node.id, result.text);
    run.setNodeTrace(node.id, { ...result.trace, upstreams: upstreamSummaries });
    run.setNodeState(node.id, {
      status: 'done',
      finishedAt: Date.now(),
    });
    run.log(
      'info',
      result.toolRounds
        ? i18n.t('engine.doneWithTools', { rounds: result.toolRounds })
        : i18n.t('engine.done'),
      node.id
    );
  } catch (err) {
    outputSink.flush();
    if ((err as Error).name === 'AbortError') {
      run.setNodeState(node.id, { status: 'error', error: i18n.t('engine.aborted') });
      return;
    }
    const msg =
      err instanceof ProviderError
        ? err.message + (err.body ? `\n${err.body}` : '')
        : err instanceof Error
        ? err.message
        : String(err);
    run.setNodeState(node.id, { status: 'error', error: msg });
    run.log('error', msg, node.id);
    throw err;
  }
}

async function runDiscussNode(
  node: FlowNode & { data: DiscussNodeData },
  upstreamSummaries: UpstreamSummary[],
  ctx: NodeRunCtx
): Promise<void> {
  const { run, wf, outputs, signal } = ctx;
  const d = node.data;
  const upstreamInput =
    upstreamSummaries.map((u) => u.text).join('\n\n').trim() || '';

  // Treat discuss-as-an-agent for the underlying LLM calls.
  const asAgent: AgentNodeData = {
    kind: 'agent',
    name: d.name,
    avatar: d.avatar,
    soul: d.soul,
    provider: d.provider,
    model: d.model,
    temperature: d.temperature,
    maxTokens: d.maxTokens,
    memory: 'session',
  };
  const system = withTargetSystemPrompt(
    interpolate(d.soul, {
      input: upstreamInput,
      vars: wf.variables,
    }),
    wf
  );
  const openingUserMsg = interpolate(d.openingPrompt, {
    input: upstreamInput,
    vars: wf.variables,
  });

  run.setNodeState(node.id, {
    status: 'running',
    output: '',
    startedAt: Date.now(),
  });
  run.initDiscussion(node.id);
  run.log(
    'info',
    i18n.t('engine.waitingDiscuss', { provider: d.provider, model: d.model }),
    node.id
  );

  // First turn: AI opens.
  const openingSink = createBufferedTextSink((delta) =>
    run.appendDiscussionDelta(node.id, delta)
  );
  try {
    const opening = await runAgent({
      agent: asAgent,
      systemPrompt: system,
      userMessage: openingUserMsg,
      signal,
      workflowId: wf.id,
      agentNodeId: node.id,
      ragQueryContext: targetRetrievalContext(wf, upstreamInput),
      onDelta: openingSink.push,
    });
    openingSink.flush();
    run.setNodeTrace(node.id, { ...opening.trace, upstreams: upstreamSummaries });
  } catch (err) {
    openingSink.flush();
    if ((err as Error).name === 'AbortError') {
      run.setNodeState(node.id, { status: 'error', error: i18n.t('engine.aborted') });
      return;
    }
    throw err;
  }
  run.setDiscussionPhase(node.id, 'idle');

  // Subsequent turns: wait for user message → reply → repeat. Loop ends when
  // user clicks 完成 (finishDiscussion sets phase='done' and resolves the
  // pending waiter).
  while (true) {
    await waitForDiscussionEvent(node.id, signal);
    if (signal.aborted) throw new DOMException('aborted', 'AbortError');
    const state = useRunStore.getState().discussions[node.id];
    if (!state) break;
    if (state.phase === 'done') break;

    // Build history excluding the latest user message (runAgent appends it).
    const allMsgs = state.messages;
    const lastUser = [...allMsgs].reverse().find((m) => m.role === 'user');
    if (!lastUser) {
      run.setDiscussionPhase(node.id, 'idle');
      continue;
    }
    const history: Message[] = allMsgs
      .slice(0, allMsgs.lastIndexOf(lastUser))
      .map((m) => ({ role: m.role, content: m.content }));

    const replySink = createBufferedTextSink((delta) =>
      run.appendDiscussionDelta(node.id, delta)
    );
    try {
      await runAgent({
        agent: asAgent,
        systemPrompt: system,
        userMessage: lastUser.content,
        history,
        signal,
        workflowId: wf.id,
        agentNodeId: node.id,
        ragQueryContext: targetRetrievalContext(wf, upstreamInput),
        onDelta: replySink.push,
      });
      replySink.flush();
    } catch (err) {
      replySink.flush();
      if ((err as Error).name === 'AbortError') {
        run.setNodeState(node.id, { status: 'error', error: i18n.t('engine.aborted') });
        return;
      }
      run.log(
        'error',
        err instanceof Error ? err.message : String(err),
        node.id
      );
    }
    run.setDiscussionPhase(node.id, 'idle');
  }

  // Resolve the downstream output: user-provided summary takes precedence,
  // else fall back to the last assistant message.
  const finalState = useRunStore.getState().discussions[node.id];
  let finalOut = finalState?.finalOutput?.trim() || '';
  if (!finalOut) {
    const lastAi = [...(finalState?.messages ?? [])]
      .reverse()
      .find((m) => m.role === 'assistant');
    finalOut = lastAi?.content ?? '';
  }
  outputs.set(node.id, finalOut);
  run.setNodeState(node.id, {
    status: 'done',
    output: finalOut,
    finishedAt: Date.now(),
  });
  run.log('info', i18n.t('engine.discussDone'), node.id);
}

/**
 * Build the `delegates` array for an agent based on its outgoing `manage`
 * edges. Calling `delegate(name, task)` will synchronously run the matching
 * subordinate node and return its final output.
 *
 * `inflight` tracks IDs currently on the call stack to break cycles
 * (manager → … → manager) — second-level recursion is allowed, infinite
 * recursion is not.
 */
function buildDelegates(
  managerId: string,
  wf: Workflow,
  idx: ReturnType<typeof buildIndex>,
  signal: AbortSignal,
  inflight: Set<string>
): DelegateTarget[] {
  const subs: FlowNode[] = [];
  for (const e of idx.outgoing.get(managerId) ?? []) {
    const type = (e.data?.type ?? e.type) as string;
    if (type !== 'manage') continue;
    const sub = idx.nodes.get(e.target);
    if (sub) subs.push(sub);
  }
  const out: DelegateTarget[] = [];
  for (const sub of subs) {
    if (sub.data.kind === 'agent') {
      const agent = sub.data as AgentNodeData;
      out.push({
        name: agent.name,
        description: firstLine(agent.soul) || agent.name,
        run: async (task: string) => {
          if (inflight.has(sub.id)) {
            return i18n.t('engine.delegateCycle', { name: agent.name });
          }
          return await runManagedNode(
            sub as FlowNode & { data: AgentNodeData },
            task,
            wf,
            idx,
            signal,
            new Set([...inflight, sub.id])
          );
        },
      });
    } else if (sub.data.kind === 'room') {
      const room = sub.data as RoomNodeData;
      const memberNames = roomMembers(wf, sub.id)
        .map((m) => (m.data as { name?: string }).name)
        .filter((n): n is string => !!n);
      const modeLabel = i18n.t(`nodes.room.modes.${room.mode}`);
      out.push({
        name: room.name,
        description: i18n.t('engine.roomDelegateDesc', {
          mode: modeLabel,
          rounds: room.maxRounds,
          members: memberNames.join('、') || i18n.t('common.empty'),
        }),
        run: async (task: string) => {
          if (inflight.has(sub.id)) {
            return i18n.t('engine.delegateCycle', { name: room.name });
          }
          return await runManagedRoom(
            sub as FlowNode & { data: RoomNodeData },
            task,
            wf,
            signal
          );
        },
      });
    }
    // 其他类型节点（output, aggregator, router, discuss）暂不支持被 delegate
  }
  return out;
}

async function runManagedRoom(
  room: FlowNode & { data: RoomNodeData },
  task: string,
  wf: Workflow,
  signal: AbortSignal
): Promise<string> {
  const run = useRunStore.getState();
  const members = roomMembers(wf, room.id) as (FlowNode & {
    data: AgentNodeData;
  })[];

  if (members.length === 0) {
    return i18n.t('engine.roomEmpty', { name: room.data.name });
  }

  run.setNodeState(room.id, {
    status: 'running',
    output: '',
    startedAt: Date.now(),
  });
  for (const m of members) {
    run.setNodeState(m.id, { status: 'queued', output: '' });
  }
  run.log('info', i18n.t('engine.assignedDiscuss', { task }), room.id);

  try {
    const { output } = await runRoom({
      room,
      members,
      topic: task,
      workflow: wf,
      signal,
    });
    run.setNodeState(room.id, {
      status: 'done',
      finishedAt: Date.now(),
    });
    for (const m of members) {
      run.setNodeState(m.id, { status: 'done' });
    }
    return output;
  } catch (err) {
    if ((err as Error).name === 'AbortError') {
      run.setNodeState(room.id, { status: 'error', error: i18n.t('engine.aborted') });
      throw err;
    }
    const msg = err instanceof Error ? err.message : String(err);
    run.setNodeState(room.id, { status: 'error', error: msg });
    run.log('error', msg, room.id);
    return i18n.t('engine.roomFailed', { name: room.data.name, msg });
  }
}

async function runManagedNode(
  node: FlowNode & { data: AgentNodeData },
  task: string,
  wf: Workflow,
  idx: ReturnType<typeof buildIndex>,
  signal: AbortSignal,
  inflight: Set<string>
): Promise<string> {
  const run = useRunStore.getState();
  const agent = node.data;

  run.setNodeState(node.id, {
    status: 'running',
    output: '',
    startedAt: Date.now(),
  });
  run.log('info', i18n.t('engine.assigned', { task }), node.id);

  const ctx = { input: task, upstreams: {}, vars: wf.variables };
  const system = withTargetSystemPrompt(interpolate(agent.soul, ctx), wf);
  const subDelegates = buildDelegates(node.id, wf, idx, signal, inflight);

  const outputSink = createBufferedTextSink((d) => run.appendNodeOutput(node.id, d));
  try {
    const result = await runAgent({
      agent,
      systemPrompt: system,
      userMessage: task,
      signal,
      workflowId: wf.id,
      agentNodeId: node.id,
      ragQueryContext: targetRetrievalContext(wf, task),
      delegates: subDelegates,
      onDelta: outputSink.push,
    });
    outputSink.flush();
    run.setNodeTrace(node.id, result.trace);
    run.setNodeState(node.id, { status: 'done', finishedAt: Date.now() });
    return result.text;
  } catch (err) {
    outputSink.flush();
    if ((err as Error).name === 'AbortError') {
      run.setNodeState(node.id, { status: 'error', error: i18n.t('engine.aborted') });
      throw err;
    }
    const msg = err instanceof Error ? err.message : String(err);
    run.setNodeState(node.id, { status: 'error', error: msg });
    run.log('error', msg, node.id);
    return i18n.t('engine.subordinateFailed', { name: agent.name, msg });
  }
}

function firstLine(s: string): string {
  for (const line of s.split('\n')) {
    const t = line.trim().replace(/^#+\s*/, '');
    if (t) return t.slice(0, 120);
  }
  return '';
}

async function routeBranch(
  router: RouterNodeData,
  input: string,
  wf: Workflow,
  signal: AbortSignal
): Promise<'a' | 'b'> {
  if (router.rule === 'regex') {
    try {
      const re = new RegExp(router.pattern);
      return re.test(input) ? 'a' : 'b';
    } catch {
      return 'b';
    }
  }

  // llm-judge: a lightweight model call returns a single letter ("a"/"b").
  const provider = getProvider(router.provider ?? 'openrouter');
  const model = router.model ?? DEFAULT_JUDGE_MODEL;
  const system = withTargetSystemPrompt(
    i18n.t('engine.routerJudgeSystem', {
      criteria: (router.prompt ?? '').trim() || '(no criterion provided)',
    }),
    wf
  );
  let text = '';
  try {
    for await (const chunk of provider.stream({
      model,
      systemPrompt: system,
      messages: [{ role: 'user', content: input }],
      temperature: 0,
      maxTokens: 4,
      signal,
    })) {
      if (chunk.delta) text += chunk.delta;
    }
  } catch {
    // On any provider/network error, fall back to branch b.
    return 'b';
  }
  // Take the first a/b letter the model emits; default to b.
  const m = text.toLowerCase().match(/[ab]/);
  return m && m[0] === 'a' ? 'a' : 'b';
}

function applyEdgeTransform(edge: FlowEdge, output: string): string {
  const t = edge.data?.transform;
  if (!t) return output;
  return interpolate(t, { input: output, upstreams: { output } });
}

function buildUserMessage(
  upstreams: { name: string; type: EdgeType; text: string }[],
  fallback: string
): string {
  if (upstreams.length === 0) return fallback || i18n.t('engine.freeform');
  if (upstreams.length === 1) return upstreams[0].text;
  const parts = upstreams.map((u) => {
    const tag =
      u.type === 'assign'
        ? i18n.t('engine.tagAssign')
        : u.type === 'broadcast'
        ? i18n.t('engine.tagBroadcast')
        : i18n.t('engine.tagFrom', { name: u.name });
    return `${tag} ${u.text}`;
  });
  return parts.join('\n\n');
}

function concatInputs(inputs: { name: string; text: string }[]): string {
  return inputs.map((i) => `## ${i.name}\n${i.text}`).join('\n\n');
}

function aggregate(
  cfg: AggregatorNodeData,
  inputs: { name: string; text: string }[]
): string {
  switch (cfg.strategy) {
    case 'pick-first':
      return inputs[0]?.text ?? '';
    case 'json-merge': {
      const merged: Record<string, unknown> = {};
      for (const i of inputs) {
        try {
          const j = JSON.parse(i.text);
          if (j && typeof j === 'object') Object.assign(merged, j);
        } catch {
          merged[i.name] = i.text;
        }
      }
      return JSON.stringify(merged, null, 2);
    }
    // 'summarize' is handled asynchronously by summarizeAggregate() in the
    // scheduler before aggregate() is reached; concat is a safe fallback.
    case 'summarize':
    case 'concat':
    default:
      return concatInputs(inputs);
  }
}

/** Summarize all upstream outputs through a bound model. On any provider/network
 *  error (or empty result) falls back to plain concatenation so the flow still
 *  produces output. */
async function summarizeAggregate(
  cfg: AggregatorNodeData,
  inputs: { name: string; text: string }[],
  wf: Workflow,
  signal: AbortSignal
): Promise<string> {
  const material = concatInputs(inputs);
  if (!material.trim()) return i18n.t('engine.noUpstream');
  const provider = getProvider(cfg.provider ?? 'openrouter');
  const model = cfg.model ?? DEFAULT_JUDGE_MODEL;
  const target = formatTargetForPrompt(wf);
  const system = withTargetSystemPrompt(
    i18n.t('engine.summarizeSystem', {
      instruction:
        (cfg.prompt ?? '').trim() || i18n.t('engine.summarizeDefaultInstruction'),
    }),
    wf
  );
  let text = '';
  try {
    for await (const chunk of provider.stream({
      model,
      systemPrompt: system,
      messages: [{ role: 'user', content: [target, material].filter(Boolean).join('\n\n---\n\n') }],
      temperature: 0.3,
      maxTokens: 1024,
      signal,
    })) {
      if (chunk.delta) text += chunk.delta;
    }
  } catch {
    return material;
  }
  return text.trim() || material;
}
