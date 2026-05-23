# 跨 run 记忆约定（trading memory）

让 AI agent **跨次运行**记住过去的决策、复盘对错、积累教训。

不需要任何新代码 —— 完全用现有的 `fs_*` 工具 + OPFS 共享文件夹实现。本文档是
**约定**：所有交易类工作流的 agent soul.md 都遵循这个文件结构，互相就能读对方
留下的状态。

---

## 目录结构

每个工作流都有独立的 OPFS 文件夹（按 workflow.id 隔离）。我们约定在根目录下：

```
/memory/
  portfolio.json        — 当前持仓 + 现金（每次决策后必更新）
  decisions.jsonl       — 历史决策日志（append-only，一行一个 JSON）
  lessons.md            — 累积教训（人类 + AI 都看）
  reports/{date}/{ticker}.md  — 当日各分析师产出的报告
  trade-plans/{date}/{ticker}.json  — 交易员产出的 trade plan
```

---

## 关键文件 schema

### `/memory/portfolio.json`

```json
{
  "cash": 95000.0,
  "positions": {
    "AAPL": { "qty": 30, "avg_cost": 182.5 },
    "NVDA": { "qty": 5,  "avg_cost": 615.2 }
  },
  "last_updated": "2026-05-20"
}
```

### `/memory/decisions.jsonl`

每行一个 JSON 对象（**Lines** 格式，append-only）：

```jsonl
{"date":"2026-05-18","ticker":"AAPL","action":"buy","size_pct":15,"entry_price":182.5,"reasoning":"...","confidence":70}
{"date":"2026-05-19","ticker":"NVDA","action":"hold","size_pct":0,"entry_price":null,"reasoning":"已持有，RSI 中性等突破","confidence":55}
```

> JSONL 比 JSON array 友好：append 不用读全文件、行级容错（一行坏不影响其他行）。

### `/memory/lessons.md`

人类可读的 Markdown，结构：

```markdown
# 累积教训

## 2026-05-15 复盘（前 5 个决策）

- **教训**：单靠 RSI 超卖 buy AAPL 失败 2 次。
  - 案例：2026-05-08 buy AAPL @ $185，3 天后 -6%（盘前发盈利预警，我们没看新闻）
  - **改进**：决策前必须 `social__get_ticker_sentiment` + `finance__get_news`，新闻强负面时即使技术超卖也 hold

- **教训**：财报前一周持仓胜率高
  - 案例：NVDA、META 财报前一周持仓收益均 > 3%
  - **改进**：维护"未来一周财报日"列表，提前一周建仓

## 2026-05-20 复盘（前 10 个决策）

...
```

---

## 两个模板（已内置）

顶栏「模板」按钮里有这俩：

### 1. 「每日交易（带 memory）」

每次运行做一次决策：
- trigger 输入 `{ticker, date}`
- PM agent：**先 read 三份 memory** → 派分析师 + 交易员 → 综合 + 写新决策
- 输出：决策 JSON + 关键依据 + 引用了哪条历史教训

需要配 finance-mcp（强烈建议再配 social-mcp）。

### 2. 「交易复盘（写 lessons.md）」

独立工作流，建议每完成 5-10 次交易跑一次：
- trigger 指定 `lookback_count`（默认 5）
- Reflection agent 读 `decisions.jsonl` 末尾 N 条 → 用 `finance__get_history`
  查决策日之后的实际走势 → 算 P&L → 找模式 → 把新 lesson append 到 `lessons.md`

---

## ⚠️ 同一 namespace 才共享 memory

OPFS 文件夹按 `workflow.id` 隔离。**两个独立工作流默认拿不到对方的 memory**。

解决方案 A：**手动同步 workflow.id**
- 加载"每日交易"模板 → 顶栏「导出」看 JSON 里的 `id`
- 加载"交易复盘"模板 → 导出 → 编辑 JSON 把 `id` 改成跟前者一样 → 重新「导入」
- 之后两个工作流就共享 `/memory/`

