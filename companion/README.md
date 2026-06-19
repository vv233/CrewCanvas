# CrewCanvas Companion

A small **local MCP server** that gives CrewCanvas agents the real-OS abilities a
browser can't have — writing real files, generating `.pptx` decks, and
(opt-in) running shell commands — all confined to a single workspace directory.

CrewCanvas already speaks MCP (Streamable HTTP), so the companion plugs in with
no changes to the web app: you start it locally and paste its URL + token into
**Settings → MCP**.

## Run

```bash
cd companion
npm install
node server.mjs --workspace ~/projects/my-deck
```

It prints something like:

```
CrewCanvas Companion running
  Workspace : /home/you/projects/my-deck
  URL       : http://127.0.0.1:8787/mcp
  Token     : 1a2b3c…
  Exec      : disabled
```

Add that **URL** and **Token** as a local MCP server in CrewCanvas. Any
tool-capable agent can then call `write_file`, `read_file`, `list_dir`, and
`make_pptx`.

### Options

| Flag | Default | Meaning |
|------|---------|---------|
| `--workspace <dir>` | current dir | Directory all file ops are confined to |
| `--port <n>` | `8787` | Port to listen on (127.0.0.1 only) |
| `--token <str>` | random | Bearer token required on every request |
| `--allow-exec` | off | Also expose `run_command` (runs shell in the workspace) |

## Tools

- **write_file** `{ path, content }` — write a text file (creates parent dirs)
- **read_file** `{ path }` — read a text file
- **list_dir** `{ path? }` — list a directory
- **make_pptx** `{ filename, slides: [{ title?, bullets?: string[], body? }] }` — generate a `.pptx`
- **run_command** `{ command, timeout_ms? }` — *only with `--allow-exec`* — run a shell command in the workspace

## Windows installer

A one-click installer (no Node prerequisite for end users) is built with
[Inno Setup](https://jrsoftware.org/isinfo.php) from [`windows/installer.iss`](windows/installer.iss):

```powershell
cd companion
npm install                              # populate node_modules (pptxgenjs)
# (recommended) drop a portable Windows Node into companion\windows\node\
#   so the installer is fully self-contained; otherwise it uses a Node on PATH.
ISCC windows\installer.iss               # Inno Setup 6+; emits crewcanvas-companion-setup.exe
```

The installer drops the companion under Program Files, adds a Start-Menu (and
optional desktop) shortcut, and a launcher (`run-companion.bat`) that starts the
server against `%USERPROFILE%\CrewCanvasWorkspace`. On first run the console
prints the URL + token to paste into CrewCanvas.

> The installer must be compiled on Windows (or via Windows CI) — the Inno Setup
> compiler and the bundled Node binary are Windows-native.

## Security

This process acts on the real filesystem on behalf of a web page. It is designed
to be low-risk by default, but you are trusting it with the workspace:

- Binds to **127.0.0.1 only** — not reachable from the network.
- Requires a **bearer token** (printed at startup) on every request.
- All file paths are **resolved against and confined to the workspace**; escapes are rejected.
- `run_command` is **disabled unless** you pass `--allow-exec`.

Only point it at a directory you trust the workflow with, keep the token
private, and enable `--allow-exec` only when you need it.
