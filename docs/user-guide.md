# AI Org Flow — User Guide

AI Org Flow lets you orchestrate several AIs as a team. You draw an "org chart" on a canvas, give each AI a personality (`soul.md`), wire the nodes together with typed connections, and press **Run**. It's pure front-end — everything runs in your browser, with no backend and no accounts.

## Contents

1. [What it is / who it's for](#1-what-it-is--who-its-for)
2. [Quickstart](#2-quickstart)
3. [Providers](#3-providers)
4. [Canvas basics](#4-canvas-basics)
5. [Node types](#5-node-types)
6. [Edge types](#6-edge-types)
7. [Tools](#7-tools)
8. [Templates & sharing](#8-templates--sharing)
9. [Running & history](#9-running--history)
10. [Data & persistence](#10-data--persistence)
11. [Deployment](#11-deployment)
12. [FAQ](#12-faq)
13. [Security](#13-security)
14. [Keyboard shortcuts](#14-keyboard-shortcuts)

---

## 1. What it is / who it's for

Reach for AI Org Flow when a task benefits from **several AI roles working together** — a PM, an engineer, and a designer reacting to one brief; an optimist and a critic argued out by a moderator; or a manager that breaks work into subtasks and hands them to specialists.

It is **not** meant for a single one-shot prompt (use a chat app), or for anything that needs a server, a shared database, or multi-user state.

**Mental model (30s):** a workflow is a directed graph. **Task Entry** nodes seed the input, **AI Worker** nodes call a model, **Output** nodes show results. Edges carry text downstream and label *how* two nodes talk. The engine runs nodes in dependency order and runs independent nodes in parallel.

The UI defaults to **English**; switch to **中文** anytime with the globe button in the top bar (the choice is remembered).

---

## 2. Quickstart

1. **Settings** (top bar) → paste an API key for any provider (OpenRouter is an easy start) → **Test connection** → look for the green ✓.
2. **Templates** (top bar) → load **Product Trio** to see a working graph, or drag nodes from the left palette to build your own.
3. Click an **AI Worker** node → choose a provider/model and edit its `soul.md` on the right.
4. Click the **Task Entry** node → type your task into **Input**.
5. **Run**. Output streams onto the nodes in real time.
6. **History** → reopen any past run in full.

---

## 3. Providers

Open **Settings**; keys live only in your browser (see [Security](#13-security)). Five providers:

| Provider | Key | Notes |
|---|---|---|
| **Anthropic** | `sk-ant-…` | Claude models. The only provider that can use *remote* MCP servers. |
| **OpenAI** | `sk-…` | Base URL is editable, so OpenAI-compatible proxies work. |
| **OpenRouter** | `sk-or-…` | One key, many models (`anthropic/claude-sonnet-4`, …). Optional Referer/Title appear in the OpenRouter dashboard. |
| **LM Studio** | optional | Local; default `http://localhost:1234/v1`. Model id = the model you've loaded. |
| **Ollama** | none | Local; default `http://localhost:11434` (`ollama serve`). **No tool calling.** |

Each section's **Test connection** runs a real probe and shows the exact failure reason.

---

## 4. Canvas basics

- **Add a node** — drag from the left palette onto the canvas.
- **Connect** — drag from an output port to an input port. New edges are **pipe** by default; click an edge to change its type.
- **Inspect/edit** — click a node or edge; settings appear in the right-hand **Inspector**.
- **Delete** — use the delete button in the Inspector.
- **Undo / Redo** — `Ctrl/Cmd+Z` / `Ctrl/Cmd+Shift+Z` (or `Ctrl/Cmd+Y`).
- **Pan / zoom** — drag the background / scroll; bottom-left controls and a minimap help.
- **Add to a group chat** — drag an **AI Worker** *inside* a **Group Chat** node to make it a member; drag it out to remove it.
- **Rename** — edit the workflow name field in the top bar.

---

## 5. Node types

Seven types in the palette:

| Node | Purpose |
|---|---|
| **Task Entry** | Start point. Its **Input** seeds the graph (downstream `{{input}}`). |
| **AI Worker** | An AI role: provider/model, temperature, max tokens, memory, and a `soul.md` persona. Can use tools. |
| **Discuss with User** | Pauses the run so *you* refine a plan with the AI, then sends the result downstream. |
| **Group Chat** | A room where member AIs discuss over rounds (round-robin / moderator / race). |
| **Aggregate** | Merges several upstream inputs (concat / json-merge / pick-first / summarize). |
| **Branch** | Routes to one of two outputs by regex or an AI judge; the other branch is skipped. |
| **Output** | Endpoint: shows the text and records it as the run's final output. |

**Group Chat** details: choose **round-robin** (everyone speaks in order), **moderator** (a chosen member picks the next speaker and decides when to stop, returning one line of JSON; set min turns per speaker), or **race** (members answer in parallel, first wins). A stop keyword can end it early; the room's output is the moderator's summary or the last turn.

**Branch** details: branch **`a`** is the top handle, **`b`** the bottom. *Regex* matches the upstream text against your pattern. *AI judge* makes a small model call — you write a **criterion**, the model reads the upstream output and answers `a`/`b` (matches → `a`, else `b`; falls back to `b` on error). Configure criterion + provider + model in the Inspector. Only the chosen branch runs; the rest are marked **skipped**.

> Note: the Aggregate **summarize** strategy currently behaves like concat-with-headers; binding a real summarizing agent is on the roadmap.

---

## 6. Edge types

Click an edge to set its type — it frames how the upstream text reaches the downstream node:

| Type | Meaning |
|---|---|
| **pipe** | Output flows straight into the next input. |
| **assign** | Framed as a task assigned by a manager. |
| **broadcast** | One-to-many parallel fan-out. |
| **report** | Async back-channel; ignored for scheduling order. |
| **topic** | Starts a topic inside a Group Chat. |
| **manage** | Manager → report **team** link. The report doesn't run in the main schedule; the manager dispatches it via the `delegate` tool. |

Edges also support an optional **label** and an **output transform** template (e.g. `Please review: {{output}}`).

---

## 7. Tools

When an AI Worker's provider supports tool calling (all except Ollama), the model can call tools mid-reasoning. The node shows each call (`🔧`), its arguments, and the result (`↩️`).

- **Shared folder** — `fs_list` / `fs_read` / `fs_write` / `fs_delete` over a per-workflow folder shared by all nodes (IndexedDB). Great for passing long artifacts between nodes. Browse it via the top-bar **Files** dialog. `fs_read` is capped, so large files come back truncated.
- **Knowledge base & RAG** — give an agent **inline background** (always in its prompt) and a **private library** of text; the top-bar **Library** holds shared sources. Sources are chunked, indexed locally, and **auto-retrieved** into context based on the task. Agents can also use `kb_list` / `kb_read` / `kb_search`.
- **Delegation** — an agent with outgoing **manage** edges gets `list_team` and `delegate(name, task)` to hand subtasks to subordinates (cycles are refused).
- **MCP tools** — attach your own [MCP](https://modelcontextprotocol.io) servers per agent in the Inspector. See [`mcp.md`](./mcp.md).

Tool support: Anthropic / OpenAI / OpenRouter / LM Studio ✅, **Ollama ❌**. Tool loops are capped (8 rounds) to avoid runaways.

---

## 8. Templates & sharing

- **Built-in template** — **Templates → Product Trio**: a brief is broadcast to a PM, an engineer, and a designer, each answering into an Output. Loading replaces the canvas (with a confirm).
- **Export / import** — **Export** downloads the workflow (nodes/edges/variables + attached RAG sources); it excludes keys, history, MCP tokens, and shared-folder files. **Import** loads it back.
- **Import from TS** — paste a snippet that `export default`s `{ id, name, description?, build() }`. Globals `nanoid`, `defaultNodeData`, `SOUL_PRESETS`, `presetAgent` are available; `import` lines are stripped. ⚠️ The code runs in your browser — only paste what you trust. (Reference: [`templates.md`](./templates.md).)

---

## 9. Running & history

- **Run / Stop** in the top bar; Stop aborts in-flight requests.
- **Status dots:** queued → running (pulsing) → done (green) / error (red) / **skipped** (dim).
- **Streaming:** model text lands on the node as it arrives.
- **Console** (bottom): per-node logs, tool calls, errors; clear with the trash icon.
- **History:** the last 200 runs are saved automatically — expand any to see input, final output, and every node's output and status.

---

## 10. Data & persistence

Everything is local to your browser:

| Data | Stored in |
|---|---|
| Current workflow (nodes/edges/variables) | `localStorage` (`aiof.workflow.v1`) |
| Settings & API keys | `localStorage` (`aiof.settings.v1`) |
| Run history (last 200) | IndexedDB |
| Shared folder (`fs_*`) | IndexedDB (per workflow) |
| RAG sources & index | IndexedDB |

Closing or refreshing keeps everything. To wipe: DevTools → Application → clear `localStorage` + IndexedDB, or use the top-bar **Reset** (restores only the starter workflow). Back up with **Export**.

> Storage is **IndexedDB**, which works on every origin — including plain-HTTP LAN / Tailscale addresses — and in every browser.

---

## 11. Deployment

A static SPA. Dev: `npm install && npm run dev` (serves `127.0.0.1:5173`). Production: `npm run build`, then serve `dist/`:

- **Vercel / Cloudflare Pages / GitHub Pages** — deploy `dist/` as static assets.
- **Nginx / Caddy** — serve `dist/` as the web root; no rewrite rules needed (no client-side router).
- **Remote (e.g. Tailscale)** — serve over your tailnet IP; storage still works (IndexedDB).

---

## 12. FAQ

- **Test passes but the run errors.** The probe checks connectivity, not the model id — verify the model name for that provider.
- **Moderator stops the room too soon.** Raise *min turns per speaker* or strengthen the moderator instruction.
- **The AI never calls tools.** The provider can't (Ollama), the model is too weak, or the `soul.md` doesn't ask it to — say so explicitly and use a capable model.
- **A manager won't delegate.** Ensure **manage** edges exist and tell it to use `list_team` / `delegate`.
- **MCP local → CORS error.** Your server must send CORS headers and expose `Mcp-Session-Id` — see [`mcp.md`](./mcp.md).
- **TS import → "Unexpected token".** It must `export default` an object; no `import` statements.
- **A node dot stays orange.** It's on a long model call or a paused Discuss node.
- **Storage full.** Delete old history, large shared-folder files, or RAG sources.

---

## 13. Security

- **API keys are plaintext** in `localStorage`, sent straight from your browser to the provider. Use only on your own device. Master-password encryption is on the roadmap.
- **"Import from TS" executes code** in your browser — only paste snippets you trust.
- **MCP servers run with your trust** — connect only servers you control; a `local` server can do whatever its tools allow, and a permissive (`*`) CORS server can be reached by any site you visit.
- **The shared folder is origin-private**, but any script on the same origin can read it.
- **Token cost:** Room rounds + recursive delegation can burn a lot of tokens fast — watch usage.

---

## 14. Keyboard shortcuts

| Action | Shortcut |
|---|---|
| Undo | `Ctrl/Cmd + Z` |
| Redo | `Ctrl/Cmd + Shift + Z` or `Ctrl/Cmd + Y` |

(Ignored while typing in inputs, textareas, or the Monaco editor.)
