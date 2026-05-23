import { Handle, Position, type NodeProps } from '@xyflow/react';
import { Bot } from 'lucide-react';
import type { AgentNodeData } from '../../types';
import { useRunStore } from '../../state/runStore';
import { StatusDot } from './StatusDot';

export function AgentNode({ data, selected, id }: NodeProps & { data: AgentNodeData }) {
  const state = useRunStore((s) => s.nodeStates[id]);
  return (
    <div
      className={`card w-[240px] overflow-hidden px-3 py-2 transition-all ${
        selected
          ? 'border-accent shadow-[0_0_0_2px_rgba(99,102,241,0.25)]'
          : 'border-line'
      }`}
    >
      <Handle type="target" position={Position.Left} />
      <div className="flex items-center gap-2">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-bg-soft text-xl">
          {data.avatar || <Bot size={18} />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="truncate text-sm font-semibold text-ink">{data.name}</span>
            <StatusDot status={state?.status ?? 'idle'} />
          </div>
          <div className="truncate text-[11px] text-muted">
            {data.provider} · {data.model}
          </div>
        </div>
      </div>
      {state?.output ? (
        <div className="mt-2 max-h-20 overflow-hidden whitespace-pre-wrap break-words rounded bg-bg-soft px-2 py-1 text-[11px] leading-snug text-ink/80">
          {state.output.slice(0, 200)}
          {state.output.length > 200 ? '…' : ''}
        </div>
      ) : null}
      <Handle type="source" position={Position.Right} />
    </div>
  );
}
