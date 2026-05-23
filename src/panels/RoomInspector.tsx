import { Trash2 } from 'lucide-react';
import { useWorkflowStore } from '../state/workflowStore';
import type { AgentNodeData, FlowNode, RoomNodeData } from '../types';

interface Props {
  node: FlowNode & { data: RoomNodeData };
}

export function RoomInspector({ node }: Props) {
  const update = useWorkflowStore((s) => s.updateNodeData);
  const remove = useWorkflowStore((s) => s.removeNode);
  const workflow = useWorkflowStore((s) => s.workflow);
  const d = node.data;

  const members = workflow.nodes.filter(
    (n) =>
      (n as FlowNode & { parentId?: string }).parentId === node.id &&
      n.type === 'agent'
  ) as (FlowNode & { data: AgentNodeData })[];

  return (
    <div className="space-y-3">
      <div>
        <div className="label mb-1">名字</div>
        <input
          className="input"
          value={d.name}
          onChange={(e) => update(node.id, { name: e.target.value })}
        />
      </div>
      <div>
        <div className="label mb-1">发言模式</div>
        <select
          className="input"
          value={d.mode}
          onChange={(e) =>
            update(node.id, { mode: e.target.value as RoomNodeData['mode'] })
          }
        >
          <option value="round-robin">轮询（按顺序逐个发言）</option>
          <option value="moderator">主持人（由主持人决定下一个）</option>
          <option value="race">抢答（每轮先到先发言）</option>
        </select>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <div className="label mb-1">最大轮数</div>
          <input
            type="number"
            min={1}
            max={20}
            className="input"
            value={d.maxRounds}
            onChange={(e) =>
              update(node.id, { maxRounds: parseInt(e.target.value) || 1 })
            }
          />
        </div>
        {d.mode === 'moderator' ? (
          <div>
            <div className="label mb-1">每人最少发言</div>
            <input
              type="number"
              min={1}
              max={10}
              className="input"
              value={d.minTurnsPerSpeaker ?? 2}
              onChange={(e) =>
                update(node.id, {
                  minTurnsPerSpeaker: parseInt(e.target.value) || 1,
                })
              }
            />
          </div>
        ) : null}
      </div>
      {d.mode === 'moderator' ? (
        <>
          <div>
            <div className="label mb-1">主持人（成员中选一位）</div>
            <select
              className="input"
              value={d.moderatorId ?? ''}
              onChange={(e) => update(node.id, { moderatorId: e.target.value })}
            >
              <option value="">（自动选第一个成员）</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.data.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <div className="label mb-1">主持人指令模板</div>
            <textarea
              className="input min-h-[120px] resize-y font-mono text-[11px]"
              value={d.moderatorPrompt ?? ''}
              onChange={(e) => update(node.id, { moderatorPrompt: e.target.value })}
            />
            <div className="mt-1 text-[10px] text-muted">
              变量：<code>{'{{var.members}}'}</code>、<code>{'{{var.history}}'}</code>。
              主持人需返回 JSON：<code>{'{"next":"成员名"}'}</code> 或{' '}
              <code>{'{"stop":true,"summary":"..."}'}</code>
            </div>
          </div>
        </>
      ) : null}
      <div>
        <div className="label mb-1">终止关键词（任意发言包含即停）</div>
        <input
          className="input"
          value={d.stopKeyword ?? ''}
          placeholder="例：【讨论结束】"
          onChange={(e) => update(node.id, { stopKeyword: e.target.value })}
        />
      </div>

      <div className="rounded-md bg-bg-soft p-2 text-[11px]">
        <div className="mb-1 font-semibold text-ink">当前成员（{members.length}）</div>
        {members.length === 0 ? (
          <div className="text-muted">把 AI 节点拖到房间内即可加入</div>
        ) : (
          <ul className="space-y-1">
            {members.map((m) => (
              <li key={m.id} className="flex items-center gap-1 text-ink/90">
                <span>{m.data.avatar}</span>
                <span>{m.data.name}</span>
                <span className="text-muted">({m.data.model})</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <button className="btn-danger w-full" onClick={() => remove(node.id)}>
        <Trash2 size={14} /> 删除房间
      </button>
    </div>
  );
}
