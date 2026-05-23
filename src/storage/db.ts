import Dexie, { type Table } from 'dexie';
import type { Workflow } from '../types';

export interface RunRecord {
  id: string;
  workflowId: string;
  workflowName: string;
  startedAt: number;
  finishedAt: number;
  status: 'done' | 'error' | 'aborted';
  nodeOutputs: Record<string, { name: string; output: string; status: string }>;
  finalOutput: string;
  triggerInput: string;
}

export interface WorkflowFileRecord {
  id: string;
  workflowId: string;
  path: string;
  content: Blob;
  size: number;
  modified: number;
}

export type RagScope = 'shared' | 'agent';
export type RagSourceStatus = 'indexing' | 'ready' | 'error';

export interface RagSourceRecord {
  id: string;
  workflowId: string;
  scope: RagScope;
  agentNodeId?: string;
  name: string;
  content: string;
  size: number;
  status: RagSourceStatus;
  error?: string;
  createdAt: number;
  updatedAt: number;
}

export interface RagChunkRecord {
  id: string;
  workflowId: string;
  sourceId: string;
  scope: RagScope;
  agentNodeId?: string;
  chunkIndex: number;
  text: string;
  terms: string[];
}

class AiofDB extends Dexie {
  workflows!: Table<Workflow, string>;
  runs!: Table<RunRecord, string>;
  workflowFiles!: Table<WorkflowFileRecord, string>;
  ragSources!: Table<RagSourceRecord, string>;
  ragChunks!: Table<RagChunkRecord, string>;

  constructor() {
    super('aiof');
    this.version(1).stores({
      workflows: 'id, name, updatedAt',
      runs: 'id, workflowId, startedAt',
    });
    this.version(2).stores({
      workflows: 'id, name, updatedAt',
      runs: 'id, workflowId, startedAt',
      workflowFiles: 'id, workflowId, path, [workflowId+path]',
    });
    this.version(3).stores({
      workflows: 'id, name, updatedAt',
      runs: 'id, workflowId, startedAt',
      workflowFiles: 'id, workflowId, path, [workflowId+path]',
      ragSources: 'id, workflowId, scope, agentNodeId, status, updatedAt, [workflowId+scope], [workflowId+agentNodeId]',
      ragChunks: 'id, workflowId, sourceId, scope, agentNodeId, [workflowId+scope], [workflowId+agentNodeId], [sourceId+chunkIndex]',
    });
  }
}

export const db = new AiofDB();

export async function saveWorkflow(wf: Workflow): Promise<void> {
  await db.workflows.put(wf);
}

export async function loadAllWorkflows(): Promise<Workflow[]> {
  return db.workflows.orderBy('updatedAt').reverse().toArray();
}

export async function deleteWorkflow(id: string): Promise<void> {
  await db.workflows.delete(id);
}

export async function saveRun(run: RunRecord): Promise<void> {
  await db.runs.put(run);
  // keep at most 200 runs
  const total = await db.runs.count();
  if (total > 200) {
    const old = await db.runs.orderBy('startedAt').limit(total - 200).primaryKeys();
    await db.runs.bulkDelete(old);
  }
}

export async function loadRuns(workflowId?: string): Promise<RunRecord[]> {
  if (workflowId) {
    return db.runs.where('workflowId').equals(workflowId).reverse().sortBy('startedAt');
  }
  return db.runs.orderBy('startedAt').reverse().toArray();
}

export async function deleteRun(id: string): Promise<void> {
  await db.runs.delete(id);
}
