import i18n from '../i18n';

export const RAG_CHUNK_SIZE = 1200;
export const RAG_CHUNK_OVERLAP = 200;
export const RAG_MAX_RESULTS = 6;
export const RAG_MAX_RESULTS_PER_SOURCE = 3;
export const RAG_CONTEXT_CHAR_LIMIT = 12000;

export interface RagChunkInput {
  id: string;
  sourceId: string;
  sourceName: string;
  chunkIndex: number;
  text: string;
  terms: string[];
}

export interface RagSearchResult extends RagChunkInput {
  score: number;
}

const CJK_RE = /[\u3400-\u9fff]/;
const WORD_RE = /[a-z0-9_]+/g;

export function chunkText(
  text: string,
  chunkSize = RAG_CHUNK_SIZE,
  overlap = RAG_CHUNK_OVERLAP
): string[] {
  const normalized = text.replace(/\r\n/g, '\n').trim();
  if (!normalized) return [];
  if (normalized.length <= chunkSize) return [normalized];

  const chunks: string[] = [];
  const step = Math.max(1, chunkSize - overlap);
  let start = 0;
  while (start < normalized.length) {
    let end = Math.min(normalized.length, start + chunkSize);
    if (end < normalized.length) {
      const boundary = Math.max(
        normalized.lastIndexOf('\n\n', end),
        normalized.lastIndexOf('\n', end),
        normalized.lastIndexOf('。', end),
        normalized.lastIndexOf('.', end)
      );
      if (boundary > start + Math.floor(chunkSize * 0.55)) {
        end = boundary + 1;
      }
    }
    const chunk = normalized.slice(start, end).trim();
    if (chunk) chunks.push(chunk);
    if (end >= normalized.length) break;
    start = Math.max(end - overlap, start + step);
  }
  return chunks;
}

export function tokenize(text: string): string[] {
  const lower = text.toLowerCase();
  const terms = new Set<string>();

  for (const match of lower.matchAll(WORD_RE)) {
    const word = match[0];
    if (word.length >= 2) terms.add(word);
  }

  const cjkChars = Array.from(lower).filter((ch) => CJK_RE.test(ch));
  for (let i = 0; i < cjkChars.length - 1; i += 1) {
    terms.add(cjkChars[i] + cjkChars[i + 1]);
  }
  for (const ch of cjkChars) terms.add(ch);

  return [...terms];
}

export function scoreChunks(
  chunks: RagChunkInput[],
  query: string,
  opts?: { maxResults?: number; maxPerSource?: number }
): RagSearchResult[] {
  const queryTerms = tokenize(query);
  if (queryTerms.length === 0) return [];

  const querySet = new Set(queryTerms);
  const scored: RagSearchResult[] = [];
  for (const chunk of chunks) {
    const termSet = new Set(chunk.terms);
    let overlap = 0;
    let weighted = 0;
    for (const term of querySet) {
      if (!termSet.has(term)) continue;
      overlap += 1;
      weighted += term.length > 1 ? 2 : 1;
    }
    if (overlap === 0) continue;
    const density = weighted / Math.sqrt(Math.max(chunk.terms.length, 1));
    const exactBonus = chunk.text.toLowerCase().includes(query.toLowerCase().trim())
      ? 4
      : 0;
    scored.push({ ...chunk, score: density + overlap + exactBonus });
  }

  scored.sort((a, b) => b.score - a.score);
  const maxResults = opts?.maxResults ?? RAG_MAX_RESULTS;
  const maxPerSource = opts?.maxPerSource ?? RAG_MAX_RESULTS_PER_SOURCE;
  const perSource = new Map<string, number>();
  const out: RagSearchResult[] = [];
  for (const result of scored) {
    const count = perSource.get(result.sourceId) ?? 0;
    if (count >= maxPerSource) continue;
    perSource.set(result.sourceId, count + 1);
    out.push(result);
    if (out.length >= maxResults) break;
  }
  return out;
}

export function formatRagContext(
  results: RagSearchResult[],
  charLimit = RAG_CONTEXT_CHAR_LIMIT
): string {
  if (results.length === 0) return '';
  const parts: string[] = [
    i18n.t('ragRuntime.contextHeader'),
    '',
    i18n.t('ragRuntime.contextIntro'),
  ];
  let used = parts.join('\n').length;
  for (const r of results) {
    const header = `\n\n### ${r.sourceName} · ${i18n.t('ragRuntime.snippet')} ${r.chunkIndex + 1}`;
    const body = r.text.trim();
    const nextLen = header.length + body.length;
    if (used + nextLen > charLimit) {
      const remaining = charLimit - used - header.length - 20;
      if (remaining > 200) {
        parts.push(header, body.slice(0, remaining).trim() + '\n' + i18n.t('ragRuntime.truncated'));
      }
      break;
    }
    parts.push(header, body);
    used += nextLen;
  }
  return parts.join('\n');
}
