import { Handle, Position, type NodeProps } from '@xyflow/react';
import { Combine } from 'lucide-react';
import type { AggregatorNodeData } from '../../types';

const STRATEGY: Record<AggregatorNodeData['strategy'], string> = {
  concat: '拼接',
  'json-merge': 'JSON 合并',
  'pick-first': '取第一个',
  summarize: 'AI 总结',
};

export function AggregatorNode({
  data,
  selected,
}: NodeProps & { data: AggregatorNodeData }) {
  return (
    <div
      className={`card min-w-[180px] px-3 py-2 ${
        selected ? 'border-violet-400' : 'border-violet-400/40'
      }`}
    >
      <Handle type="target" position={Position.Left} />
      <div className="flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-violet-400/15 text-violet-400">
          <Combine size={16} />
        </div>
        <div>
          <div className="text-sm font-semibold text-ink">{data.name}</div>
          <div className="text-[11px] text-muted">汇总 · {STRATEGY[data.strategy]}</div>
        </div>
      </div>
      <Handle type="source" position={Position.Right} />
    </div>
  );
}
