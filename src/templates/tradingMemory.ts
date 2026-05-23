/**
 * 跨 run memory 示范模板。
 *
 * 一对模板演示「让 AI 跨次运行记住、学习」的约定：
 *  1) trading-daily-with-memory:  每天/每次跑一次，做决策前先读 /memory/，
 *     决策完写新决策到 /memory/decisions.jsonl
 *  2) trading-reflect:            周期性独立运行（如每 5 个决策跑一次），
 *     reflection agent 读 decisions.jsonl + 看实际后续走势 + 把教训 append
 *     到 /memory/lessons.md
 *
 * 共享文件夹（OPFS）天然按 workflow.id 隔离，但**两个模板用同一个 workflow.id
 * 时才能共享 memory**。我们让 reflect 模板生成时与 daily 模板共用同一个 id。
 * 用户加载两个模板后，把 reflect 模板的 workflow.id 手动改成跟 daily 一致即可
 * （或直接复制 daily 的 id）。
 *
 * 更稳的做法：让 user 在 trigger 里指定一个固定的 workflow_id 字符串作为
 * memory namespace，所有 agent 用 namespace 读写。这版本采用此做法。
 */

import { nanoid } from 'nanoid';
import type { AnyNodeData, McpServerConfig, Workflow } from '../types';
import { defaultNodeData } from '../lib/nodeFactory';
import type { WorkflowTemplate } from './workflowTemplates';

/* ------------------------------------------------------------------ */
/* MCP 预填 helpers — 模板直接给 agent 配好对应的本地 MCP server     */
/* ------------------------------------------------------------------ */

const MCP_PORTS: Record<string, number> = {
  finance: 8000,
  social: 8001,
  broker: 8002,
};

function mcp(name: keyof typeof MCP_PORTS): McpServerConfig {
  // 用当前页面的 hostname 而非硬编码 127.0.0.1。这样：
  // - 本机 localhost 访问 vite → MCP URL 也用 localhost（命中本机 server）
  // - 远程（如 Tailscale IP）访问 vite → MCP URL 用同一个 IP
  //   （MCP server 必须监听 0.0.0.0 才能被远程访问）
  const host =
    typeof window !== 'undefined' && window.location?.hostname
      ? window.location.hostname
      : '127.0.0.1';
  return {
    id: nanoid(),
    enabled: true,
    name,
    url: `http://${host}:${MCP_PORTS[name]}/mcp`,
    transport: 'local',
  };
}

/* ------------------------------------------------------------------ */
/* Soul prompts —— 把 memory 约定写进 prompt                          */
/* ------------------------------------------------------------------ */

const PM_SOUL = `# 角色
你是基金经理 PM，做最终交易决策。

## 跨次记忆约定（重要！）

每次运行**先做**这三件事，按顺序：
1. fs_read('/memory/portfolio.json')
   - 不存在则视为空仓：{ "cash": 100000, "positions": {} }
   - 持仓格式：{ "AAPL": { "qty": 10, "avg_cost": 180.5 }, ... }
2. fs_read('/memory/lessons.md')
   - 累积的教训。**仔细看**，避免重复犯过的错
   - 不存在则视为空
3. fs_read('/memory/decisions.jsonl')
   - 历史决策（append-only，一行一个 JSON）。看最近 10 行
   - 不存在则视为空

把这三份信息作为你做决策的背景。

## 决策完成后必须做

1. fs_write('/memory/portfolio.json', 更新后的持仓 JSON)
2. 用 fs_read('/memory/decisions.jsonl') 拿到旧内容，再 fs_write 把**旧内容 + 新一行**写回。
   新一行 JSON 格式：
   {"date":"YYYY-MM-DD","ticker":"...","action":"buy|sell|hold","size_pct":0-100,
    "entry_price":number,"reasoning":"一段话","confidence":0-100}

## 工作流程

1. 完成上面 3 个 fs_read（必须）
2. list_team 看下属
3. 派分析师拉数据
4. 派交易员（trader）生成 trade plan
5. 综合所有信息和历史教训做最终决策
6. 写 portfolio.json 和 decisions.jsonl
7. 在对话里给一段简报（含决策 JSON + 关键依据 + 引用了哪条历史教训）

## 风格
- 严格遵守历史教训，能引用就引用
- 决策必须能追溯到具体数据
- 单笔仓位 ≤ {{var.max_position_pct}}%`;

