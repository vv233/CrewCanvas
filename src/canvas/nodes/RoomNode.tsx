import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { Users } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { RoomNodeData } from '../../types';
import { useRunStore } from '../../state/runStore';
import { StatusDot } from './StatusDot';

const ROOM_STYLE = {
  background: 'rgba(34, 211, 238, 0.04)',
  width: '100%',
  height: '100%',
  minWidth: 320,
  minHeight: 220,
} as const;

export const RoomNode = memo(function RoomNode({ data, selected, id }: NodeProps & { data: RoomNodeData }) {
  const { t } = useTranslation();
  const state = useRunStore((s) => s.nodeStates[id]);
  return (
    <div
      className={`relative rounded-lg border-2 transition-all ${
        selected
          ? 'border-accent-cool shadow-[0_0_0_2px_rgba(34,211,238,0.2)]'
          : 'border-accent-cool/40'
      }`}
      style={ROOM_STYLE}
    >
      <Handle type="target" position={Position.Left} />
      <div className="flex items-center gap-2 border-b border-accent-cool/20 px-3 py-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-accent-cool/15 text-accent-cool">
          <Users size={16} />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-semibold text-ink">{data.name}</span>
            <StatusDot status={state?.status ?? 'idle'} />
          </div>
          <div className="text-[11px] text-muted">
            {t('nodes.room.summary', {
              mode: t(`nodes.room.modes.${data.mode}`),
              rounds: data.maxRounds,
            })}
          </div>
        </div>
      </div>
      <Handle type="source" position={Position.Right} />
    </div>
  );
});