解决方案 B（推荐，更稳）：**只用一个工作流**
- 不分两个 workflow。把 reflection agent 也加到日常工作流里，但默认 disabled
- 每 5 次决策手动改 trigger 触发 reflection 路径

解决方案 C（终极）：**Reflection 通过 router 节点条件触发**
- 在主工作流的 PM 节点后接一个 router，规则："如果 decisions.jsonl 行数 % 5 == 0 走 reflection 分支"
- 当前 router 是简化版字符串规则，要这样做需要扩展（不在 P1 范围）

最务实：方案 A，把"每日"和"复盘"两个工作流绑同一个 id。或者直接用 fs_write
让每个 agent 都能跨工作流约定一个固定文件夹路径（但 OPFS 隔离是按 workflow.id
做的硬约束，不能跨 workflow 共享）。

---

## 各 agent 必须做的事

### PM / CEO（决策者）

**每次开始时**（在 list_team / delegate 之前）：
1. `fs_read('/memory/portfolio.json')` — 不存在视为空仓 `{"cash":100000,"positions":{}}`
2. `fs_read('/memory/lessons.md')` — 不存在视为空字符串
3. `fs_read('/memory/decisions.jsonl')` — 不存在视为空；只看末尾 10 行就够

把这三份**放在 reasoning 里参考**，决策时**显式引用**用了哪条 lesson。

**做完决策必须**：
1. `fs_write('/memory/portfolio.json', 更新后的 JSON)`
2. `fs_read('/memory/decisions.jsonl')` 拿旧内容 → `fs_write` 把"旧内容 +
   新一行 JSON + 换行"写回（**append 模式**）

### Analyst（分析师）

写报告到 `/memory/reports/{date}/{role}.md`，对话里只回报路径 + 1 段结论。
避免长报告塞 prompt。

### Trader

读 `/memory/reports/{date}/`、读 `/memory/portfolio.json`、产出 trade plan
JSON，写到 `/memory/trade-plans/{date}/{ticker}.json`。

### Reflection Officer

**只在专门的复盘工作流里出现**。读 decisions.jsonl → 用 finance MCP 验证 →
找模式 → append 到 lessons.md。

---

## 启动流程（首次）

1. 启动 finance-mcp + social-mcp（参见各自 README）
2. 在 AI Org Flow 里：
   - 顶栏「设置」→ 配 Anthropic key（推荐 sonnet-4-6）
   - 选中每个 agent → MCP 工具加上 finance / social
3. 顶栏「模板」→ 选「每日交易（带 memory）」加载
4. 改 trigger 的 `{{var.ticker}}` 和 `{{var.date}}`
5. 点「运行」—— 第一次跑时三个 fs_read 都会拿到空 / 不存在，PM 自然按"无历史"
   决策。决策完会创建 portfolio.json 和 decisions.jsonl
6. 隔几天再跑，PM 就能看到自己以前的决策和积累的 lessons
7. 跑了 5 次后，**复制 daily 模板的 workflow id**，加载「交易复盘」模板并改
   它的 workflow.id（见上一节），再跑一次复盘
8. 复盘会往 lessons.md 写新教训
9. 下次 daily 跑时 PM 就能引用新 lessons

---

## 看 memory 内容

顶栏「文件」按钮打开 OPFS 文件浏览器。能看到 `/memory/portfolio.json` 等所有
文件，能预览、下载、编辑、删除。

要"清空记忆"重新开始：删 `/memory/` 整个目录即可。

---

## 想做得更狠

- **跨多 ticker 的组合记忆**：加 `/memory/correlation.md`，让分析师写"我观察到
  AAPL 跟 NVDA 相关性"
- **失败 trade 的特征库**：让 reflection 把每个失败 trade 的特征向量 append 到
  `/memory/failed_patterns.jsonl`，PM 决策前用 fs_read 拿出来对比
- **手动注入教训**：用顶栏「文件」直接编辑 `/memory/lessons.md` 添加你自己想让
  AI 记住的规则。下次跑 PM 就会读到
