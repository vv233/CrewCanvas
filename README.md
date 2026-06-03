# AI Org Flow

**Drag-and-drop orchestration for teams of AIs — 100% in the browser.**

Treat each AI as an employee: draw an org chart on a canvas, give every AI a personality in `soul.md`, wire them together with typed connections, and press **Run**. There's no backend, no sign-up, and no server-side state — your keys and data never leave your browser.

> The UI is **English** by default, with a **中文** toggle in the top bar. In-depth guides live in [`docs/`](./docs).

---

## Why

A single chatbot is one voice. Real work often needs several — a PM, an engineer, and a designer reacting to one brief; an optimist and a critic refereed by a moderator; a manager that splits a job and hands pieces to specialists. AI Org Flow lets you wire those roles into a graph and watch them collaborate, with full visibility into every step.

## Features

- **7 node types** — Task Entry · AI Worker · Discuss with User · Group Chat · Aggregate · Branch · Output
- **6 edge types** — pipe · assign · report · broadcast · topic · manage (the edge type sets the up/downstream communication semantics)
- **5 providers, browser-direct** — Anthropic Claude · OpenAI · OpenRouter · Ollama (local) · LM Studio (local)
- **`soul.md` personas** — define each AI's role / style / duties in Markdown, with `{{variable}}` interpolation
- **Group chat** — multiple AIs discuss over rounds: round-robin, moderator, or race
- **Conditional branching** — route the flow by regex or a real **LLM-judge** call; the untaken branch is skipped
- **RAG library** — drop in text; it's chunked, indexed locally, and auto-retrieved into context at run time
- **Tools** — a per-workflow shared folder (`fs_*`), a private knowledge base (`kb_*`), delegation across `manage` edges, and your own **MCP** servers
- **Live runs & history** — streaming output on every node, a console, and the last 200 runs replayable in full
- **i18n** — English + 中文, switchable at runtime
- **Zero backend** — everything in `localStorage` + IndexedDB; ship it as static files

## Quickstart

```bash
npm install
npm run dev          # opens http://127.0.0.1:5173/
```

Then:

1. **Settings** → paste an API key (OpenRouter is an easy start) → **Test connection**.
2. **Templates** → load **Product Trio**, or drag nodes from the left palette.
3. Click an **AI Worker** → pick a model and edit its `soul.md`.
4. Fill the **Task Entry** node's input → **Run**.

New here? Start with the [User Guide](./docs/user-guide.md).

## Build & deploy

```bash
npm run build        # outputs static assets to dist/
```

`dist/` is a static SPA (no client-side router, so no rewrite rules needed):

- **Vercel / Cloudflare Pages / GitHub Pages** — deploy `dist/` as static assets
- **Nginx / Caddy** — serve `dist/` as the web root
- **Remote (e.g. Tailscale)** — serve over your tailnet IP; storage works anywhere since it's IndexedDB

## Documentation

| Doc | What's inside |
|---|---|
| [User Guide](./docs/user-guide.md) | Day-to-day usage: nodes, edges, tools, running, deployment, FAQ |
| [Templates & Data Model](./docs/templates.md) | Workflow JSON, building/importing templates, full node/edge/tool reference |
| [MCP Guide](./docs/mcp.md) | Connect and write your own MCP tool servers |

## Tech stack

React + TypeScript · Vite · React Flow (canvas) · Zustand (state) · Dexie/IndexedDB (storage) · Monaco (editor) · i18next.

```
src/
├── canvas/      React Flow canvas + nodes + edges
├── panels/      Inspector, top bar, console, dialogs
├── engine/      DAG scheduling, group-chat loop, agent runner, variable interpolation
├── providers/   Anthropic / OpenAI / OpenRouter / Ollama / LM Studio adapters
├── rag/         local chunking + retrieval
├── storage/     IndexedDB (Dexie) + import/export
├── state/       Zustand stores
├── templates/   built-in souls & workflow templates
├── i18n/        en / zh resources
├── fs/          per-workflow shared folder (IndexedDB)
└── lib/         utilities
```

## Security

API keys are stored in plaintext in your browser's `localStorage`, and every request goes directly from the browser to the model provider. **Use this only on your own device** — never on a shared or public machine. Two more things that run with your trust: **Import from TS** executes pasted code in the browser, and any **MCP server** you connect can do whatever its tools allow. Master-password encryption (Web Crypto + PBKDF2 + AES-GCM) is on the roadmap.

## Roadmap

- Master-password encryption for API keys
- Node search
- Large-graph virtualization
- Optional sync backend (multi-device)
- Cancel in-flight requests in group-chat race mode
- A real summarizing agent bound to the Aggregator `summarize` strategy

## License

Not yet licensed — add a `LICENSE` before any public release.
