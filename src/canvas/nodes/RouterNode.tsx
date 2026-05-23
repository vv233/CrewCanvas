import { Handle, Position, type NodeProps } from '@xyflow/react';
import { GitBranch } from 'lucide-react';
import type { RouterNodeData } from '../../types';

export function RouterNode({ data, selected }: NodeProps & { data: RouterNodeData }) {
  return (
    <div
      className={`card min-w-[180px] px-3 py-2 ${
        selected ? 'border-amber-400' : 'border-amber-400/40'
      }`}
    >
      <Handle type="target" position={Position.Left} />
      <div className="flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-amber-400/15 text-amber-400">
          <GitBranch size={16} />
        </div>
        <div>
          <div className="text-sm font-semibold text-ink">{data.name}</div>
          <div className="text-[11px] text-muted">
            分流 · {data.rule === 'llm-judge' ? 'AI 判断' : '正则'}
          </div>
        </div>
      </div>
      <Handle type="source" position={Position.Right} id="a" style={{ top: '40%' }} />
      <Handle type="source" position={Position.Right} id="b" style={{ top: '70%' }} />
    </div>
  );
}
