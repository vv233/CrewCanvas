import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { Play } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { TriggerNodeData } from '../../types';

export const TriggerNode = memo(function TriggerNode({ data, selected }: NodeProps & { data: TriggerNodeData }) {
  const { t } = useTranslation();
  return (
    <div
      className={`card w-[220px] overflow-hidden px-3 py-2 ${
        selected ? 'border-accent-warm' : 'border-accent-warm/50'
      }`}
    >
      <div className="flex items-center gap-2">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-accent-warm/15 text-accent-warm">
          <Play size={16} />
        </div>
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-ink">{data.name}</div>
          <div className="text-[11px] text-muted">{t('nodes.trigger.subtitle')}</div>
        </div>
      </div>
      {data.input ? (
        <div className="mt-2 line-clamp-2 break-words rounded bg-bg-soft px-2 py-1 text-[11px] text-ink/80">
          {data.input}
        </div>
      ) : null}
      <Handle type="source" position={Position.Right} />
    </div>
  );
});
