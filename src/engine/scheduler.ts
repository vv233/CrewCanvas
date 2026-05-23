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
import { runRoom } from './roomLoop';
import { runAgent, type DelegateTarget } from './runAgent';
import { createBufferedTextSink } from './streamBuffer';
import { saveRun, type RunRecord } from '../storage/db';
import { nanoid } from 'nanoid';

export interface RunHandle {
  abort: () => void;
  promise: Promise<void>;
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
  const outputs = new Map<string, string>(); // nodeId → output
  const batches = topoBatches(wf, idx);
  const startedAt = Date.now();
  let status: RunRecord['status'] = 'done';

  run.log('info', `图解析完成 · ${wf.nodes.length} 节点 · ${batches.length} 个批次`);
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
        return runNode(node, wf, idx, outputs, signal).catch((err) => {
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
  }).catch(() => {
    /* ignore storage errors */
  });

  run.log('info', `运行结束 · ${status}`);
}

async function runNode(
  node: FlowNode,
  wf: Workflow,
  idx: ReturnType<typeof buildIndex>,
  outputs: Map<string, string>,
  signal: AbortSignal
) {
  const run = useRunStore.getState();
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

  // 收集上游
  const incomingEdges = (idx.incoming.get(node.id) ?? []).filter(
    (e) => (e.data?.type ?? e.type) !== 'report'
  );
  const upstreams: Record<string, string> = {};
  const upstreamSummaries: { name: string; type: EdgeType; text: string }[] = [];
  for (const e of incomingEdges) {
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

  if (data.kind === 'output') {
    const out =
      upstreamSummaries.map((u) => u.text).join('\n\n---\n\n') ||
      '(无上游输出)';
    outputs.set(node.id, out);
    run.setNodeState(node.id, {
      status: 'done',
      output: out,
      startedAt: Date.now(),
      finishedAt: Date.now(),
    });
    return;
  }

  if (data.kind === 'aggregator') {
    const out = aggregate(data as AggregatorNodeData, upstreamSummaries);
    outputs.set(node.id, out);
    run.setNodeState(node.id, {
      status: 'done',
      output: out,
      startedAt: Date.now(),
      finishedAt: Date.now(),
    });
    return;
  }

  if (data.kind === 'router') {
    const router = data as RouterNodeData;
    const input = upstreamSummaries[0]?.text ?? '';
    run.setNodeState(node.id, { status: 'running', startedAt: Date.now() });
    const branch = await routeBranch(router, input, signal);
    const out = `[路由→${branch}] ${input}`;
    outputs.set(node.id, out);
    // 标记走了哪条分支：写在 output 里，下游的 sourceHandle 自动过滤
    // （我们在 buildUserMessage 阶段不区分 handle，所以下游 agent 会收到 [路由→a] 标签）
    run.setNodeState(node.id, {
      status: 'done',
      output: out,
      finishedAt: Date.now(),
    });
    run.log('info', `路由到分支 "${branch}"`, node.id);
    return;
  }

  if (data.kind === 'room') {
    const room = node as FlowNode & { data: RoomNodeData };
    const members = roomMembers(wf, node.id) as (FlowNode & { data: AgentNodeData })[];
    const topic = upstreamSummaries.map((u) => u.text).join('\n').trim() || '请讨论。';
    run.setNodeState(node.id, { status: 'running', startedAt: Date.now(), output: '' });
    for (const m of members) {
      run.setNodeState(m.id, { status: 'queued', output: '' });
    }
    const { output } = await runRoom({ room, members, topic, workflow: wf, signal });
    outputs.set(node.id, output);
    run.setNodeState(node.id, { status: 'done', finishedAt: Date.now() });
    for (const m of members) {
      run.setNodeState(m.id, { status: 'done' });
    }
    return;
  }

  if (data.kind === 'discuss') {
    await runDiscussNode(node as FlowNode & { data: DiscussNodeData }, wf, upstreamSummaries, outputs, signal);
    return;
  }

  // agent
  if (data.kind === 'agent') {
    const agent = data as AgentNodeData;
    const ctx = {
      input: upstreamSummaries.map((u) => u.text).join('\n\n').trim() || '',
      upstreams,
      vars: wf.variables,
    };
    const system = interpolate(agent.soul, ctx);
    const userMsg = buildUserMessage(upstreamSummaries, ctx.input);

    run.setNodeState(node.id, {
      status: 'running',
      output: '',
      startedAt: Date.now(),
    });
    run.log('info', `调用 ${agent.provider}/${agent.model}`, node.id);

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
        ragQueryContext: ctx.input,
        delegates,
        onDelta: outputSink.push,
      });
      outputSink.flush();
      outputs.set(node.id, result.text);
      run.setNodeState(node.id, {
        status: 'done',
        finishedAt: Date.now(),
      });
      run.log(
        'info',
        `完成${result.toolRounds ? ` · 工具轮次 ${result.toolRounds}` : ''}`,
        node.id
      );
    } catch (err) {
      outputSink.flush();
      if ((err as Error).name === 'AbortError') {
        run.setNodeState(node.id, { status: 'error', error: '已中止' });
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
}

async function runDiscussNode(
  node: FlowNode & { data: DiscussNodeData },
  wf: Workflow,
  upstreamSummaries: { name: string; type: EdgeType; text: string }[],
  outputs: Map<string, string>,
  signal: AbortSignal
): Promise<void> {
  const run = useRunStore.getState();
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
  const system = interpolate(d.soul, {
    input: upstreamInput,
    vars: wf.variables,
  });
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
  run.log('info', `等待用户讨论（${d.provider}/${d.model}）`, node.id);

  // First turn: AI opens.
  const openingSink = createBufferedTextSink((delta) =>
    run.appendDiscussionDelta(node.id, delta)
  );
  try {
    await runAgent({
      agent: asAgent,
      systemPrompt: system,
      userMessage: openingUserMsg,
      signal,
      workflowId: wf.id,
      agentNodeId: node.id,
      ragQueryContext: upstreamInput,
      onDelta: openingSink.push,
    });
    openingSink.flush();
  } catch (err) {
    openingSink.flush();
    if ((err as Error).name === 'AbortError') {
      run.setNodeState(node.id, { status: 'error', error: '已中止' });
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
        ragQueryContext: upstreamInput,
        onDelta: replySink.push,
      });
      replySink.flush();
    } catch (err) {
      replySink.flush();
      if ((err as Error).name === 'AbortError') {
        run.setNodeState(node.id, { status: 'error', error: '已中止' });
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
  run.log('info', '讨论完成，输出已传给下游', node.id);
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
            return `(拒绝：检测到循环指派——${agent.name} 已在当前调用栈上)`;
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
      const modeLabel =
        room.mode === 'moderator' ? '主持人' :
        room.mode === 'race' ? '抢答' : '轮询';
      out.push({
        name: room.name,
        description:
          `[群聊室·${modeLabel}模式·最多${room.maxRounds}轮] 成员：` +
          (memberNames.join('、') || '(空)') +
          '。task 描述会作为讨论话题。',
        run: async (task: string) => {
          if (inflight.has(sub.id)) {
            return `(拒绝：检测到循环指派——${room.name} 已在当前调用栈上)`;
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
    return `(房间 ${room.data.name} 是空的——把 AI 节点拖进房间内才能讨论)`;
  }

  run.setNodeState(room.id, {
    status: 'running',
    output: '',
    startedAt: Date.now(),
  });
  for (const m of members) {
    run.setNodeState(m.id, { status: 'queued', output: '' });
  }
  run.log(
    'info',
    `被指派讨论：${task}`,
    room.id
  );

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
      run.setNodeState(room.id, { status: 'error', error: '已中止' });
      throw err;
    }
    const msg = err instanceof Error ? err.message : String(err);
    run.setNodeState(room.id, { status: 'error', error: msg });
    run.log('error', msg, room.id);
    return `(房间 ${room.data.name} 执行失败：${msg})`;
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
  run.log('info', `被指派：${task}`, node.id);

  const ctx = { input: task, upstreams: {}, vars: wf.variables };
  const system = interpolate(agent.soul, ctx);
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
      ragQueryContext: task,
      delegates: subDelegates,
      onDelta: outputSink.push,
    });
    outputSink.flush();
    run.setNodeState(node.id, { status: 'done', finishedAt: Date.now() });
    return result.text;
  } catch (err) {
    outputSink.flush();
    if ((err as Error).name === 'AbortError') {
      run.setNodeState(node.id, { status: 'error', error: '已中止' });
      throw err;
    }
    const msg = err instanceof Error ? err.message : String(err);
    run.setNodeState(node.id, { status: 'error', error: msg });
    run.log('error', msg, node.id);
    return `(下属 ${agent.name} 执行失败：${msg})`;
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
  _signal: AbortSignal
): Promise<string> {
  if (router.rule === 'regex') {
    try {
      const re = new RegExp(router.pattern);
      return re.test(input) ? 'a' : 'b';
    } catch {
      return 'b';
    }
  }
  // llm-judge: 一次轻量调用让模型选 a/b
  // 简化：直接看 input 第一个字符是不是 "是 / 1 / yes / a"
  const t = input.trim().toLowerCase();
  if (/^(是|yes|1|true|a)/.test(t)) return 'a';
  return 'b';
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
  if (upstreams.length === 0) return fallback || '（无输入，请自由发挥）';
  if (upstreams.length === 1) return upstreams[0].text;
  const parts = upstreams.map((u) => {
    const tag =
      u.type === 'assign'
        ? '【上级指派】'
        : u.type === 'broadcast'
        ? '【广播】'
        : '【来自 ' + u.name + '】';
    return `${tag} ${u.text}`;
  });
  return parts.join('\n\n');
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
    case 'summarize':
      // 真正的 AI 总结需要一个绑定的 agent；M4 时增强
      return inputs.map((i) => `## ${i.name}\n${i.text}`).join('\n\n');
    case 'concat':
    default:
      return inputs.map((i) => `## ${i.name}\n${i.text}`).join('\n\n');
  }
}
