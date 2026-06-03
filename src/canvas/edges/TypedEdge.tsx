import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  type EdgeProps,
} from '@xyflow/react';
import { useTranslation } from 'react-i18next';
import { EDGE_STYLES } from './edgeStyles';
import type { EdgeData, EdgeType } from '../../types';

export function TypedEdge(props: EdgeProps & { data?: EdgeData; type?: string }) {
  const { t } = useTranslation();
  const {
    id,
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    selected,
    data,
    type,
    markerEnd: providedMarkerEnd,
  } = props;
  const edgeType = (data?.type ?? (type as EdgeType) ?? 'pipe') as EdgeType;
  const style = EDGE_STYLES[edgeType] ?? EDGE_STYLES.pipe;

  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  });

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={providedMarkerEnd}
        style={{
          stroke: style.stroke,
          strokeWidth: selected ? 2.5 : 1.6,
          strokeDasharray: style.strokeDasharray,
        }}
      />
      <EdgeLabelRenderer>
        <div
          className="nodrag nopan pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 rounded px-1.5 py-0.5 text-[10px] font-medium"
          style={{
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            background: '#161a23',
            color: style.stroke,
            border: `1px solid ${style.stroke}55`,
          }}
        >
          {data?.label ?? t(`edges.types.${edgeType}.label`)}
        </div>
      </EdgeLabelRenderer>
    </>
  );
}
