# Broker MCP — Alpaca paper trading

让 agent 真实下单到 Alpaca paper trading 账户（**默认强制 paper，绝不连真实账户**）。

适合：自动化 AI 投资决策的纸面验证、回测之外的"真订单生命周期"测试。

## 7 个工具

| 工具 | 作用 |
|---|---|
| `get_account()` | 现金 / buying power / 组合价值 / 当前盈亏 |
| `get_positions()` | 全部持仓列表 |
| `get_position(symbol)` | 单个 ticker 详情 |
| `place_order(symbol, qty, side, type?, limit_price?, stop_price?, time_in_force?)` | 下单（market/limit/stop/stop_limit）|
| `cancel_order(order_id)` | 撤单 |
| `list_orders(status?, limit?)` | 列出 open/closed/all 订单 |
| `get_clock()` | 市场是否开盘 + 下次开/关盘时间 |

## 申请 Paper Trading Key

1. 注册 https://alpaca.markets（免费）
2. 进 https://app.alpaca.markets/paper/dashboard/overview
3. 右侧 "API Keys" → Generate New Key
4. 复制 **Key ID** 和 **Secret**（secret 只显示一次）

Paper trading 给你 $100k 模拟资金，行情 15 分钟延迟，零成本，不会动你真实钱。

## 启动

```bash
cd tools/broker-mcp
python3 -m venv .venv
./.venv/bin/pip install -r requirements.txt

export ALPACA_API_KEY="你的 paper key id"
export ALPACA_API_SECRET="你的 paper secret"
./.venv/bin/python server.py
```

默认监听 `127.0.0.1:8002`。启动 banner 会打 `Broker MCP (paper) starting on ...`。

## 环境变量

| 变量 | 默认 | 说明 |
|---|---|---|
| `ALPACA_API_KEY` | — | **必填** |
| `ALPACA_API_SECRET` | — | **必填** |
| `BROKER_MCP_HOST` | `127.0.0.1` | 监听地址 |
| `BROKER_MCP_PORT` | `8002` | 端口 |
| `BROKER_MCP_ORIGIN` | `*` | CORS 允许的源 |
| `BROKER_MCP_ALLOW_LIVE` | `0`（禁用）| 设为 `1` 才会连真实账户。**不建议** |

## 接到 AI Org Flow

agent inspector → MCP 工具 → 添加：
- **Transport**: `local`
- **Name**: `broker`
- **URL**: `http://127.0.0.1:8002/mcp`

工具会以 `broker__place_order` 等前缀出现给 agent。

## 用法演示（交易员 agent 的 soul）

```markdown
# 角色
你是交易执行员。

## 工作方式
1. 接到上游的 trade plan（JSON：action/symbol/size_pct）后：
   - broker__get_account 拿 portfolio_value 算出 qty = size_pct * portfolio_value / price
   - broker__get_clock 确认市场开盘
   - broker__get_position(symbol) 看是否已持有
   - broker__place_order 下单
2. broker__list_orders('open') 确认订单状态
3. 写一份执行报告到 /executions/{date}.md
```

## 安全防线

- **默认 paper-only**：`paper=True` 硬编码到 SDK 客户端
- **大额订单先确认**：建议在 agent soul 里加规则"单笔 > $X 必须先回到 PM agent 让人审批"
- 想要 live 交易必须**明确**设 `BROKER_MCP_ALLOW_LIVE=1` —— 启动 banner 会打红色 "LIVE ⚠️" 提示

## 测试无 key 时的行为

如果不设 key 直接启动，server 起来后调用工具会报 `unauthorized`。可以用这种方式确认 server 至少装好了：

```bash
./.venv/bin/python server.py
# 另一窗口
curl -i http://127.0.0.1:8002/mcp
```

## 已知限制

- 只支持美股（Alpaca 没有港股/A 股）
- 不支持期权（用 Alpaca Options API 需要另写 server）
- 下单后**不会自动等成交**——agent 调 `place_order` 后立即返回订单状态，可能是 `accepted`/`new`，需要再调 `list_orders` 查
- Paper trading 行情 15 分钟延迟，下 market 单时实际成交价跟你 agent 看到的可能有偏差
