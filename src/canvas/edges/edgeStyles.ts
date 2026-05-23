import type { EdgeType } from '../../types';

export interface EdgeStyle {
  stroke: string;
  strokeDasharray?: string;
  label: string;
  description: string;
  markerEnd?: 'arrow' | 'arrowclosed';
}

export const EDGE_STYLES: Record<EdgeType, EdgeStyle> = {
  assign: {
    stroke: '#f97316',
    label: '指派',
    description: '上司给下属派任务（阻塞，等返回）',
    markerEnd: 'arrowclosed',
  },
  report: {
    stroke: '#22d3ee',
    strokeDasharray: '5 4',
    label: '汇报',
    description: '下属向上司回传结果（异步）',
    markerEnd: 'arrow',
  },
  broadcast: {
    stroke: '#a78bfa',
    label: '广播',
    description: '一对多并行触发',
    markerEnd: 'arrowclosed',
  },
  pipe: {
    stroke: '#6b7180',
    label: '管道',
    description: '上游输出直接作为下游输入',
    markerEnd: 'arrow',
  },
  topic: {
    stroke: '#22d3ee',
    strokeDasharray: '2 3',
    label: '话题',
    description: '在群聊室内发起话题',
    markerEnd: 'arrow',
  },
  manage: {
    stroke: '#ec4899',
    label: '管理',
    description:
      '上司 → 下属（团队关系）。下属不进主调度，由上司 agent 自主用 delegate 工具决定何时派遣',
    markerEnd: 'arrowclosed',
  },
};

export const EDGE_TYPE_OPTIONS: EdgeType[] = [
  'pipe',
  'assign',
  'manage',
  'report',
  'broadcast',
  'topic',
];
