# MCP Guide

[MCP (Model Context Protocol)](https://modelcontextprotocol.io) is Anthropic's open standard for exposing external tools and data to an LLM. In AI Org Flow, **every agent node** can attach any number of MCP servers and let the model call their tools — fetch data, hit an API, query a vector store, and so on.

> AI Org Flow ships **no built-in MCP servers** — you connect your own. This guide covers connecting one, the two transports, debugging, and writing a server from scratch.

## 1. Connect a server (5 steps)

1. Start your MCP server and note its URL (e.g. `http://127.0.0.1:8888/mcp`).
2. Select an **agent** node.
3. In the Inspector, scroll to **MCP tools**.
4. Click `+` and fill in:
   - **Transport** — `local` (the usual choice).
   - **Name** — any label; becomes the tool namespace prefix (e.g. `my` → `my__say_hello`).
   - **URL** — the server endpoint.
   - **Authorization token** — optional; sent as `Bearer <token>`.
   - **Allowed tools** — empty = all; or a comma-separated allowlist.
5. Expand the entry → **Test connection**. Expect a green ✓ and a tool count. Failures show the exact cause (CORS / timeout / auth / Host header).

At run time the agent can call these tools in its reasoning loop, and the node output shows each call and result live.

## 2. Transport: local vs remote

| | **local** | **remote** |
|---|---|---|
| Who connects | **your browser** | **Anthropic's API servers** |
| Works with provider | OpenAI / OpenRouter / LM Studio / Anthropic | **Anthropic only** |
| URL requirement | reachable from your browser (localhost / LAN / Tailscale OK) | **public, HTTPS** |
| Needs CORS | ✅ must allow this site's origin | ❌ (request isn't from the browser) |
| How to test | Inspector → Test connection (end-to-end) | can't test in-browser; run a workflow |
| Tool-call loop runs | in the browser (`runAgent`) | on Anthropic's side |

**Rule of thumb:** OpenAI / OpenRouter / LM Studio → must use `local`. Anthropic with a server on your machine/LAN → `local`. Anthropic with a public server (or a third-party public connector) → `remote`.

## 3. Common errors

### `NetworkError when attempting to fetch resource`
The URL isn't reachable from the browser. `127.0.0.1` means the machine *running the browser* — if the server is elsewhere, use its real address. Verify with `curl -i <URL>`, check firewalls, and if the server binds `127.0.0.1`, rebind it to `0.0.0.0` for remote access.

### `MCP initialize HTTP 421: Invalid Host header`
The MCP Python SDK enables **DNS-rebinding protection** by default, accepting only `Host: localhost / 127.0.0.1 / [::1]`. Requests via another host (e.g. a Tailscale IP) get 421. Disable it explicitly:

```python
from mcp.server.fastmcp import FastMCP
from mcp.server.transport_security import TransportSecuritySettings

mcp = FastMCP("my-server",
  transport_security=TransportSecuritySettings(enable_dns_rebinding_protection=False))
```

CORS already mitigates rebinding for origins you control, so disabling this is safe in that setup.

### `CORS error` (red in the browser console)
The server isn't sending CORS headers. With Starlette:

```python
from starlette.middleware.cors import CORSMiddleware

app = mcp.streamable_http_app()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],   # or your specific site origin (recommended)
    allow_methods=["GET", "POST", "DELETE", "OPTIONS"],
    allow_headers=["*"],
    expose_headers=["Mcp-Session-Id"],   # ⚠ required
    allow_credentials=False,
)
```

**`Mcp-Session-Id` must be exposed** — otherwise the browser can't carry the session id into the second JSON-RPC request. This is the most common gotcha.

> ⚠️ `allow_origins=["*"]` lets *any* website call your local server. For anything with side effects, restrict the origin and require an auth token.

### "remote mode can't be tested in the browser"
Expected — `remote` is connected by Anthropic, and the browser can't cross-origin call `anthropic.com`. Switch to `local` to test, or just run a workflow.

