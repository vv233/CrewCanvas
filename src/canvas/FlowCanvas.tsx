import {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  SelectionMode,
  useReactFlow,
  type Node,
  type NodeTypes,
  type EdgeTypes,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useCallback, useRef } from 'react';
import { useWorkflowStore } from '../state/workflowStore';
import { AgentNode } from './nodes/AgentNode';
import { TriggerNode } from './nodes/TriggerNode';
import { OutputNode } from './nodes/OutputNode';
import { RoomNode } from './nodes/RoomNode';
import { AggregatorNode } from './nodes/AggregatorNode';
import { RouterNode } from './nodes/RouterNode';
import { DiscussNode } from './nodes/DiscussNode';
import { TypedEdge } from './edges/TypedEdge';
import type { NodeType } from '../types';

const nodeTypes: NodeTypes = {
  agent: AgentNode as never,
  trigger: TriggerNode as never,
  output: OutputNode as never,
  room: RoomNode as never,
  aggregator: AggregatorNode as never,
  router: RouterNode as never,
  discuss: DiscussNode as never,
};

const edgeTypes: EdgeTypes = {
  pipe: TypedEdge,
  assign: TypedEdge,
  report: TypedEdge,
  broadcast: TypedEdge,
  topic: TypedEdge,
  manage: TypedEdge,
};

function absolutePosition(node: Node): { x: number; y: number } {
  // For nodes with parentId we get back the absolute position by reading the
  // measured positionAbsolute field React Flow attaches at runtime; fall back
  // to position if it's missing (root nodes).
  const abs = (node as Node & { positionAbsolute?: { x: number; y: number } })
    .positionAbsolute;
  return abs ?? node.position;
}

function CanvasInner() {
  const workflow = useWorkflowStore((s) => s.workflow);
  const onNodesChange = useWorkflowStore((s) => s.onNodesChange);
  const onEdgesChange = useWorkflowStore((s) => s.onEdgesChange);
  const onConnect = useWorkflowStore((s) => s.onConnect);
  const selectNode = useWorkflowStore((s) => s.selectNode);
  const selectEdge = useWorkflowStore((s) => s.selectEdge);
  const addNode = useWorkflowStore((s) => s.addNode);

  const setNodeParent = useWorkflowStore((s) => s.setNodeParent);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const { screenToFlowPosition, getIntersectingNodes, getNode } = useReactFlow();

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const type = e.dataTransfer.getData('application/aiof-node') as NodeType;
      if (!type) return;
      const position = screenToFlowPosition({ x: e.clientX, y: e.clientY });
      addNode(type, position);
    },
    [addNode, screenToFlowPosition]
  );

  const onNodeDragStop = useCallback(
    (_: React.MouseEvent, node: Node) => {
      // Only re-parent agent nodes; rooms cannot nest inside other rooms.
      if (node.type !== 'agent') return;
      const intersections = getIntersectingNodes(node).filter((n) => n.type === 'room');
      const currentParent = (node as Node & { parentId?: string }).parentId;
      const targetRoom = intersections[0];

      if (targetRoom && targetRoom.id !== currentParent) {
        // Entering a room (or switching rooms): convert position to room-relative.
        const room = getNode(targetRoom.id);
        if (!room) return;
        const childAbs = absolutePosition(node);
        const roomAbs = absolutePosition(room);
        setNodeParent(node.id, targetRoom.id, {
          x: childAbs.x - roomAbs.x,
          y: childAbs.y - roomAbs.y,
        });
      } else if (!targetRoom && currentParent) {
        // Leaving the room: convert relative position to absolute.
        const parent = getNode(currentParent);
        if (!parent) return;
        const parentAbs = absolutePosition(parent);
        setNodeParent(node.id, null, {
          x: parentAbs.x + node.position.x,
          y: parentAbs.y + node.position.y,
        });
      }
    },
    [getIntersectingNodes, getNode, setNodeParent]
  );

  return (
    <div ref={wrapperRef} className="h-full w-full" onDragOver={onDragOver} onDrop={onDrop}>
      <ReactFlow
        nodes={workflow.nodes}
        edges={workflow.edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={(_, n) => selectNode(n.id)}
        onEdgeClick={(_, e) => selectEdge(e.id)}
        onNodeDragStop={onNodeDragStop}
        // Deletion is handled by the app's global key handler (App.tsx) via
        // removeSelected(), which records an undo step — disable React Flow's
        // built-in delete so it doesn't also remove nodes without history.
        deleteKeyCode={null}
        // Box (rubber-band) selection: left-drag on empty canvas draws a
        // selection rectangle; pan with middle/right mouse or hold Space.
        selectionOnDrag
        selectionMode={SelectionMode.Partial}
        panOnDrag={[1, 2]}
        panActivationKeyCode="Space"
        onPaneClick={() => {
          selectNode(null);
          selectEdge(null);
        }}
        fitView
        proOptions={{ hideAttribution: false }}
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#252a36" />
        <Controls position="bottom-left" />
        <MiniMap
          position="bottom-right"
          nodeColor={(n) => {
            switch (n.type) {
              case 'agent':
                return '#6366f1';
              case 'trigger':
                return '#f97316';
              case 'output':
                return '#10b981';
              case 'room':
                return '#22d3ee';
              case 'router':
                return '#f59e0b';
              case 'aggregator':
                return '#a78bfa';
              default:
                return '#888';
            }
          }}
          maskColor="rgba(11, 13, 18, 0.7)"
        />
      </ReactFlow>
    </div>
  );
}

export function FlowCanvas() {
  return (
    <ReactFlowProvider>
      <CanvasInner />
    </ReactFlowProvider>
  );
}
