# Templates & Data Model

This is the reference for how a workflow is represented, the three ways to make templates, and the shape of every node, edge, and built-in tool. For end-user instructions see [`user-guide.md`](./user-guide.md); for tools see [`mcp.md`](./mcp.md).

## 1. Workflow JSON

A workflow is a plain object:

```ts
interface Workflow {
  id: string;
  name: string;
  variables: Record<string, string>; // referenced in souls as {{var.X}}
  nodes: FlowNode[];                  // React Flow nodes; node.data is AnyNodeData
  edges: FlowEdge[];                  // React Flow edges; edge.data is EdgeData
  createdAt: number;
  updatedAt: number;
}
```

**Export** (top bar) writes `<name>.json` as a bundle `{ workflow, ragSources }`, so attached RAG sources travel with it. It excludes API keys, run history, MCP tokens, and shared-folder contents. **Import** accepts either a bare `Workflow` or the bundle.

## 2. Three ways to make a template

1. **Export / import JSON** — round-trip a workflow you built in the UI.
2. **Import from TS** — paste a snippet in the dialog (§3 below).
3. **In code** — add to `src/templates/` (§4 below).

## 3. Import from TS

`Templates → Import from TS`. The snippet must `export default` an object:

```ts
export default {
  id: string,
  name: string,
  description?: string,
  build(): Workflow,
}
```

Rules:
- Globals available without importing: `nanoid`, `defaultNodeData`, `presetAgent`, `SOUL_PRESETS`.
- `import` statements are stripped; TS type annotations are removed (no type-checking).
- It's compiled in-browser and executed as a blob module — **only paste code you trust** (it can read `localStorage`).

Minimal example:

```ts
export default {
  id: 'my-translator',
  name: 'My Translation Template',
  description: 'trigger → translator → output',
  build() {
    const trig = nanoid(), ag = nanoid(), out = nanoid();
    return {
      id: nanoid(), name: 'My Translation Template',
      createdAt: Date.now(), updatedAt: Date.now(), variables: {},
      nodes: [
        { id: trig, type: 'trigger', position: { x: 40, y: 200 },
          data: { ...defaultNodeData('trigger'), input: 'The quick brown fox…' } },
        { id: ag,  type: 'agent',  position: { x: 340, y: 200 }, data: presetAgent('translator') },
        { id: out, type: 'output', position: { x: 640, y: 200 }, data: defaultNodeData('output') },
      ],
      edges: [
        { id: nanoid(), source: trig, target: ag,  type: 'pipe', data: { type: 'pipe' } },
        { id: nanoid(), source: ag,   target: out, type: 'pipe', data: { type: 'pipe' } },
      ],
    };
  },
};
```

## 4. In code (`src/templates/`)

- **Soul presets** — `soulPresets.ts` exposes `SOUL_PRESETS`; each preset's display name and persona body are localized via `presets.<id>` in `src/i18n/`. Current ids: `pm`, `engineer`, `designer`, `critic`, `optimist`, `translator`, `moderator`.
- **Workflow templates** — `workflowTemplates.ts` exposes the `WORKFLOW_TEMPLATES` array; names/descriptions/seed text are localized via `templatesData` in `src/i18n/`.

`presetAgent(id)` returns a ready `agent` data object built from a preset; `defaultNodeData(type)` returns sensible defaults for any node type (resolved in the current UI language).

## 5. Node reference

`AnyNodeData` is a discriminated union on `kind`.

### `trigger`
```ts
{ kind: 'trigger', name: string, input: string }
```
Seeds the graph; `input` is exposed downstream as `{{input}}`.

### `agent`
```ts
{
  kind: 'agent', name: string, avatar: string, soul: string,
  provider: ProviderId, model: string,
  temperature: number, maxTokens: number,
  memory: 'none' | 'session',
  mcpServers?: McpServerConfig[],
  knowledge?: { inline?: string; files?: KbFile[] },
}
```
`ProviderId` is `'anthropic' | 'openai' | 'openrouter' | 'ollama' | 'lmstudio'`.

### `discuss`
```ts
{
  kind: 'discuss', name: string, avatar: string, soul: string,
  provider: ProviderId, model: string, temperature: number, maxTokens: number,
  openingPrompt: string,   // first AI turn; supports {{input}}, {{var.X}}
}
```
Pauses the run for a human ↔ AI exchange; the final summary (or last AI reply) flows downstream.

