import type {
  AgentNodeData,
  FlowNode,
  RoomNodeData,
  Workflow,
} from '../types';
import { useRunStore } from '../state/runStore';
import { interpolate } from './interpolate';
import { runAgent } from './runAgent';
import { createBufferedTextSink } from './streamBuffer';

interface RoomCtx {
  room: FlowNode & { data: RoomNodeData };
  members: (FlowNode & { data: AgentNodeData })[];
  topic: string;
  workflow: Workflow;
  signal: AbortSignal;
}

export interface RoomTurn {
  speaker: string;
  text: string;
}

export async function runRoom(ctx: RoomCtx): Promise<{
  history: RoomTurn[];
  output: string;
}> {
  const run = useRunStore.getState();
  const { room, members, topic, workflow, signal } = ctx;
  const history: RoomTurn[] = [];

  if (members.length === 0) {
    return { history, output: '（房间是空的，请把 AI 节点拖入房间内）' };
  }

  const moderator =
    room.data.mode === 'moderator'
      ? members.find((m) => m.id === room.data.moderatorId) ?? members[0]
      : null;
  const speakers = moderator ? members.filter((m) => m.id !== moderator.id) : members;

  const announce = (msg: string) => run.log('info', msg, room.id);
  announce(
    `群聊开始 · 模式=${room.data.mode} · 成员=${members
      .map((m) => m.data.name)
      .join(', ')}`
  );

  let lastSpeakerOutput = '';
  for (let round = 0; round < room.data.maxRounds; round++) {
    if (signal.aborted) break;
    announce(`--- 第 ${round + 1} 轮 ---`);

    if (room.data.mode === 'round-robin') {
      for (const m of speakers) {
        if (signal.aborted) break;
        const text = await speakAndStream(m, topic, history, workflow, signal, room.id);
        history.push({ speaker: m.data.name, text });
        lastSpeakerOutput = text;
        if (containsStop(text, room.data.stopKeyword)) {
          announce('检测到终止关键词，提前结束');
          return finalize(room, history, moderator, workflow, signal);
        }
      }
    } else if (room.data.mode === 'race') {
      // 在 race 模式下，多人并行流式输出会让 Room 面板字符交错。
      // 简化：仍并发执行，但只把胜者的最终文本一次性追加到 Room；agent 节点各自的流式仍然可见。
      const results = await Promise.allSettled(
        speakers.map((m) => speak(m, topic, history, workflow, signal))
      );
      const winnerIdx = results.findIndex((r) => r.status === 'fulfilled');
      if (winnerIdx >= 0) {
        const text = (results[winnerIdx] as PromiseFulfilledResult<string>).value;
        const m = speakers[winnerIdx];
        history.push({ speaker: m.data.name, text });
        appendTurnFull(room.id, m.data.name, text);
        lastSpeakerOutput = text;
      }
    } else if (room.data.mode === 'moderator' && moderator) {
      const spoken = new Set(history.map((h) => h.speaker));
      const everyoneSpoke = speakers.every((s) => spoken.has(s.data.name));

      let nextMember: typeof speakers[number];

      if (!everyoneSpoke) {
        nextMember =
          speakers.find((s) => !spoken.has(s.data.name)) ?? speakers[0];
        announce(`首轮发言：${nextMember.data.name}`);
      } else {
        const decision = await speakAndStream(
          moderator,
          '',
          history,
          workflow,
          signal,
          room.id,
          `${moderator.data.name}(主持)`,
          interpolate(room.data.moderatorPrompt ?? '', {
            input: topic,
            vars: {
              members: speakers.map((s) => s.data.name).join('、'),
              history: history.map((h) => `${h.speaker}: ${h.text}`).join('\n'),
            },
          })
        );
        let parsed: { next?: string; stop?: boolean; summary?: string } = {};
        try {
          const m = decision.match(/\{[\s\S]*\}/);
          if (m) parsed = JSON.parse(m[0]);
        } catch {
          parsed = { stop: true, summary: decision };
        }
        const minTurns = room.data.minTurnsPerSpeaker ?? 2;
        const turnCount = new Map<string, number>();
        for (const h of history) {
          turnCount.set(h.speaker, (turnCount.get(h.speaker) ?? 0) + 1);
        }
        const belowMin = speakers.filter(
          (s) => (turnCount.get(s.data.name) ?? 0) < minTurns
        );

        if (parsed.stop && belowMin.length === 0) {
          announce('主持人宣布结束');
          return {
            history,
            output:
              parsed.summary ??
              history.map((h) => `${h.speaker}: ${h.text}`).join('\n\n'),
          };
        }
        if (parsed.stop && belowMin.length > 0) {
          announce(
            `主持人想 stop，但 ${belowMin
              .map((s) => s.data.name)
              .join('、')} 还未达到最少 ${minTurns} 次发言；强制继续`
          );
          // 让发言次数最少的人继续发言
          nextMember = belowMin.sort(
            (a, b) =>
              (turnCount.get(a.data.name) ?? 0) -
              (turnCount.get(b.data.name) ?? 0)
          )[0];
        } else {
          nextMember =
            speakers.find((s) => s.data.name === parsed.next) ?? speakers[0];
        }
      }

      const text = await speakAndStream(
        nextMember,
        topic,
        history,
        workflow,
        signal,
        room.id
      );
      history.push({ speaker: nextMember.data.name, text });
      lastSpeakerOutput = text;
      if (containsStop(text, room.data.stopKeyword)) {
        return finalize(room, history, moderator, workflow, signal);
      }
    }
  }
  return finalize(room, history, moderator, workflow, signal, lastSpeakerOutput);
}

