import { Bot, Play, Flag, Users, Combine, GitBranch, MessageSquare } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { NodeType } from '../types';

interface Item {
  type: NodeType;
  icon: React.ReactNode;
  color: string;
}

const ITEMS: Item[] = [
  { type: 'trigger', icon: <Play size={16} />, color: 'text-accent-warm' },
  { type: 'agent', icon: <Bot size={16} />, color: 'text-accent' },
  { type: 'discuss', icon: <MessageSquare size={16} />, color: 'text-accent-cool' },
  { type: 'room', icon: <Users size={16} />, color: 'text-accent-cool' },
  { type: 'aggregator', icon: <Combine size={16} />, color: 'text-violet-400' },
  { type: 'router', icon: <GitBranch size={16} />, color: 'text-amber-400' },
  { type: 'output', icon: <Flag size={16} />, color: 'text-emerald-400' },
];

function onDragStart(e: React.DragEvent, type: NodeType) {
  e.dataTransfer.setData('application/aiof-node', type);
  e.dataTransfer.effectAllowed = 'move';
}

export function NodePalette() {
  const { t } = useTranslation();
  return (
    <div className="flex h-full w-56 shrink-0 flex-col border-r border-line bg-bg-soft">
      <div className="border-b border-line px-3 py-2">
        <div className="label">{t('palette.heading')}</div>
        <div className="mt-1 text-[11px] text-muted">{t('palette.hint')}</div>
      </div>
      <div className="flex-1 space-y-1 overflow-auto p-2">
        {ITEMS.map((it) => (
          <div
            key={it.type}
            draggable
            onDragStart={(e) => onDragStart(e, it.type)}
            className="flex cursor-grab items-start gap-2 rounded-md border border-line bg-panel px-2 py-2 text-sm hover:border-accent/50 active:cursor-grabbing"
          >
            <div className={`mt-0.5 ${it.color}`}>{it.icon}</div>
            <div className="min-w-0">
              <div className="text-sm font-medium text-ink">{t(`palette.${it.type}.label`)}</div>
              <div className="text-[11px] text-muted">{t(`palette.${it.type}.desc`)}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
