import { useWorkflowStore } from '../state/workflowStore';
import { AgentInspector } from './AgentInspector';
import { TriggerInspector } from './TriggerInspector';
import { RoomInspector } from './RoomInspector';
import { AggregatorInspector } from './AggregatorInspector';
import { RouterInspector } from './RouterInspector';
import { OutputInspector } from './OutputInspector';
import { DiscussInspector } from './DiscussInspector';
import { EdgeInspector } from './EdgeInspector';

export function Inspector() {
  const workflow = useWorkflowStore((s) => s.workflow);
  const selectedNodeId = useWorkflowStore((s) => s.selectedNodeId);
  const selectedEdgeId = useWorkflowStore((s) => s.selectedEdgeId);

  const node = workflow.nodes.find((n) => n.id === selectedNodeId);
  const edge = workflow.edges.find((e) => e.id === selectedEdgeId);

  return (
    <div className="flex h-full w-80 shrink-0 flex-col border-l border-line bg-bg-soft">
      <div className="border-b border-line px-3 py-2">
        <div className="label">检查器</div>
        <div className="mt-1 text-[11px] text-muted">
          {node
            ? `节点 · ${node.type}`
            : edge
            ? '连线'
            : '未选中（点击节点或连线编辑）'}
        </div>
      </div>
      <div className="flex-1 overflow-auto p-3">
        {node?.data?.kind === 'agent' ? (
          <AgentInspector node={node as never} />
        ) : node?.data?.kind === 'trigger' ? (
          <TriggerInspector node={node as never} />
        ) : node?.data?.kind === 'room' ? (
          <RoomInspector node={node as never} />
        ) : node?.data?.kind === 'aggregator' ? (
          <AggregatorInspector node={node as never} />
        ) : node?.data?.kind === 'router' ? (
          <RouterInspector node={node as never} />
        ) : node?.data?.kind === 'output' ? (
          <OutputInspector node={node as never} />
        ) : node?.data?.kind === 'discuss' ? (
          <DiscussInspector node={node as never} />
        ) : edge ? (
          <EdgeInspector edge={edge} />
        ) : (
          <div className="text-xs text-muted">
            <p>提示：</p>
            <ul className="mt-2 list-disc space-y-1 pl-4">
              <li>从左侧拖出节点</li>
              <li>拖动节点端口连线</li>
              <li>点击连线改变沟通方式</li>
              <li>点击 AI 节点编辑 soul.md</li>
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
