# Finance MCP server

给 AI Org Flow 的 agent 提供金融市场数据工具。本机跑一个 HTTP MCP server，浏览器
里的 agent 通过 local MCP transport 直连。

## 7 个工具

| 工具 | 作用 |
|---|---|
| `get_quote(ticker, date?)` | OHLCV 报价 + 涨跌幅 |
| `get_history(ticker, days)` | 最近 N 个交易日 K 线 |
| `get_financials(ticker)` | PE/PB/PS/利润率/增长率/ROE 等 22 项 |
| `get_company_info(ticker)` | 公司业务概况、行业、员工数 |
| `get_news(ticker, limit)` | 最近相关新闻 |
| `get_recommendations(ticker)` | 分析师评级分布（4 个季度） |
| `get_technical(ticker, indicators?)` | SMA / EMA / RSI / MACD / Bollinger / 成交量 |

数据来源：**yfinance**（免费、无 key、覆盖 NYSE/NASDAQ + 主要海外市场）。

---

## 启动

### 方法 1：uv（推荐，最快）

```bash
cd tools/finance-mcp
uv sync          # 第一次
uv run server.py
```

### 方法 2：pip + venv

```bash
cd tools/finance-mcp
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python server.py
```

启动后输出：
```
Finance MCP server starting on http://127.0.0.1:8000/mcp
```

---

## 配置环境变量

| 变量 | 默认 | 说明 |
|---|---|---|
| `FINANCE_MCP_HOST` | `127.0.0.1` | 监听地址（远程访问用 `0.0.0.0`） |
| `FINANCE_MCP_PORT` | `8000` | 端口 |
| `FINANCE_MCP_ORIGIN` | `*` | CORS 允许的源（生产用 `https://your-app.example`） |

例：远程服务器跑给 Tailscale 内浏览器用：
```bash
FINANCE_MCP_HOST=0.0.0.0 \
FINANCE_MCP_ORIGIN=http://100.76.177.105:5173 \
uv run server.py
```

---

## 接到 AI Org Flow

1. 打开 AI Org Flow
2. 选中任意 agent 节点 → 右侧 inspector → **MCP 工具** → 点 `+`
3. 填：
   - **Transport**: `local`
   - **Name**: `finance`
   - **URL**: `http://localhost:8000/mcp`（或 Tailscale IP）
4. 保存。运行工作流时该 agent 会看到 `finance__get_quote` 等 7 个工具

工具名会自动加 `finance__` 前缀避免与其他 MCP server 撞名。

---

## 测试 server 是否正常

```bash
# 检查端口
curl -i http://localhost:8000/mcp

# 用 MCP inspector（npx 工具）
npx @modelcontextprotocol/inspector http://localhost:8000/mcp
```

或者直接发一个 JSON-RPC 初始化请求：
```bash
curl -X POST http://localhost:8000/mcp \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-03-26","capabilities":{},"clientInfo":{"name":"curl","version":"0"}}}'
```

应该返回 200 + server 能力描述。

---

## 用法演示（让 agent 试试）

在 trigger 节点输入：
```
请用 finance__get_quote、finance__get_financials、finance__get_technical
分析 AAPL 当前状态。给出 1-2 段结论 + 看多/看空信号。
```

接一个 agent（Anthropic / OpenAI / OpenRouter / LM Studio 任一支持 tool calling
的 provider），inspector 里已经配好上面的 MCP server。运行后能看到：

```
🔧 [finance__get_quote] 调用中…
  参数: {"ticker":"AAPL"}
↩️ 工具结果：{"ticker":"AAPL","date":"2026-05-19","open":...

🔧 [finance__get_financials] 调用中…
↩️ 工具结果：{"pe_trailing":29.5,...

🔧 [finance__get_technical] 调用中…
↩️ 工具结果：{"sma50":{"value":182.3,...

基于以上数据，AAPL 当前处于…
```

---

## 已知限制

- yfinance 没有 social sentiment / Reddit 数据；想接需要单独写工具
- 数据可能延迟 15 分钟（Yahoo Finance 实时数据需要付费 feed）
- 不能下单（这就是个数据源，不是 broker）。要纸面交易接 Alpaca 另写 MCP
- 中概股 / A 股需要带 `.HK` / `.SS` / `.SZ` 后缀（如 `BABA`、`600519.SS`、`0700.HK`）
- 太频繁请求会被 Yahoo 限速。一次工作流跑 5-10 个工具调用没问题，做 backtest
  循环 100 天最好加 sleep / 缓存

---

## 排错

| 现象 | 原因 |
|---|---|
| 浏览器 console: `CORS error` | `FINANCE_MCP_ORIGIN` 没设对，或没暴露 `Mcp-Session-Id` header（本 server 默认已设） |
| `Module not found: mcp` | 没装依赖 / 没激活虚拟环境 |
| 工具返回 `{"error":"无 ... 数据"}` | ticker 拼错、市场休市、yfinance 暂时拿不到 |
| Agent 不调用工具 | provider 不支持 tools（Ollama）；或在 soul.md 里没提工具存在 |