const ANALYST_SOUL = `# 角色
你是综合分析师，负责快速给一个 ticker 做基本面 + 技术 + 情绪综合判断。

## 工作方式

1. 收到 task（含 ticker + date）后并行调用：
   - finance__get_quote, finance__get_financials, finance__get_technical
   - social__get_ticker_sentiment（如果有 social MCP）
2. 把综合分析报告 fs_write 到 /memory/reports/{date}/{ticker}.md
3. 对话里只返回 1-2 段精炼结论 + 信号强度（看多/看空/中性，强度 1-5）

## 风格
- 数据驱动，每个结论配指标
- 短，省 token`;

const TRADER_SOUL = `# 角色
你是交易员，把分析报告转成具体 trade plan。

## 工作方式

1. fs_read('/memory/portfolio.json') 拿当前持仓
2. fs_read('/memory/reports/{date}/{ticker}.md') 看分析报告
3. 产出 trade plan JSON（严格格式）：
   {"action":"buy|sell|hold","ticker":"...","size_pct":0-20,
    "entry_strategy":"market|limit","price_target":number|null,
    "stop_loss_pct":number,"thesis_summary":"一句话"}
4. 写到 /memory/trade-plans/{date}/{ticker}.json，对话里返回 JSON

## 风格
- 单笔仓位 ≤ 20%，止损 ≤ 8%
- 已经持有的 ticker 优先考虑加仓/减仓而不是反向开仓`;

const REFLECTION_SOUL = `# 角色
你是复盘官 Reflection Officer。

## 任务

定期回顾过去决策的实际表现，把教训写到 /memory/lessons.md。
人类和未来的 AI 决策者都会读这个文件，所以**写人能看懂的总结**。

## 工作流程

1. fs_read('/memory/decisions.jsonl') 拿全部历史决策
2. 取最近 N 条（task 里会告诉你 N，默认 5）
3. 对每条决策：
   - 用 finance__get_history(ticker, days=...) 拿决策日之后的实际走势
   - 算 P&L：(实际价 - entry_price) / entry_price * 100
   - 判断决策对错（buy 后涨了 = 对；buy 后跌了 = 错；hold 是中性）
4. 找模式：
   - 哪类决策反复错？（例：每次靠 RSI 单一指标 buy 都被反扑）
   - 哪类决策反复对？（例：财报前一周 hold 的胜率高）
   - 是否漏看了某种信号？（例：那次 buy 前一天就有盈利预警新闻）
5. fs_read('/memory/lessons.md') 拿现有教训，再 fs_write 把**旧内容 + 新 lesson**追加。
   新 lesson 格式：

   ## YYYY-MM-DD 复盘
   - 教训 1：...（基于哪些决策）
   - 教训 2：...
   - 建议改进：...

6. 在对话里给用户一份摘要（含本次新增教训）

## 风格
- 诚实，错了就承认
- 具体，引用决策日期和 ticker
- 行动导向：每条教训配可执行的改进建议`;

/* ------------------------------------------------------------------ */
/* Template 1: trading-daily-with-memory                              */
/* ------------------------------------------------------------------ */

