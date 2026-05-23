# Social Sentiment MCP

Reddit-based 散户情绪分析。无需任何 API key —— 用 Reddit 公开 JSON 端点。

## 3 个工具

| 工具 | 作用 |
|---|---|
| `get_reddit_mentions(ticker, subreddits?, limit?)` | 抓 ticker 在指定子板块的最近帖子，含 score / comments / 简单 bull/bear 关键词计数 |
| `get_subreddit_hot(subreddit, limit?)` | 某 sub 的热门帖（看大盘情绪用） |
| `get_ticker_sentiment(ticker, days?)` | 综合 4 个金融 sub 给出汇总情绪信号（bullish/bearish/mixed） |

## 启动

```bash
cd tools/social-mcp
python3 -m venv .venv
./.venv/bin/pip install -r requirements.txt
./.venv/bin/python server.py
```

默认监听 `127.0.0.1:8001`。

## 环境变量

| 变量 | 默认 |
|---|---|
| `SOCIAL_MCP_HOST` | `127.0.0.1` |
| `SOCIAL_MCP_PORT` | `8001` |
| `SOCIAL_MCP_ORIGIN` | `*` |
| `SOCIAL_MCP_UA` | `ai-org-flow-social-mcp/0.1 (by /u/anon)` — 建议改成你自己的 reddit username |

## 在 AI Org Flow 里接

agent inspector → MCP 工具 → 添加：
- Transport: `local`
- Name: `social`
- URL: `http://localhost:8001/mcp`

工具会以 `social__get_reddit_mentions` 等前缀出现给 agent。

## 注意

- Reddit 不需要登录就能拿数据，但**有 rate limit**（10 秒大约 60 req）。一个工作流跑下来没问题，做 backtest 高频拉数据要加缓存
- 情绪打分是**简单关键词计数**（rocket/calls/yolo → bull；puts/dump → bear），有偏差。让上层 LLM agent 自己解读才靠谱
- 没接 Twitter/X — X 现在没有合理的免费 API。如果你要可以加 nitter 或 RapidAPI
- 没接评论树（只看帖子标题 + selftext 头 400 字）。要更深的话扩展 server
