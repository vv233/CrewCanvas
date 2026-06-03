import type { Workflow } from '../types';
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

export async function exportWorkflowJSON(wf: Workflow) {
  const ragSources = await exportRagSources(wf.id);
  const bundle: WorkflowExportBundle = { workflow: wf, ragSources };
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