### `room`
```ts
{
  kind: 'room', name: string,
  mode: 'round-robin' | 'moderator' | 'race',
  maxRounds: number,
  minTurnsPerSpeaker?: number,  // moderator mode
  moderatorId?: string,         // a member node id
  moderatorPrompt?: string,     // supports {{members}}, {{history}}
  stopKeyword?: string,
}
```
Members are ordinary `agent` nodes whose `parentId` is this room. In moderator mode the moderator returns one line of JSON: `{"next":"name"}` or `{"stop":true,"summary":"…"}`.

### `aggregator`
```ts
{ kind: 'aggregator', name: string,
  strategy: 'concat' | 'json-merge' | 'pick-first' | 'summarize',
  // summarize only:
  provider?: ProviderId, model?: string, prompt?: string }
```
`json-merge` parses each input as JSON and `Object.assign`s them. `summarize` sends all upstream outputs to the bound `provider`/`model` with your `prompt` as the instruction and returns one combined summary; if no model is set it defaults to a lightweight model, and on any call failure it falls back to `concat` with headers.

### `router`
```ts
{
  kind: 'router', name: string,
  rule: 'llm-judge' | 'regex',
  pattern: string,        // regex rule
  prompt?: string,        // llm-judge: criterion (match → a, else b)
  provider?: ProviderId,  // llm-judge: model that decides
  model?: string,
}
```
Two output handles, `'a'` (top) and `'b'` (bottom); the edge's `sourceHandle` picks which. At run time only the chosen branch executes — nodes on the other branch are marked `skipped`, and the skip cascades to their descendants.
- **regex** — `a` if `pattern` matches the upstream text, else `b`.
- **llm-judge** — a small `provider`/`model` call with `prompt` as the criterion and the upstream output as input; the model answers `a`/`b` (falls back to `b` on error).

### `output`
```ts
{ kind: 'output', name: string }
```
Displays the incoming text and records it as the run's `finalOutput`. Multiple outputs are allowed (one per branch).

## 6. Edge reference

```ts
interface EdgeData { type: EdgeType; label?: string; transform?: string }
type EdgeType = 'pipe' | 'assign' | 'report' | 'broadcast' | 'topic' | 'manage';
```

- `transform` rewrites the text as it passes (e.g. `Please review: {{output}}`).
- **`report`** edges are ignored when computing run order (async back-channels).
- **`manage`** defines a team: the target does **not** run in the main schedule; instead the source agent gets `list_team` + `delegate` and decides when to dispatch it. This is how hierarchical/autonomous orgs are built.

## 7. Built-in tools (auto-granted to agents)

When the provider supports tool calling, every `agent` automatically gets:

- **Shared folder** (per workflow, IndexedDB): `fs_list`, `fs_read`, `fs_write`, `fs_delete`. `fs_read` is capped (~12 KB) for model safety; larger files are truncated.
- **Knowledge base** (when the agent has knowledge files): `kb_list`, `kb_read`, `kb_search`. Relevant chunks are also auto-injected via RAG without a tool call.
- **Delegation** (only with outgoing `manage` edges): `list_team`, `delegate(name, task)`.
- **MCP tools**: whatever you attach in the Inspector — see [`mcp.md`](./mcp.md).

Tool-call loops are capped at 8 rounds. Ollama doesn't support tool calling.

## 8. `soul.md` & variables

`soul.md` is free-form Markdown describing the role, working style, and output format. Interpolated variables:

| Variable | Resolves to |
|---|---|
| `{{input}}` | the combined upstream input |
| `{{upstream.NodeName}}` | a specific upstream node's output |
| `{{var.X}}` | workflow variable `X` |
| `{{room.history}}` | the group-chat transcript (inside a room) |
| `{{members}}`, `{{history}}` | moderator-prompt helpers (room moderator mode) |

Tips: state explicitly when to use a tool; ask for short replies to save tokens; for structured handoffs, have one agent `fs_write` a file and the next `fs_read` it.

## 9. RAG details

Sources are chunked (~1200 chars, 200 overlap), tokenized (with CJK bi-gram support), and stored in IndexedDB. At run time the query (the agent's task + recent context) is scored against chunks; up to 6 results (max 3 per source, ~12 K chars total) are formatted and injected into the system prompt. Shared sources are visible to all agents; private sources only to their owning agent.

## 10. Debugging

- **Console** (bottom panel): graph parsing, each node's calls, tool invocations, errors.
- **Files** dialog: the actual shared-folder contents.
- Typical signals: `unknown tool: x` (model called an unregistered tool — usually self-corrects); a node stuck "running" (long call or a paused Discuss node); empty output (the node was on a skipped router branch).
