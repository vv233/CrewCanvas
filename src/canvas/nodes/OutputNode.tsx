import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { Flag } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { OutputNodeData } from '../../types';
import { useRunStore } from '../../state/runStore';

export const OutputNode = memo(function OutputNode({ data, selected, id }: NodeProps & { data: OutputNodeData }) {
  const { t } = useTranslation();
  const state = useRunStore((s) => s.nodeStates[id]);
  return (
    <div
      className={`card w-[280px] overflow-hidden px-3 py-2 ${
        selected ? 'border-emerald-400' : 'border-emerald-400/50'
      }`}
    >
      <Handle type="target" position={Position.Left} />
      <div className="flex min-w-0 items-center gap-2">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-emerald-400/15 text-emerald-400">
          <Flag size={16} />
        </div>
        <div className="truncate text-sm font-semibold text-ink">{data.name}</div>
      </div>
      {state?.output ? (
        <div className="mt-2 max-h-32 overflow-auto whitespace-pre-wrap break-words rounded bg-bg-soft px-2 py-1 text-[11px] leading-snug text-ink/90">
          {state.output}
        </div>
      ) : (
        <div className="mt-2 text-[11px] text-muted">{t('nodes.output.afterRun')}</div>
      )}
    </div>
  );
});
