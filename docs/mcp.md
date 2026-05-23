# MCP 连接指南

[MCP（Model Context Protocol）](https://modelcontextprotocol.io) 是 Anthropic 推
出的标准协议，把外部工具/数据暴露给 LLM。AI Org Flow 里**每个 agent 节点**都能
挂任意数量的 MCP server，让模型自主调用工具（查行情、写文件、查向量库等）。

本文覆盖：
1. 怎么把现有 MCP server 接到 agent
2. 两种 transport（local / remote）的区别
3. 调试常见错误（CORS / DNS rebinding / Host 头）
4. 内置 4 个 MCP server 的接入清单
5. 自己写 MCP server 的最短路径

---

## 1. 快速接入（5 步）

1. 启动你的 MCP server，记下 URL（如 `http://127.0.0.1:8000/mcp`）
2. AI Org Flow 选中任一 **agent** 节点
3. 右侧 inspector 滚到底，找到「MCP 工具」区块
4. 点 `+` 添加：
   - **Transport**: `local`（绝大多数情况选这个）
   - **Name**: 随便起名，会作为工具命名空间前缀（如 `finance` → 工具名变成 `finance__get_quote`）
   - **URL**: MCP server 的端点
   - **Authorization token**: 可选，当作 `Bearer` 头传给 server
   - **允许的工具**: 留空 = 全部启用；填了 `tool_a,tool_b` 就只启用列出的
5. 展开 entry，点底部「**测试连接**」按钮——应该看到绿色 ✓ 加工具数。失败会
   显示具体错误（CORS / 超时 / 鉴权失败 / Host 头）

之后跑工作流时，该 agent 就能在思考循环里调用这些工具，节点输出会实时显示：

```
🔧 [finance__get_quote] 调用中…
  参数: {"ticker":"AAPL"}
↩️ 工具结果：{"ticker":"AAPL","date":"...","open":..., ...}
```

---

## 2. Transport: local vs remote

| | **local** | **remote** |
|---|---|---|
| 谁去连 MCP server | **你的浏览器** | **Anthropic API 服务器** |
| 适用 provider | OpenAI / OpenRouter / LM Studio / Anthropic | **仅 Anthropic** |
| MCP server URL 要求 | 浏览器可达（含 localhost / Tailscale / LAN） | **必须公网可达** |
| 需要 CORS | ✅ 必须开 CORS 允许本站源 | ❌（请求不从浏览器发） |
| 怎么测 | 点 inspector 的「测试连接」端到端验证 | 浏览器侧没法测，得真跑工作流让 Anthropic 试连 |
| 工具调用循环在哪 | 浏览器侧（`runAgent` 跑） | Anthropic 服务器侧（一次请求完成） |
| 计费 | 只算 LLM token | 算 LLM token + Anthropic MCP 调用费 |
| 安全 | 工具结果只回浏览器 | 工具结果经过 Anthropic 中转 |

**实际怎么选**：
- 用 OpenAI / OpenRouter / LM Studio？→ **必须 local**
- 用 Anthropic + MCP server 在你局域网/本机？→ **local**（更快，调试容易）
- 用 Anthropic + MCP server 已经公网部署？→ remote 或 local 都行；remote 省一次浏览器中转
- 想给 Claude 用一个第三方公开的 MCP server（如官方 Sentry/Asana connectors）？→ **remote**

---

## 3. 常见错误

### 3.1 `NetworkError when attempting to fetch resource`

**原因**：URL 不可达。

诊断顺序：
1. 看 URL 的 host 浏览器视角是什么——`http://127.0.0.1:8000` 里 `127.0.0.1`
   等于**浏览器所在机器**。如果浏览器在笔记本、MCP server 在远程，这地址连不上
2. 用 `curl -i <URL>` 在浏览器所在机器试一下；不通就是网络/端口问题
3. 服务器防火墙：`sudo ufw allow in on tailscale0 to any port 8000:8003 proto tcp`
4. MCP server 监听 `127.0.0.1`（默认）→ 远程访问不了；改成 `0.0.0.0`：
   ```bash
   FINANCE_MCP_HOST=0.0.0.0 ./.venv/bin/python server.py
   ```

### 3.2 `MCP initialize HTTP 421: Invalid Host header`

**原因**：MCP Python SDK v1.6+ 自动开了 **DNS rebinding 防护**，只接受
`Host: 127.0.0.1` / `localhost` / `[::1]`。从其他 host 头进来的请求（如
Tailscale IP）直接 421。

**修法**：构造 `FastMCP` 时显式关闭：

```python
from mcp.server.fastmcp import FastMCP
from mcp.server.transport_security import TransportSecuritySettings

mcp = FastMCP(
    "my-server",
    transport_security=TransportSecuritySettings(
        enable_dns_rebinding_protection=False
    ),
)
```

CORS 已经能挡 DNS rebinding 攻击，所以关掉这个防护是安全的。本仓库 4 个 server
（finance / social / broker / chroma）都已默认关掉。

### 3.3 `CORS error` / 浏览器 console 红色

**原因**：MCP server 没正确设 CORS 头。

修法（Python + starlette）：

```python
from starlette.middleware.cors import CORSMiddleware

app = mcp.streamable_http_app()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 或具体 origin 如 "http://100.76.177.105:5173"
    allow_methods=["GET", "POST", "DELETE", "OPTIONS"],
    allow_headers=["*"],
    expose_headers=["Mcp-Session-Id"],   # ⚠ 必须 expose 这个
    allow_credentials=False,
)
```

**`Mcp-Session-Id` 必须 expose**——浏览器拿不到这个头时第二个 JSON-RPC 请求会
失败，因为 client 无法把 session id 带回。这是最常被踩的坑。

### 3.4 Test 按钮显示「remote 模式由 Anthropic 服务器连，浏览器测不了」

**原因**：transport 选了 remote。浏览器跨域调 anthropic.com 必然被 CORS 拒，所以
remote 模式没法在前端做端到端测试。

**修法**：把 transport 切到 local 测，或直接运行一个最小工作流让 Anthropic 试连。

### 3.5 工具在 `tools/list` 里有，但 agent 从来不调

**原因**：
1. Provider 不支持 tool calling — Ollama 当前不支持；换 OpenAI/Anthropic/OpenRouter/LM Studio
2. 模型太弱不会主动调 — `gpt-oss-120b:free` 之类小模型对工具用得少；换 `claude-sonnet-4` / `gpt-4o`
3. soul.md 没提到工具 — 在 agent 的 soul 里明确说"做 X 时请用 yyy 工具"

### 3.6 节点显示 `unknown tool: xxx`

**原因**：模型尝试调一个我们没注册的工具。可能：
- MCP server 列表里没有这个工具
- 命名空间不对：`finance` MCP 的 `get_quote` 实际工具名是 `finance__get_quote`（注意双下划线），但模型有时把命名空间忘了

通常无害，模型下一轮会自我修正。

### 3.7 `Authorization header` 不工作

如果你的 MCP server 期望特定鉴权格式而不是 `Bearer <token>`，需要在 server 端解析。我们 client 端固定发送 `Authorization: Bearer <token>`。

---

## 4. 内置 4 个 MCP server 速查

仓库里 `tools/` 下都有：

| Server | 默认端口 | 工具数 | 数据源 | 详细文档 |
|---|---|---|---|---|
| **finance-mcp** | 8000 | 7 | yfinance（无 key） | `tools/finance-mcp/README.md` |
| **social-mcp** | 8001 | 3 | Reddit JSON API（无 key） | `tools/social-mcp/README.md` |
| **broker-mcp** | 8002 | 7 | Alpaca paper trading（需 paper key） | `tools/broker-mcp/README.md` |
| **chroma-mcp** | 8003 | 6 | ChromaDB（本地持久化） | `tools/chroma-mcp/README.md` |

### 启动模板

每个 server 独立的 venv 和命令：

```bash
# 本机访问（默认）
cd tools/<name> && ./.venv/bin/python server.py

# 远程访问（浏览器在另一台机器，比如 Tailscale 过来）
cd tools/<name> && \
  <NAME>_MCP_HOST=0.0.0.0 \
  <NAME>_MCP_ORIGIN=http://100.76.177.105:5173 \
  ./.venv/bin/python server.py
```

环境变量统一规律：`<NAME>_MCP_HOST` / `<NAME>_MCP_PORT` / `<NAME>_MCP_ORIGIN`。

### Agent 接 4 个 MCP 的推荐配置

| Agent 职责 | 该接哪些 |
|---|---|
| 基金经理 / PM | broker（看持仓）|
| 综合分析师 | finance + social |
| 交易员 | finance + broker |
| 复盘官 | finance |
| 研究员（要查公司文档） | chroma + finance |
| 知识管理员 | chroma |

详见 `docs/user-guide.md` 的 "每个人装哪个 MCP" 一节。

### 模板自动配 MCP

「每日交易（带 memory）」和「交易复盘」模板里**已经预填好** MCP URL，加载模板时
URL 自动用 `window.location.hostname`（你访问 AI Org Flow 用什么 host，MCP 就用
同一个 host）。所以：
- 本机访问 `localhost:5173` → MCP 也用 `localhost:8000` 等
- Tailscale 访问 `100.76.177.105:5173` → MCP 用 `100.76.177.105:8000` 等

不用手动改 URL，但 MCP server 必须监听对应 host（见上面"远程访问"那条）。

---

## 5. 自己写 MCP server（最短路径）

最快 ~50 行 Python 就能搭一个能用的 MCP server。

### 5.1 模板

```python
# my_server.py
import os
import sys
import uvicorn
from mcp.server.fastmcp import FastMCP
from mcp.server.transport_security import TransportSecuritySettings
from starlette.middleware.cors import CORSMiddleware

mcp = FastMCP(
    "my-tools",
    transport_security=TransportSecuritySettings(
        enable_dns_rebinding_protection=False
    ),
)


@mcp.tool()
def say_hello(name: str) -> str:
    """对某人打招呼。

    Args:
        name: 名字
    """
    return f"你好 {name}!"


@mcp.tool()
def add(a: float, b: float) -> dict:
    """加两个数。"""
    return {"a": a, "b": b, "sum": a + b}


def make_app():
    app = mcp.streamable_http_app()
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_methods=["GET", "POST", "DELETE", "OPTIONS"],
        allow_headers=["*"],
        expose_headers=["Mcp-Session-Id"],
    )
    return app


if __name__ == "__main__":
    host = os.environ.get("MY_MCP_HOST", "127.0.0.1")
    port = int(os.environ.get("MY_MCP_PORT", "8888"))
    print(f"My MCP starting on http://{host}:{port}/mcp", file=sys.stderr)
    uvicorn.run(make_app(), host=host, port=port)
```

依赖：

```bash
pip install 'mcp[cli]>=1.2' 'uvicorn[standard]>=0.30' starlette
```

跑：

```bash
python my_server.py
```

### 5.2 接到 AI Org Flow

- Inspector → MCP 工具 → 添加
- Transport: `local`
- Name: `my`
- URL: `http://127.0.0.1:8888/mcp`
- 点「测试连接」→ ✓ 2（say_hello + add）

### 5.3 工具 schema 自动从类型推导

`FastMCP` 看你 Python 函数签名自动生成 JSON Schema：
- 参数类型 `str` → `{"type": "string"}`
- 参数类型 `int` / `float` → `{"type": "number"}`
- 参数类型 `bool` → `{"type": "boolean"}`
- 参数类型 `list[str]` → `{"type": "array", "items": {"type": "string"}}`
- 参数类型 `dict[str, Any]` → `{"type": "object"}`
- 默认值 → optional；无默认 → required
- Docstring 的 `Args:` 块自动解析成各参数 description

返回值随便 — 自动 JSON.dumps；返回 dict 最清晰。

### 5.4 给工具加 Auth

如果工具需要鉴权 token（比如调外部 API），让用户在 inspector 的「Authorization token」里填，client 会作为 `Authorization: Bearer <token>` 发过来。你的 server 可以在 ASGI middleware 里读 header：

```python
async def auth_middleware(scope, receive, send):
    headers = dict(scope.get("headers", []))
    auth = headers.get(b"authorization", b"").decode()
    if not auth.startswith("Bearer "):
        # reject
        ...
```

实际项目里推荐用 `starlette.middleware.authentication` 标准模式。

### 5.5 命名空间冲突

每个 MCP server 在 client 那边会被加上前缀 `<server_name>__<tool_name>`。所以你的 `say_hello` 工具实际给模型看到的是 `my__say_hello`。

如果两个 MCP server 都有 `get_status` 工具，client 端按 `name` 字段（你在 inspector 填的）隔开命名空间——不会真撞名。

### 5.6 多个工具调用 / 大返回

- 工具可以是 async 函数（`async def` + `await`），调用并发的网络请求时用
- 返回值会被 JSON 序列化 → 大对象注意限长；ChromaDB 我们手动限制 query 返回 top-N
- 工具失败用 raise Exception 即可，client 会收到 `tool_error` 并报告给模型

### 5.7 调试

不通时用：

```bash
# 端到端 smoke test
curl -i http://127.0.0.1:8888/mcp \
  -X POST \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize",
       "params":{"protocolVersion":"2025-03-26","capabilities":{"tools":{}},
                 "clientInfo":{"name":"curl","version":"0"}}}'

# 或用官方 inspector
npx @modelcontextprotocol/inspector http://127.0.0.1:8888/mcp
```

---

## 6. 高级：remote MCP 给 Anthropic 用

如果你要让 Anthropic API 直接调你的 MCP server（节省一次中转）：

1. 把 MCP server 部署到**公网可达**的地址（不能是 localhost / 内网 IP）
2. 用 HTTPS（Anthropic 要求 https）
3. Agent inspector 添加 MCP entry，**transport = remote**
4. URL 写公网 URL，token 写鉴权 token（如果有）
5. 跑工作流验证（不能用「测试连接」，浏览器没法跨域测）

参考 [Anthropic MCP Connectors 文档](https://docs.claude.com/en/api/agent-sdk/mcp)。

---

## 7. 工具支持矩阵（每种工具源 × provider）

| | Anthropic | OpenAI | OpenRouter | LM Studio | Ollama |
|---|:---:|:---:|:---:|:---:|:---:|
| 内置 `fs_*`（工作流共享文件夹）| ✅ | ✅ | ✅ | ✅ | ❌ |
| 内置 `kb_*`（agent 私人知识库）| ✅ | ✅ | ✅ | ✅ | ❌ |
| 内置 `delegate`（manage 边自动）| ✅ | ✅ | ✅ | ✅ | ❌ |
| MCP local | ✅ | ✅ | ✅ | ✅ | ❌ |
| MCP remote | ✅ | ❌ | ❌ | ❌ | ❌ |

Ollama 当前不支持工具调用 —— 同一个 agent 换到任意其他 provider 即可。

---

## 8. 一句话总结

- **接 MCP 就两步**：MCP server 跑起来 → agent inspector 加一条 entry（URL + name）
- **远程访问就两件事要注意**：server 监听 `0.0.0.0`、CORS 设对（`Mcp-Session-Id` 要 expose）
- **写 MCP server 就一个模式**：`FastMCP` + `@mcp.tool()` + `streamable_http_app()` + CORS + uvicorn
