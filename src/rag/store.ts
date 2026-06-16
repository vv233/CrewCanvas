import { nanoid } from 'nanoid';
import type { AgentNodeData, KbFile, Workflow } from '../types';
import {
  db,
  type RagChunkRecord,
  type RagScope,
  type RagSourceRecord,
} from '../storage/db';
import {
  chunkText,
  formatRagContext,
  tokenize,
  type RagSearchResult,
} from './retrieval';
import { invalidateRagIndex, searchRagIndex } from './ragIndex';
import i18n from '../i18n';

export interface AddRagSourceInput {
  id?: string;
  workflowId: string;
  scope: RagScope;
  agentNodeId?: string;
  name: string;
  content: string;
  createdAt?: number;
  updatedAt?: number;
}

export interface RagSourceExport {
  id: string;
  workflowId?: string;
  scope: RagScope;
  agentNodeId?: string;
  name: string;
  content: string;
  createdAt?: number;
  updatedAt?: number;
}

export async function addRagSource(
  input: AddRagSourceInput
): Promise<RagSourceRecord> {
  const now = Date.now();
  const source: RagSourceRecord = {
    id: input.id ?? nanoid(),
    workflowId: input.workflowId,
    scope: input.scope,
    agentNodeId: input.scope === 'agent' ? input.agentNodeId : undefined,
    name: input.name || i18n.t('ragRuntime.defaultSourceName'),
    content: input.content,
    size: input.content.length,
    status: 'indexing',
    createdAt: input.createdAt ?? now,
    updatedAt: input.updatedAt ?? now,
  };
  await db.ragSources.put(source);
  await reindexRagSource(source.id);
  return (await db.ragSources.get(source.id)) ?? source;
}

export async function listRagSources(
  workflowId: string,
  scope: RagScope,
  agentNodeId?: string
): Promise<RagSourceRecord[]> {
  const all = await db.ragSources.where('workflowId').equals(workflowId).toArray();
  return all
    .filter((s) => {
      if (s.scope !== scope) return false;
      if (scope === 'agent') return s.agentNodeId === agentNodeId;
      return true;
    })
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function getRagSource(id: string): Promise<RagSourceRecord | undefined> {
  return db.ragSources.get(id);
}

export async function deleteRagSource(id: string): Promise<void> {
  const source = await db.ragSources.get(id);
  const keys = await db.ragChunks.where('sourceId').equals(id).primaryKeys();
  await db.transaction('rw', db.ragSources, db.ragChunks, async () => {
    if (keys.length > 0) await db.ragChunks.bulkDelete(keys as string[]);
    await db.ragSources.delete(id);
  });
  invalidateRagIndex(source?.workflowId);
}

export async function reindexRagSource(id: string): Promise<void> {
  const source = await db.ragSources.get(id);
  if (!source) return;
  await db.ragSources.update(id, {
    status: 'indexing',
    error: undefined,
    updatedAt: Date.now(),
  });
  try {
    const chunks = buildChunkRecords(source);
    const existingKeys = await db.ragChunks.where('sourceId').equals(id).primaryKeys();
    await db.transaction('rw', db.ragSources, db.ragChunks, async () => {
      if (existingKeys.length > 0) {
        await db.ragChunks.bulkDelete(existingKeys as string[]);
      }
      if (chunks.length > 0) await db.ragChunks.bulkPut(chunks);
      await db.ragSources.update(id, {
        status: 'ready',
        error: undefined,
        size: source.content.length,
        updatedAt: Date.now(),
      });
    });
  } catch (err) {
    await db.ragSources.update(id, {
      status: 'error',
      error: err instanceof Error ? err.message : String(err),
      updatedAt: Date.now(),
    });
  }
  invalidateRagIndex(source.workflowId);
}

export async function searchRag(
  workflowId: string,
  agentNodeId: string | undefined,
  query: string
): Promise<RagSearchResult[]> {
  return searchRagIndex(workflowId, agentNodeId, query);
}

export async function buildRagContext(
  workflowId: string | undefined,
  agentNodeId: string | undefined,
  query: string
): Promise<string> {
  if (!workflowId || !query.trim()) return '';
  try {
    const results = await searchRag(workflowId, agentNodeId, query);
    return formatRagContext(results);
  } catch (err) {
    console.warn('RAG search failed', err);
    return '';
  }
}

export async function exportRagSources(
  workflowId: string
): Promise<RagSourceExport[]> {
  const sources = await db.ragSources.where('workflowId').equals(workflowId).toArray();
  return sources.map((s) => ({
    id: s.id,
    scope: s.scope,
    agentNodeId: s.agentNodeId,
    name: s.name,
    content: s.content,
    createdAt: s.createdAt,
    updatedAt: s.updatedAt,
  }));
}

export async function replaceRagSourcesForWorkflow(
  workflowId: string,
  sources: RagSourceExport[]
): Promise<void> {
  await deleteRagForWorkflow(workflowId);
  for (const source of sources) {
    await addRagSource({
      id: source.id || nanoid(),
      workflowId,
      scope: source.scope,
      agentNodeId: source.scope === 'agent' ? source.agentNodeId : undefined,
      name: source.name,
      content: source.content,
      createdAt: source.createdAt,
      updatedAt: source.updatedAt,
    });
  }
}

export async function deleteRagForWorkflow(workflowId: string): Promise<void> {
  const sourceKeys = await db.ragSources.where('workflowId').equals(workflowId).primaryKeys();
  const chunkKeys = await db.ragChunks.where('workflowId').equals(workflowId).primaryKeys();
  await db.transaction('rw', db.ragSources, db.ragChunks, async () => {
    if (chunkKeys.length > 0) await db.ragChunks.bulkDelete(chunkKeys as string[]);
    if (sourceKeys.length > 0) await db.ragSources.bulkDelete(sourceKeys as string[]);
  });
  invalidateRagIndex(workflowId);
}

export async function migrateLegacyKnowledge(wf: Workflow): Promise<void> {
  for (const node of wf.nodes) {
    if (node.data.kind !== 'agent') continue;
    const agent = node.data as AgentNodeData;
    const files = agent.knowledge?.files ?? [];
    if (files.length === 0) continue;
    for (const file of files) {
      if (!file.content.trim()) continue;
      const id = legacySourceId(wf.id, node.id, file);
      const existing = await db.ragSources.get(id);
      if (existing) continue;
      await addRagSource({
        id,
        workflowId: wf.id,
        scope: 'agent',
        agentNodeId: node.id,
        name: file.name,
        content: file.content,
      });
    }
  }
}

function buildChunkRecords(source: RagSourceRecord): RagChunkRecord[] {
  return chunkText(source.content).map((text, chunkIndex) => ({
    id: `${source.id}:${chunkIndex}`,
    workflowId: source.workflowId,
    sourceId: source.id,
    scope: source.scope,
    agentNodeId: source.agentNodeId,
    chunkIndex,
    text,
    terms: tokenize(`${source.name}\n${text}`),
  }));
}

function legacySourceId(workflowId: string, agentNodeId: string, file: KbFile): string {
  return `legacy:${workflowId}:${agentNodeId}:${file.id}`;
}