const dailyWithMemory: WorkflowTemplate = {
  id: 'trading-daily-with-memory',
  name: '每日交易（带 memory）',
  description:
    '每次跑前先读 /memory/lessons.md 和历史决策，决策后写新记录。需要配 finance-mcp（推荐再配 social-mcp）。',
  build(): Workflow {
    const trig = nanoid();
    const pm = nanoid();
    const analyst = nanoid();
    const trader = nanoid();
    const out = nanoid();

    const agent = (
      name: string,
      avatar: string,
      soul: string,
      mcpServers: McpServerConfig[]
    ): AnyNodeData => ({
      ...defaultNodeData('agent'),
      name,
      avatar,
      soul,
      maxTokens: 4096,
      mcpServers,
    });

    return {
      id: nanoid(),
      name: '每日交易（带 memory）',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      variables: {
        ticker: 'AAPL',
        date: new Date().toISOString().slice(0, 10),
        max_position_pct: '20',
      },
      nodes: [
        {
          id: trig,
          type: 'trigger',
          position: { x: 40, y: 280 },
          data: {
            ...defaultNodeData('trigger'),
            name: '今日任务',
            input:
              '为 {{var.ticker}} 在 {{var.date}} 做交易决策。\n' +
              '严格遵守 memory 约定：先读 /memory/lessons.md、/memory/portfolio.json、/memory/decisions.jsonl，' +
              '决策完写 portfolio.json 和 append decisions.jsonl。',
          },
        },
        {
          id: pm,
          type: 'agent',
          position: { x: 340, y: 280 },
          // PM 只需要 broker 看 portfolio；fs_* 内置工具读 memory
          data: agent('基金经理', '🧑‍💼', PM_SOUL, [mcp('broker')]),
        },
        {
          id: analyst,
          type: 'agent',
          position: { x: 700, y: 160 },
          // 分析师拉数据：finance（行情/财报/技术）+ social（散户情绪）
          data: agent('综合分析师', '📊', ANALYST_SOUL, [mcp('finance'), mcp('social')]),
        },
        {
          id: trader,
          type: 'agent',
          position: { x: 700, y: 400 },
          // 交易员：finance 确认实时价 + broker 下单
          data: agent('交易员', '💹', TRADER_SOUL, [mcp('finance'), mcp('broker')]),
        },
        {
          id: out,
          type: 'output',
          position: { x: 1060, y: 280 },
          data: defaultNodeData('output'),
        },
      ],
      edges: [
        { id: nanoid(), source: trig, target: pm, type: 'pipe', data: { type: 'pipe' } },
        // PM 通过 manage 派活给分析师和交易员
        { id: nanoid(), source: pm, target: analyst, type: 'manage', data: { type: 'manage' } },
        { id: nanoid(), source: pm, target: trader, type: 'manage', data: { type: 'manage' } },
        { id: nanoid(), source: pm, target: out, type: 'pipe', data: { type: 'pipe' } },
      ],
    };
  },
};

/* ------------------------------------------------------------------ */
/* Template 2: trading-reflect (周期性复盘)                            */
/* ------------------------------------------------------------------ */

const reflect: WorkflowTemplate = {
  id: 'trading-reflect',
  name: '交易复盘（写 lessons.md）',
  description:
    '读 /memory/decisions.jsonl 取最近 N 个决策 → 用 finance MCP 看实际走势 → 把教训追加到 /memory/lessons.md。建议每完成 5-10 次交易跑一次。',
  build(): Workflow {
    const trig = nanoid();
    const reflector = nanoid();
    const out = nanoid();

    return {
      id: nanoid(),
      name: '交易复盘',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      variables: { lookback_count: '5' },
      nodes: [
        {
          id: trig,
          type: 'trigger',
          position: { x: 40, y: 280 },
          data: {
            ...defaultNodeData('trigger'),
            name: '复盘任务',
            input:
              '请复盘最近 {{var.lookback_count}} 个交易决策（读 /memory/decisions.jsonl 末尾）。' +
              '对每个决策用 finance__get_history 查决策日之后的实际走势，' +
              '判断对错，找模式，把新教训 append 到 /memory/lessons.md。',
          },
        },
        {
          id: reflector,
          type: 'agent',
          position: { x: 340, y: 280 },
          data: {
            ...defaultNodeData('agent'),
            name: '复盘官',
            avatar: '🔍',
            soul: REFLECTION_SOUL,
            maxTokens: 4096,
            // 复盘官需要 finance__get_history 查决策后的实际走势
            mcpServers: [mcp('finance')],
          },
        },
        {
          id: out,
          type: 'output',
          position: { x: 700, y: 280 },
          data: defaultNodeData('output'),
        },
      ],
      edges: [
        { id: nanoid(), source: trig, target: reflector, type: 'pipe', data: { type: 'pipe' } },
        { id: nanoid(), source: reflector, target: out, type: 'pipe', data: { type: 'pipe' } },
      ],
    };
  },
};

export const MEMORY_TRADING_TEMPLATES: WorkflowTemplate[] = [
  dailyWithMemory,
  reflect,
];