### A tool is listed but the agent never calls it
The provider can't (Ollama), the model is too weak, or the `soul.md` doesn't mention the tool. Use a capable model and say explicitly when to use it.

### `unknown tool: xxx`
The model called something not registered — often a namespace slip (`my__get_status`, note the double underscore). Usually harmless; it self-corrects next round.

## 4. Write your own server (shortest path)

About 50 lines of Python:

```python
# my_server.py
import os, sys, uvicorn
from mcp.server.fastmcp import FastMCP
from mcp.server.transport_security import TransportSecuritySettings
from starlette.middleware.cors import CORSMiddleware

mcp = FastMCP("my-tools",
  transport_security=TransportSecuritySettings(enable_dns_rebinding_protection=False))

@mcp.tool()
def say_hello(name: str) -> str:
    """Greet someone.

    Args:
        name: the person's name
    """
    return f"Hello {name}!"

@mcp.tool()
def add(a: float, b: float) -> dict:
    """Add two numbers."""
    return {"a": a, "b": b, "sum": a + b}

def make_app():
    app = mcp.streamable_http_app()
    app.add_middleware(CORSMiddleware, allow_origins=["*"],
        allow_methods=["GET", "POST", "DELETE", "OPTIONS"],
        allow_headers=["*"], expose_headers=["Mcp-Session-Id"])
    return app

if __name__ == "__main__":
    host = os.environ.get("MY_MCP_HOST", "127.0.0.1")
    port = int(os.environ.get("MY_MCP_PORT", "8888"))
    print(f"My MCP on http://{host}:{port}/mcp", file=sys.stderr)
    uvicorn.run(make_app(), host=host, port=port)
```

Install & run:

```bash
pip install 'mcp[cli]>=1.2' 'uvicorn[standard]>=0.30' starlette
python my_server.py
```

Then connect it: Inspector → MCP tools → add, Transport `local`, URL `http://127.0.0.1:8888/mcp`, **Test connection** → ✓ 2.

**Notes**
- `FastMCP` derives the JSON Schema from your function signature; the docstring `Args:` block becomes per-parameter descriptions. Return a `dict` for the clearest output.
- Tools may be `async def`. Raise an exception to signal an error — the client reports it to the model.
- Each server's tools are namespaced `<name>__<tool>` on the client, so two servers can share a tool name without colliding.
- For auth, read the `Authorization: Bearer <token>` header in an ASGI middleware.

## 5. Remote MCP (for Anthropic)

To let the Anthropic API call your server directly: deploy it publicly over **HTTPS**, add the MCP entry with **transport = remote**, set the public URL (+ token if any), and validate by running a workflow (no in-browser test). See [Anthropic's MCP connectors docs](https://docs.claude.com/en/api/agent-sdk/mcp).

## 6. Tool support matrix

| | Anthropic | OpenAI | OpenRouter | LM Studio | Ollama |
|---|:---:|:---:|:---:|:---:|:---:|
| Built-in `fs_*` (shared folder) | ✅ | ✅ | ✅ | ✅ | ❌ |
| Built-in `kb_*` (knowledge base) | ✅ | ✅ | ✅ | ✅ | ❌ |
| Built-in `delegate` (manage edges) | ✅ | ✅ | ✅ | ✅ | ❌ |
| MCP local | ✅ | ✅ | ✅ | ✅ | ❌ |
| MCP remote | ✅ | ❌ | ❌ | ❌ | ❌ |

Ollama doesn't support tool calling — switch that agent to any other provider.

## 7. In one line

- **Connect:** start the server → add an entry (URL + name) on an agent.
- **Remote access:** bind `0.0.0.0` + correct CORS (expose `Mcp-Session-Id`).
- **Write one:** `FastMCP` + `@mcp.tool()` + `streamable_http_app()` + CORS + uvicorn.
