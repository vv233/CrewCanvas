import MiniSearch from 'minisearch';
import { db, type RagScope } from '../storage/db';
import {
  tokenize,
  RAG_MAX_RESULTS,
  RAG_MAX_RESULTS_PER_SOURCE,
  type RagSearchResult,
} from './retrieval';

/**
 * Full-text RAG search backed by MiniSearch (inverted index + BM25 ranking),
 * replacing the previous per-query full table scan + hand-rolled scoring.
 *
 * One index is built per workflow and cached in memory. Every chunk in the
 * workflow (across all sources/scopes) goes into a single index; scope
 * eligibility (shared vs. a specific agent's private sources) is enforced at
 * query time via a result filter. The cache is invalidated whenever sources
 * change — see `invalidateRagIndex`, called from the store mutators.
 *
 * The same CJK-aware tokenizer used at index time (`tokenize`) is reused for
 * the query, so Chinese bigram matching keeps working.
 */

interface RagDoc {
  id: string;
  text: string;
  sourceName: string;
  sourceId: string;
  chunkIndex: number;
  scope: RagScope;
  agentNodeId?: string;
}

const indexCache = new Map<string, MiniSearch<RagDoc>>();

function createIndex(): MiniSearch<RagDoc> {
  return new MiniSearch<RagDoc>({
    idField: 'id',
    fields: ['text', 'sourceName'],
    storeFields: ['sourceId', 'sourceName', 'chunkIndex', 'text', 'scope', 'agentNodeId'],
    // Reuse the project's CJK bigram + word tokenizer for both indexing and
    // querying. It already lowercases and dedupes, so pass terms through as-is.
    tokenize: (text) => tokenize(text),
    processTerm: (term) => term,
  });
}

async function getIndex(workflowId: string): Promise<MiniSearch<RagDoc>> {
  const cached = indexCache.get(workflowId);
  if (cached) return cached;

  const [sources, chunks] = await Promise.all([
    db.ragSources.where('workflowId').equals(workflowId).toArray(),
    db.ragChunks.where('workflowId').equals(workflowId).toArray(),
  ]);
  // Only chunks belonging to a "ready" source are searchable.
  const nameById = new Map(
    sources.filter((s) => s.status === 'ready').map((s) => [s.id, s.name])
  );
  const docs: RagDoc[] = chunks
    .filter((c) => nameById.has(c.sourceId))
    .map((c) => ({
      id: c.id,
      text: c.text,
      sourceName: nameById.get(c.sourceId) ?? c.sourceId.slice(0, 8),
      sourceId: c.sourceId,
      chunkIndex: c.chunkIndex,
      scope: c.scope,
      agentNodeId: c.agentNodeId,
    }));

  const mini = createIndex();
  mini.addAll(docs);
  indexCache.set(workflowId, mini);
  return mini;
}

/** Drop a cached index so the next search rebuilds it. Pass a workflowId to
 *  evict just that workflow, or nothing to clear everything. */
export function invalidateRagIndex(workflowId?: string): void {
  if (workflowId) indexCache.delete(workflowId);
  else indexCache.clear();
}

export async function searchRagIndex(
  workflowId: string,
  agentNodeId: string | undefined,
  query: string
): Promise<RagSearchResult[]> {
  if (!query.trim()) return [];
  const mini = await getIndex(workflowId);
  const hits = mini.search(query, {
    combineWith: 'OR',
    boost: { sourceName: 2 },
    filter: (r) =>
      r.scope === 'shared' ||
      (r.scope === 'agent' && !!agentNodeId && r.agentNodeId === agentNodeId),
  });

  // hits come back sorted by score desc; cap per-source and overall.
  const perSource = new Map<string, number>();
  const out: RagSearchResult[] = [];
  for (const r of hits) {
    const count = perSource.get(r.sourceId) ?? 0;
    if (count >= RAG_MAX_RESULTS_PER_SOURCE) continue;
    perSource.set(r.sourceId, count + 1);
    out.push({
      id: r.id as string,
      sourceId: r.sourceId,
      sourceName: r.sourceName,
      chunkIndex: r.chunkIndex,
      text: r.text,
      terms: [],
      score: r.score,
    });
    if (out.length >= RAG_MAX_RESULTS) break;
  }
  return out;
}