async function finalize(
  room: FlowNode & { data: RoomNodeData },
  history: RoomTurn[],
  moderator: (FlowNode & { data: AgentNodeData }) | null,
  workflow: Workflow,
  signal: AbortSignal,
  fallback?: string
): Promise<{ history: RoomTurn[]; output: string }> {
  if (moderator) {
    const summary = await speakAndStream(
      moderator,
      '请基于以上讨论历史，给出一段总结作为最终结论。',
      history,
      workflow,
      signal,
      room.id,
      `${moderator.data.name}(总结)`
    );
    return { history, output: summary };
  }
  return {
    history,
    output:
      fallback ??
      history
        .slice(-1)
        .map((h) => h.text)
        .join('\n') ??
      '',
  };
}

/** 调用 agent 发言，并把 token 实时推到：1) 该 agent 自己的节点，2) 所在 room 节点。
 *  speakerLabel 可覆盖在 Room 内显示的发言人标签（如「主持人」「总结」）。
 */
async function speakAndStream(
  agent: FlowNode & { data: AgentNodeData },
  topic: string,
  history: RoomTurn[],
  workflow: Workflow,
  signal: AbortSignal,
  roomId: string,
  speakerLabel?: string,
  overrideUser?: string
): Promise<string> {
  const run = useRunStore.getState();
  const label = speakerLabel ?? agent.data.name;
  appendTurnHeader(roomId, label);
  run.setNodeState(agent.id, {
    status: 'running',
    output: '',
    startedAt: Date.now(),
  });

  const agentSink = createBufferedTextSink((delta) =>
    run.appendNodeOutput(agent.id, delta)
  );
  const roomSink = createBufferedTextSink((delta) =>
    run.appendNodeOutput(roomId, delta)
  );

  try {
    const text = await speak(
      agent,
      topic,
      history,
      workflow,
      signal,
      overrideUser,
      (delta) => {
        agentSink.push(delta);
        roomSink.push(delta);
      }
    );
    agentSink.flush();
    roomSink.flush();
    useRunStore.getState().setNodeState(agent.id, {
      status: 'done',
      finishedAt: Date.now(),
    });
    return text;
  } catch (err) {
    agentSink.flush();
    roomSink.flush();
    useRunStore.getState().setNodeState(agent.id, {
      status: 'error',
      error: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
}

async function speak(
  agent: FlowNode & { data: AgentNodeData },
  topic: string,
  history: RoomTurn[],
  workflow: Workflow,
  signal: AbortSignal,
  overrideUser?: string,
  onDelta?: (d: string) => void
): Promise<string> {
  const run = useRunStore.getState();
  const ctxObj = {
    input: topic,
    upstreams: {},
    vars: workflow.variables,
    room: {
      history: history.map((h) => `${h.speaker}: ${h.text}`).join('\n'),
    },
  };
  const system = interpolate(agent.data.soul, ctxObj);
  const userMsg =
    overrideUser ??
    (history.length === 0
      ? `讨论话题：${topic}\n\n请你作为${agent.data.name}发表你的看法。`
      : `话题：${topic}\n\n当前讨论历史：\n${ctxObj.room.history}\n\n请你作为${agent.data.name}发表你的看法。`);

  const result = await runAgent({
    agent: agent.data,
    systemPrompt: system,
    userMessage: userMsg,
    signal,
    workflowId: workflow.id,
    agentNodeId: agent.id,
    ragQueryContext: ctxObj.room.history,
    onDelta,
  });
  run.log(
    'info',
    `${agent.data.name}: ${result.text}`
  );
  return result.text;
}

function appendTurnHeader(roomId: string, speaker: string) {
  const run = useRunStore.getState();
  const prev = run.nodeStates[roomId]?.output ?? '';
  const sep = prev ? '\n\n' : '';
  run.appendNodeOutput(roomId, `${sep}【${speaker}】\n`);
}

function appendTurnFull(roomId: string, speaker: string, text: string) {
  const run = useRunStore.getState();
  const prev = run.nodeStates[roomId]?.output ?? '';
  const sep = prev ? '\n\n' : '';
  run.appendNodeOutput(roomId, `${sep}【${speaker}】\n${text}`);
}

function containsStop(text: string, keyword?: string): boolean {
  if (!keyword) return false;
  return text.includes(keyword);
}
