import type { AgentNodeData, McpServerConfig, ProviderId } from '../types';
import { listRagSources, addRagSource } from '../rag/store';

/** Marker so importers can recognise a role-card file. */
export const ROLE_CARD_KIND = 'crewcanvas.rolecard';

export interface RoleCardFile {
  name: string;
  content: string;
}

/** A portable "role card" — one agent's persona and config, detached from any
 *  workflow. Knowledge/library and MCP auth tokens are opt-in on export. */
export interface RoleCard {
  kind: typeof ROLE_CARD_KIND;
  version: 1;
  name: string;
  avatar: string;
  soul: string;
  provider: ProviderId;
  model: string;
  temperature: number;
  maxTokens: number;
  memory: 'none' | 'session';
  /** Inline knowledge prepended to the system prompt (included if includeKnowledge). */
  inlineKnowledge?: string;
  /** Private-library files (included if includeKnowledge). */
  libraryFiles?: RoleCardFile[];
  /** MCP server configs. Auth tokens are stripped unless includeSensitive. */
  mcpServers?: McpServerConfig[];
}

export interface RoleCardExportOptions {
  /** Inline knowledge + private-library files. */
  includeKnowledge: boolean;
  /** MCP server auth tokens. When false, server configs are kept but tokens dropped. */
  includeSensitive: boolean;
}

function stripToken(s: McpServerConfig): McpServerConfig {
  const { authorizationToken: _drop, ...rest } = s;
  return rest;
}

/** Build a role card from an agent node and (optionally) its RAG library. */
export async function buildRoleCard(
  data: AgentNodeData,
  workflowId: string,
  agentNodeId: string,
  opts: RoleCardExportOptions
): Promise<RoleCard> {
  const card: RoleCard = {
    kind: ROLE_CARD_KIND,
    version: 1,
    name: data.name,
    avatar: data.avatar,
    soul: data.soul,
    provider: data.provider,
    model: data.model,
    temperature: data.temperature,
    maxTokens: data.maxTokens,
    memory: data.memory,
  };
  if (opts.includeKnowledge) {
    if (data.knowledge?.inline?.trim()) card.inlineKnowledge = data.knowledge.inline;
    const sources = await listRagSources(workflowId, 'agent', agentNodeId);
    const files = sources
      .filter((s) => s.content.trim())
      .map((s) => ({ name: s.name, content: s.content }));
    if (files.length) card.libraryFiles = files;
  }
  if (data.mcpServers?.length) {
    card.mcpServers = opts.includeSensitive
      ? data.mcpServers
      : data.mcpServers.map(stripToken);
  }
  return card;
}

function isRoleCardLike(x: unknown): x is Partial<RoleCard> & { soul: string } {
  return (
    !!x &&
    typeof x === 'object' &&
    typeof (x as { soul?: unknown }).soul === 'string'
  );
}

/** Parse one file's text into zero or more role cards. Accepts a single card, a
 *  bare array, a `{ roleCards: [...] }` bundle, or a raw agent node `data`. */
export function parseRoleCards(text: string): RoleCard[] {
  const parsed: unknown = JSON.parse(text);
  let candidates: unknown[];
  if (Array.isArray(parsed)) candidates = parsed;
  else if (parsed && typeof parsed === 'object' && Array.isArray((parsed as { roleCards?: unknown }).roleCards))
    candidates = (parsed as { roleCards: unknown[] }).roleCards;
  else candidates = [parsed];
  return candidates.filter(isRoleCardLike).map(normalizeCard);
}

function normalizeCard(c: Partial<RoleCard> & { soul: string }): RoleCard {
  return {
    kind: ROLE_CARD_KIND,
    version: 1,
    name: c.name ?? 'Agent',
    avatar: c.avatar ?? '🤖',
    soul: c.soul,
    provider: (c.provider as ProviderId) ?? 'openrouter',
    model: c.model ?? '',
    temperature: typeof c.temperature === 'number' ? c.temperature : 0.7,
    maxTokens: typeof c.maxTokens === 'number' ? c.maxTokens : 1024,
    memory: c.memory === 'none' ? 'none' : 'session',
    inlineKnowledge: c.inlineKnowledge,
    libraryFiles: c.libraryFiles,
    mcpServers: c.mcpServers,
  };
}

/** Convert a role card into agent node data. Library files are NOT placed here;
 *  call applyRoleCardLibrary after the node exists to write them to the RAG store. */
export function roleCardToAgentData(card: RoleCard): AgentNodeData {
  return {
    kind: 'agent',
    name: card.name,
    avatar: card.avatar,
    soul: card.soul,
    provider: card.provider,
    model: card.model,
    temperature: card.temperature,
    maxTokens: card.maxTokens,
    memory: card.memory,
    mcpServers: card.mcpServers,
    knowledge: card.inlineKnowledge ? { inline: card.inlineKnowledge } : undefined,
  };
}

/** Write a role card's private-library files into the RAG store for a freshly
 *  created agent node. */
export async function applyRoleCardLibrary(
  card: RoleCard,
  workflowId: string,
  agentNodeId: string
): Promise<void> {
  if (!card.libraryFiles?.length) return;
  for (const f of card.libraryFiles) {
    if (!f.content.trim()) continue;
    await addRagSource({
      workflowId,
      scope: 'agent',
      agentNodeId,
      name: f.name,
      content: f.content,
    });
  }
}

const sanitize = (s: string) => (s || 'rolecard').replace(/[^\w一-龥-]+/g, '_');

export function downloadRoleCard(card: RoleCard): void {
  const blob = new Blob([JSON.stringify(card, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${sanitize(card.name)}.rolecard.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
