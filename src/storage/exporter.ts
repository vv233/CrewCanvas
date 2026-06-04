import type { Workflow, FlowNode, AgentNodeData } from '../types';
import {
  exportRagSources,
  replaceRagSourcesForWorkflow,
  type RagSourceExport,
} from '../rag/store';
import i18n from '../i18n';

interface WorkflowExportBundle {
  workflow: Workflow;
  ragSources?: RagSourceExport[];
}

export interface WorkflowExportOptions {
  /** Inline knowledge (on nodes) + private-library files (RAG sources). */
  includeKnowledge: boolean;
  /** MCP server auth tokens. When false, server configs are kept but tokens dropped. */
  includeSensitive: boolean;
}

const DEFAULT_OPTIONS: WorkflowExportOptions = {
  includeKnowledge: true,
  includeSensitive: false,
};

/** Return a copy of the workflow with agent-node fields stripped per options. */
function applyExportOptions(wf: Workflow, opts: WorkflowExportOptions): Workflow {
  if (opts.includeKnowledge && opts.includeSensitive) return wf;
  const nodes = wf.nodes.map((n): FlowNode => {
    if (n.data.kind !== 'agent') return n;
    const data = { ...(n.data as AgentNodeData) };
    if (!opts.includeKnowledge) delete data.knowledge;
    if (!opts.includeSensitive && data.mcpServers?.length) {
      data.mcpServers = data.mcpServers.map(({ authorizationToken: _drop, ...rest }) => rest);
    }
    return { ...n, data };
  });
  return { ...wf, nodes };
}

export async function exportWorkflowJSON(
  wf: Workflow,
  opts: WorkflowExportOptions = DEFAULT_OPTIONS
) {
  const workflow = applyExportOptions(wf, opts);
  const ragSources = opts.includeKnowledge ? await exportRagSources(wf.id) : undefined;
  const bundle: WorkflowExportBundle = { workflow, ragSources };
  const data = JSON.stringify(bundle, null, 2);
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${(wf.name || 'workflow').replace(/[^\w一-龥-]+/g, '_')}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function importWorkflowJSON(text: string): Promise<Workflow> {
  const parsed = JSON.parse(text) as Workflow | WorkflowExportBundle;
  const wf = isWorkflowExportBundle(parsed) ? parsed.workflow : parsed;
  if (!wf.nodes || !wf.edges) {
    throw new Error(i18n.t('errors.importNotWorkflow'));
  }
  const next = {
    ...wf,
    updatedAt: Date.now(),
  };
  if (isWorkflowExportBundle(parsed) && parsed.ragSources) {
    await replaceRagSourcesForWorkflow(next.id, parsed.ragSources);
  }
  return next;
}

function isWorkflowExportBundle(x: Workflow | WorkflowExportBundle): x is WorkflowExportBundle {
  return Boolean((x as WorkflowExportBundle).workflow);
}
