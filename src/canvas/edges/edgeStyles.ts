import type { EdgeType } from '../../types';

export interface EdgeStyle {
  stroke: string;
  strokeDasharray?: string;
  markerEnd?: 'arrow' | 'arrowclosed';
}

// Visual styling only. Human-readable label/description live in i18n under
// `edges.types.<type>` and are resolved at render time.
export const EDGE_STYLES: Record<EdgeType, EdgeStyle> = {
  assign: { stroke: '#f97316', markerEnd: 'arrowclosed' },
  report: { stroke: '#22d3ee', strokeDasharray: '5 4', markerEnd: 'arrow' },
  broadcast: { stroke: '#a78bfa', markerEnd: 'arrowclosed' },
  pipe: { stroke: '#6b7180', markerEnd: 'arrow' },
  topic: { stroke: '#22d3ee', strokeDasharray: '2 3', markerEnd: 'arrow' },
  manage: { stroke: '#ec4899', markerEnd: 'arrowclosed' },
};

export const EDGE_TYPE_OPTIONS: EdgeType[] = [
  'pipe',
  'assign',
  'manage',
  'report',
  'broadcast',
  'topic',
];
