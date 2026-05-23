import { Bot, Play, Flag, Users, Combine, GitBranch, MessageSquare } from 'lucide-react';
import type { NodeType } from '../types';

interface Item {
  type: NodeType;
  label: string;
  desc: string;
  icon: React.ReactNode;
  color: string;
}

const ITEMS: Item[] = [
  {
    type: 'trigger',
    label: '任务入口',
    desc: '工作流起点',
    icon: <Play size={16} />,
    color: 'text-accent-warm',
  },
  {
    type: 'agent',
    label: 'AI 员工',
    desc: '有 soul.md 的 AI 角色',
    icon: <Bot size={16} />,
    color: 'text-accent',
  },
  {
    type: 'discuss',
    label: '与用户讨论',
    desc: '暂停等用户和 AI 讨论方案',
    icon: <MessageSquare size={16} />,
    color: 'text-accent-cool',
  },
  {
    type: 'room',
    label: '群聊室',
    desc: '多 AI 多轮讨论',
    icon: <Users size={16} />,
    color: 'text-accent-cool',
  },
  {
    type: 'aggregator',
    label: '汇总',
    desc: '合并多个上游',
    icon: <Combine size={16} />,
    color: 'text-violet-400',
  },
  {
    type: 'router',
    label: '分流',
    desc: '按规则走不同分支',
    icon: <GitBranch size={16} />,
    color: 'text-amber-400',
  },
  {
    type: 'output',
    label: '输出',
    desc: '终点显示结果',
    icon: <Flag size={16} />,
    color: 'text-emerald-400',
  },
];

function onDragStart(e: React.DragEvent, type: NodeType) {
  e.dataTransfer.setData('application/aiof-node', type);
  e.dataTransfer.effectAllowed = 'move';
}

export function NodePalette() {
  return (
    <div className="flex h-full w-56 shrink-0 flex-col border-r border-line bg-bg-soft">
      <div className="border-b border-line px-3 py-2">
        <div className="label">节点</div>
        <div className="mt-1 text-[11px] text-muted">拖到画布上添加</div>
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
              <div className="text-sm font-medium text-ink">{it.label}</div>
              <div className="text-[11px] text-muted">{it.desc}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
