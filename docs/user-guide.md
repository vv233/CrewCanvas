# AI Org Flow 使用手册

> 截至 2026-05-19。覆盖所有现有功能：6 种节点（含 Discuss）、6 种连线（含 Manage）、5 家模型供应商、MCP 工具、共享文件夹、模板与 TS 导入。

---

## 目录

1. [是什么 / 适合谁](#1-是什么--适合谁)
2. [5 分钟上手](#2-5-分钟上手)
3. [配置模型供应商](#3-配置模型供应商)
4. [画布操作](#4-画布操作)
5. [节点类型详解](#5-节点类型详解)
6. [连线类型详解](#6-连线类型详解)
7. [让 AI 使用工具](#7-让-ai-使用工具)
8. [模板与分享](#8-模板与分享)
9. [运行控制与回看](#9-运行控制与回看)
10. [数据持久化](#10-数据持久化)
11. [部署](#11-部署)
12. [常见问题](#12-常见问题)
13. [安全须知](#13-安全须知)

---

## 1. 是什么 / 适合谁

**AI Org Flow** 是一个拖拽式 AI 工作流编辑器。核心比喻是「现代公司」：每个 AI 是一名员工，有自己的 `soul.md`（角色、性格、职责），员工之间通过不同的「连线」（指派、汇报、广播、管理）协作完成任务。

### 适合的场景

- 把一个复杂任务拆成多个 AI 分工协作（如 PM → 工程师 → 测试）
- 让多个 AI 在「会议室」里多轮讨论后给结论
- 用户和 AI 先共同敲定方案，再交给执行 agent 落地
- 让 manager AI 自主决定派谁、什么时候派（动态调度）
- 让 AI 集体在一个共享文件夹里读写文件协作（避免大段内容塞 prompt）
- 接外部 MCP 工具让 AI 实际操作 GitHub / 数据库 / 文件系统等

### 不适合的场景

- 海量并发 / 高吞吐生产服务（这是个浏览器单页应用）
- 对调度延迟敏感（每次都是真实 LLM API 调用）
- 完全无人值守的长跑任务（"与用户讨论"节点本来就要人交互；其他节点也可能因为 API 错误中断需要重试）

### 核心架构（30 秒理解）

```
┌─────────────────────────────────────────────────────────────┐
│ 画布（React Flow） · 控制台 · 各种侧边面板                    │
└─────────────────────────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────────────────────────┐
│ 执行引擎：DAG 调度 + Room 多轮 + 工具调用循环                  │
└─────────────────────────────────────────────────────────────┘
              ↓
┌──────────────────────────┐  ┌──────────────────────────────┐
│ 模型适配层               │  │ 存储                          │
│ Anthropic / OpenAI /     │  │ IndexedDB（工作流 / 历史）    │
│ OpenRouter / LM Studio / │  │ localStorage（设置 / API key）│
│ Ollama                   │  │ OPFS（共享文件夹）            │
└──────────────────────────┘  └──────────────────────────────┘
```

整个产品是**纯前端**：你的浏览器直接调模型 API，不需要任何后端。所有数据都存在你这台电脑的浏览器里。

---

## 2. 5 分钟上手

### 步骤

1. **打开网站**（部署后的 URL，或本地 `http://localhost:5173/`）
2. **设置 API key**：顶栏「设置」→ 选一家（推荐 Anthropic 或 OpenRouter）→ 粘贴你的 key → 点「测试连接」确认绿色 ✓
3. **加载模板**：顶栏「模板」→ 选「产品三人组（线性流）」→ 替换当前工作流
4. **看一下**：画布上有 trigger（左）→ 3 个 AI（中）→ output（右），它们由「广播」+「管道」连线连起来
5. **点 trigger 节点**，在右侧 inspector 修改任务描述（默认是个落地页工具的需求）
6. **运行**：右上角紫色「运行」按钮
7. **观察**：节点上有状态点（黄=排队，橙脉冲=运行中，绿=完成），AI 节点上实时流式输出，底部控制台显示日志
8. **看结果**：output 节点上显示综合方案
9. **回看**：顶栏「历史」可看每个节点的完整输入输出

跑通这一遍你就掌握了 80% 的用法。

---

## 3. 配置模型供应商

顶栏「设置」。所有 API key 都保存在你浏览器的 `localStorage`（**明文**，见 [安全须知](#13-安全须知)）。

### Anthropic

| 字段 | 值 |
|---|---|
| API Key | `sk-ant-...`（[这里申请](https://console.anthropic.com)） |
| Base URL | `https://api.anthropic.com/v1`（默认即可，国内可填代理） |

支持 remote MCP（让 Anthropic 服务器去连你的 MCP server，URL 必须公网可达）。

### OpenAI

| 字段 | 值 |
|---|---|
| API Key | `sk-...` |
| Base URL | `https://api.openai.com/v1`（可填 OpenAI 兼容代理） |

### OpenRouter（推荐试试）

| 字段 | 值 |
|---|---|
| API Key | `sk-or-...`（[这里申请](https://openrouter.ai)） |
| Base URL | `https://openrouter.ai/api/v1` |
| HTTP-Referer | 留空 = 自动用本站域名 |
| X-Title | 显示在 OpenRouter dashboard，默认 "AI Org Flow" |

一个 key 调用所有家模型（Claude / GPT / Gemini / Llama / DeepSeek 等），节点的「模型」字段填 `anthropic/claude-sonnet-4` 或 `openai/gpt-4o` 这种带前缀的 id。

### LM Studio（本地）

| 字段 | 值 |
|---|---|
| Base URL | `http://localhost:1234/v1`（LM Studio 默认 Local Server 端口） |
| API Key | 留空 |

如果你的浏览器跑在远程服务器（如 Tailscale 访问），要把 URL 换成笔记本能访问到的地址，**并在 LM Studio 设置里把 CORS allowed origins 加上**当前网页域名（如 `http://100.76.177.105:5173`）。

### Ollama（本地）

| 字段 | 值 |
|---|---|
| Base URL | `http://localhost:11434` |

启动时设置：
```bash
OLLAMA_HOST=0.0.0.0:11434 OLLAMA_ORIGINS='*' ollama serve
```

> ⚠️ Ollama 目前**不支持工具调用**——使用 Ollama 的 agent 不会获得 `fs_*` / `delegate` / MCP 工具。

### 「测试连接」

每个供应商区块右上角的按钮，点一下会做最简请求验证 key / 网络。绿色 ✓ = 通；红色 = 看错误信息（一般是 key 错、URL 写错、CORS 没开、网络不通）。

---

## 4. 画布操作

### 拖出节点

左侧抽屉里 6 种节点（任务入口 / AI 员工 / 与用户讨论 / 群聊室 / 汇总 / 分流 / 输出），按住拖到画布上。

### 连线

每个节点左侧有「输入端口」（蓝点），右侧有「输出端口」。从一个节点的右点**拖到**另一个节点的左点 → 创建一条连线（默认是「管道」类型）。

### 改连线类型

**点选连线** → 右侧 inspector 出现 6 种类型的单选（管道 / 指派 / 管理 / 汇报 / 广播 / 话题），点击切换。可以填可选的「标签」和「输出变换」（模板字符串包装上游输出，如 `请评审：{{output}}`）。

### 删除

- **删节点**：选中后右侧 inspector 底部红色「删除节点」按钮；或键盘 Delete / Backspace
- **删连线**：同上
- 删 Room 节点会**连带删除所有成员**

### 撤销 / 重做

`Ctrl/Cmd+Z` 撤销，`Ctrl/Cmd+Shift+Z` 重做。最多 50 步。撤销只覆盖**结构变化**（增删节点 / 连线 / 父子关系），不覆盖 inspector 里的字段输入（避免每次按键都被撤回）。

### 缩放 / 平移

- 鼠标滚轮 = 缩放
- 拖空白处 = 平移
- 左下角控件可以缩放、自适应、锁定
- 右下角小地图可以快速跳转

### 把 AI 节点放进 Room

把 AI 节点拖到 Room 节点上方放手 → 自动成为 Room 的「成员」。拖出去 → 自动脱离 Room。Room 内部成员的坐标是相对 Room 的。

### 工作流命名

顶栏左侧那行可编辑的工作流名字，直接点上去改。

---

## 5. 节点类型详解

### 5.1 任务入口（trigger）

工作流起点。inspector 里写一段任务描述，运行时这段文字会作为 `{{input}}` 传给下游。

只有「输出端口」（右），没有输入。

### 5.2 AI 员工（agent）

最常用的节点。一个 AI 角色，有 `soul.md`（system prompt）、模型、参数。

**inspector 字段**：
- **头像**：emoji（占 1-2 字符宽）
- **名字**：显示在节点上、Manager 通过 `delegate(name=...)` 引用时也用这个
- **供应商 / 模型**：5 家可选；模型用 datalist 既能从下拉选也能自定义输入
- **Temperature / Max tokens**
- **记忆**：`session` = 本次运行内累积上下文；`none` = 每次清空
- **soul.md**：Monaco 编辑器，支持顶部「从模板填充」一键选 7 种内置角色
- **MCP 工具**：见 [第 7 节](#7-让-ai-使用工具)

**soul.md 可用变量**：

| 变量 | 解析 |
|---|---|
| `{{input}}` | 上游传入的内容 |
| `{{upstream.节点名}}` | 指定上游节点的输出 |
| `{{var.X}}` | 工作流变量 X |
| `{{X}}` | 兼容性 fallback，相当于 `{{var.X}}` |

### 5.3 与用户讨论（discuss）

**运行时暂停**等用户和 AI 来回对话的节点。适合「先把方案磨清楚再下派」的场景。

**节点本身是个 380px 宽的小聊天窗**——消息列表、输入框、「完成讨论」按钮全在节点上：

1. 上游数据到来后，AI 用「AI 开场提示」（默认是复述需求 + 提澄清问题）开口
2. 你在节点输入框打字回复 → 回车发送 → AI 流式回复
3. 满意时点「完成讨论」可选填一段「最终方案」，留空就用最后一条 AI 回复
4. 工作流继续，下游 agent 收到这段方案作为输入

**inspector 字段**和 agent 几乎一样，多了一个「AI 开场提示」（运行时 AI 的第一句话怎么说）。

### 5.4 群聊室（room）

容器节点，把多个 AI 放进去多轮讨论。

**3 种模式**：
- **轮询**（round-robin）：按固定顺序逐个发言
- **主持人**（moderator）：指定一个 agent 用 JSON 决定下一个发言或结束（`{"next":"姓名"}` / `{"stop":true,"summary":"..."}`）
- **抢答**（race）：每轮所有 agent 并行，先返回的进历史

**关键字段**：
- **最大轮数**：硬上限，到了就强制结束
- **每人最少发言**（仅 moderator 模式）：主持人 stop 之前每个非主持成员至少发言这么多次。**这个数字优先于主持人的判断**——主持人想早早收尾时会被引擎拒绝，让发言不够的人继续
- **主持人指令模板**：见 `defaultNodeData('room')` 的默认 prompt，里面规定主持人必须返回 JSON
- **终止关键词**：任意发言里出现就提前结束

**怎么用**：
1. 拖 Room 节点到画布
2. 把 AI 节点拖进 Room 区域（自动成为成员）
3. moderator 模式下，inspector 里从下拉选一位主持人
4. 一条普通边（pipe / assign）连进 Room → 触发讨论；一条边连出 Room → 输出最终结论

### 5.5 汇总（aggregator）

合并多个上游输出。

**4 种策略**：
- `concat`：拼接（带 `## 节点名` 标题）
- `json-merge`：每个上游解析为 JSON 后 `Object.assign`
- `pick-first`：取第一个返回
- `summarize`：跟 concat 类似（目前未绑定 agent，想真正用 AI 总结，在 aggregator 后再接一个 agent）

### 5.6 分流（router）

根据上游输出走 a / b 两条不同分支。

**2 种规则**：
- **AI 判断**（llm-judge）：当前是简化的字符串启发式（看输入开头是不是「是 / yes / 1 / a」）
- **正则**（regex）：填一个 pattern，命中走 a，否则走 b

两个出端口分别叫 handle `'a'` 和 `'b'`，连线时拖不同的出端口决定走哪边。

### 5.7 输出（output）

终点。把上游内容显示在节点上（自动换行 + 滚动），也作为运行历史里的 `finalOutput`。

一个工作流可以有**多个 output 节点**（不同分支各自输出）。

---

## 6. 连线类型详解

6 种连线决定调度行为与 AI 看到的语义：

| 类型 | 颜色 | 调度行为 | AI 看到 |
|---|---|---|---|
| **管道** `pipe` | 灰色 | 标准数据流 | 上游内容直接作为 user 消息 |
| **指派** `assign` | 橙色实线 | 同管道 | 前缀「【上级指派】」 |
| **广播** `broadcast` | 紫色 | 同管道（多端分发就是并行） | 前缀「【广播】」 |
| **汇报** `report` | 蓝色虚线 | **不构成调度依赖**（被拓扑排序忽略） | 暂时按管道处理 |
| **话题** `topic` | 浅蓝点划 | 仅 Room 内部 | — |
| **管理** `manage` | 粉色实线 | **被指向的节点不进主调度** | 见下 |

### 「管理」连线的特殊机制

`A --manage→ B` 表示 A 是 B 的上司：
- B 不会自动执行；点「运行」时 B 一开始是 idle
- A 执行时自动获得两个工具：`list_team()` 和 `delegate({name, task})`
- A 自己决定**派不派**、**派给谁**、**派什么任务**、**派几次**
- A 可以基于一次 delegate 的结果决定下一次 delegate 什么
- 如果 B 自己也有 manage 出边连到 C/D，B 被 delegate 时也获得自己的 delegate 工具，可以再往下派 — **递归**支持
- 循环保护：如果 A→B→A 调用栈出现 A 会被拒绝（返回 `(拒绝：检测到循环指派)`）
- 每次 delegate 是**独立 context**——下属看不到上司之前的对话；上司必须把背景信息塞进 task 字符串

### 怎么选连线类型

- 流水线（A 输出必然进 B）→ `pipe`
- 想强调上下级语义（AI 看到「上级指派」更服从）→ `assign`
- 一个上游推给多个并行下游 → `broadcast`（功能上等于多条 pipe，UI 更清晰）
- 想让 AI 自己决策怎么走 → `manage`
- Room 用 `topic`，外面不用
- `report` 现在功能上跟 pipe 差不多但不构成依赖，适合"事后回传"

### 「输出变换」

每条边的 inspector 里有个「输出变换」textarea，填一段模板字符串可以包装上游输出再给下游。例：

```
请评审以下方案，重点关注可执行性：

{{output}}
```

`{{output}}` 会被上游节点的实际输出替换。

---

## 7. 让 AI 使用工具

每个 agent（讨论节点也算）在调用 LLM 时可以带上一组工具。模型自主决定调用 / 不调用、调用几次。当前共有三种工具来源：

### 7.1 内置文件系统（OPFS 共享文件夹）

**自动启用**——所有支持工具调用的 agent 都获得以下 4 个工具：

| 工具 | 作用 |
|---|---|
| `fs_list({path?})` | 列出指定路径下的内容 |
| `fs_read({path})` | 读文本文件（>1MB 截断） |
| `fs_write({path, content})` | 写文本文件（覆盖，自动建中间目录） |
| `fs_delete({path})` | 删除文件 / 递归删目录 |

**每个工作流独立的文件夹**（按 workflow.id 隔离）。

**怎么管理文件**：顶栏「文件」按钮 → 弹出文件浏览器，可以预览、上传、下载、删除、新建。

**为什么有用**：让 agent 把大段方案 / 代码 / 数据**写文件**，下游 agent 用 `fs_read` 取出来。对话里只发简短状态报告。Token 省 90% 以上，且工作流之间解耦。

**怎么让 AI 主动用**：在 soul.md 里明确写：

```markdown
## 工作方式
- 长方案/代码请用 fs_write 写到 /spec.md 或 /src/*.ts
- 对话里只发"已完成 X，文件在 /xxx"
- 下游员工会用 fs_read 取
```

### 7.2 MCP 工具（你的服务器）

**MCP**（Model Context Protocol）是 Anthropic 推出的标准化协议，让模型能访问外部数据 / 操作。

在 agent inspector 的「MCP 工具」区块点 `+` 添加一个 server，配置：

| 字段 | 含义 |
|---|---|
| **Transport** | `local` = 浏览器直连 MCP server；`remote` = Anthropic 服务器代你连 |
| **Name** | 工具命名空间（如 `github`，工具会变成 `github__search_issues`） |
| **URL** | MCP server 端点 |
| **Authorization token** | 可选 Bearer token |
| **允许的工具** | 留空 = 全部启用；填了只用列出的（逗号分隔） |

#### Local（浏览器直连）

适用 **所有** provider（Anthropic / OpenAI / OpenRouter / LM Studio 都支持，Ollama 不支持）。

**关键约束**：MCP server 必须开 CORS 允许本站源（如 `http://100.76.177.105:5173`），且 `Mcp-Session-Id` header 必须 expose。例：

```ts
// Express + @modelcontextprotocol/sdk
app.use(cors({
  origin: 'http://your-site-origin',
  exposedHeaders: ['Mcp-Session-Id'],
}));
```

#### Remote（Anthropic 转发）

仅 Anthropic provider 生效。URL 必须**公网可达**（Anthropic 服务器去连）。配置见 [Anthropic MCP connectors 文档](https://docs.anthropic.com)。

### 7.3 委派工具（manage 边自动生成）

见 [第 6 节「管理」连线](#管理连线的特殊机制)。这部分工具会在 agent 有 `manage` 出边时自动出现。

### 工具支持矩阵

| Provider | 内置 fs | MCP local | MCP remote | delegate |
|---|---|---|---|---|
| Anthropic | ✅ | ✅ | ✅ | ✅ |
| OpenAI | ✅ | ✅ | ❌ | ✅ |
| OpenRouter | ✅ | ✅ | ❌ | ✅ |
| LM Studio | ✅ | ✅ | ❌ | ✅ |
| Ollama | ❌ | ❌ | ❌ | ❌ |

### 看工具调用的可视化

运行时节点输出里会嵌入：

```
🔧 [github__search_issues] 调用中…
  参数: {"query":"label:bug"}
↩️ 工具结果：[{"number":42,"title":"..."}, ...]

根据 GitHub 查询结果，目前有 7 个未关闭的 bug……
```

每次 tool call 都会被记录到 turn 里，最终也会保存到运行历史。

---

## 8. 模板与分享

### 8.1 内置工作流模板

顶栏「模板」按钮。当前 3 个：

| 模板 | 演示 |
|---|---|
| 产品三人组（线性流） | broadcast 一对多并行 |
| 辩论会议室（群聊） | Room moderator 模式 |
| 翻译 + 评审 | 串行 + transform 改写 |

点一下就替换当前工作流（会确认）。

### 8.2 导出 / 导入 JSON

- **导出**：顶栏「导出」→ 下载当前工作流（不含 API key / 运行历史 / 共享文件）
- **导入**：顶栏「导入」→ 选 JSON → 替换当前工作流

JSON 是纯文本，可以贴在 GitHub Gist / Notion / 邮件里分享。**别人导入后**仍然需要他配置自己的 API key 才能运行。

### 8.3 从 TS 代码导入

顶栏「模板」→ 右上「从 TS 导入」→ Monaco 编辑器：

- 写一段 TS / JS，`export default { id, name, description?, build() }`
- 全局可用：`nanoid`、`defaultNodeData`、`SOUL_PRESETS`、`presetAgent`
- **不要写 `import` 语句**（会被自动剥离）
- 也可以直接粘**裸的对象字面量**（系统自动 wrap）

点「编译」→ 如果成功显示绿色 ✓ → 点「加载到画布」。

详细写法、字段、约定见 [`templates.md`](./templates.md)。

⚠️ **安全提示**：编译后的 JS 会在你浏览器里执行，等价于让任意脚本读 localStorage（含 API key）。只导入你自己写的或可信来源的代码。

---

## 9. 运行控制与回看

### 9.1 运行 / 停止

- 顶栏右侧紫色「运行」开始；运行中变成红色「停止」可中止
- 中止时所有进行中的 HTTP 请求会被 abort，节点变红显示「已中止」

### 9.2 节点状态指示

每个 agent / room / discuss 节点右上有个圆点：

| 颜色 | 状态 |
|---|---|
| 灰色 | idle |
| 蓝色 | queued |
| 橙色脉冲 | running |
| 绿色 | done |
| 红色 | error |

### 9.3 流式输出

AI 节点上的 token 是**实时**流进来的。Room 节点上每轮发言会追加。Discuss 节点的消息列表自动滚到底。

### 9.4 控制台

底部一行，点击可以折叠展开。显示：

- 引擎日志（哪个节点开始、什么 prompt、token 用量、错误信息）
- 每条日志带时间戳和节点名前缀
- 「清空」按钮重置

### 9.5 历史

顶栏「历史」按钮 → 列出**所有过去的运行**（最多 200 条，自动淘汰最旧）：

- 每条显示工作流名、状态（done / error / aborted）、耗时
- 展开后可看：
  - **输入**：trigger 内容
  - **最终输出**：所有 output 节点内容
  - **各节点输出**：每个节点的完整 text + 状态

历史持久化在 IndexedDB，关浏览器再开还在。

---

## 10. 数据持久化

| 数据 | 存在哪 |
|---|---|
| 当前工作流（含所有节点/连线/变量）| `localStorage` |
| 运行历史（最近 200 条）| IndexedDB |
| API key、设置 | `localStorage` |
| 共享文件夹 | OPFS（按 workflow.id 隔离） |
| MCP token | 跟着 agent 节点存在 localStorage（在 workflow JSON 里） |

**关浏览器 / 刷新**：所有上述数据都在，下次打开还是原样。

**清掉数据**：
- 浏览器 DevTools → Application → 删 localStorage、IndexedDB、Storage（OPFS）
- 顶栏「重置」按钮：把工作流恢复成初始示例（其他数据不动）

**导出备份**：
- 工作流：顶栏「导出」JSON
- 共享文件夹：顶栏「文件」逐个下载，或写一段 JS 在 console 批量下

---

## 11. 部署

整个应用是**纯静态前端**，构建出来就是几个 JS/CSS/HTML 文件。

### 自己跑开发服务器

```bash
npm install
npm run dev    # http://localhost:5173
```

`vite.config.ts` 里设了 `host: true`，所以同网段（包括 Tailscale）都能通过 IP 访问。

### 通过 Tailscale 远程访问

如果你的开发机在远程：

1. 服务器上 `npm run dev` 起着
2. Tailscale IP 是 `100.76.177.105`，那从本地笔记本浏览器打开 `http://100.76.177.105:5173/`
3. 如果有 ufw 防火墙：`sudo ufw allow in on tailscale0 to any port 5173`
4. **本地优先 baseUrl** 的细节：用 `localhost:11434` 这种地址时，浏览器视角的 localhost 是**笔记本**而不是服务器；要用服务器上的 Ollama，填 `http://100.76.177.105:11434`

### 部署到 Vercel / Cloudflare Pages / GitHub Pages

```bash
npm run build    # 输出 dist/
```

- **Vercel**：连 GitHub repo 自动 build & deploy
- **Cloudflare Pages**：拖 `dist/` 文件夹到 dashboard
- **GitHub Pages**：把 `dist/*` 推到 `gh-pages` 分支
- **Nginx / Caddy**：把 `dist/` 配置为站点根目录

无需任何后端、任何环境变量。

### 部署到内网 Caddy 示例

```caddy
ai-flow.internal {
  root * /var/www/ai-org-flow/dist
  file_server
  try_files {path} /index.html
}
```

---

## 12. 常见问题

### Q1: 测试连接成功，运行却报错？

通常是模型 id 写错了。OpenRouter 要用 `anthropic/claude-sonnet-4` 这种格式，OpenAI 用 `gpt-4o`，Anthropic 用 `claude-sonnet-4-6`。在 agent inspector 的「模型」字段下拉里有内置候选，但也允许自定义输入。

### Q2: Room 群聊主持人很快就 stop 了

- 默认 `minTurnsPerSpeaker = 2`，即每个非主持成员至少各说 2 次主持人才能 stop。如果你设成 1 或更低，主持人可能在很少几轮就觉得够了
- 调高这个数字（如 3）让讨论更充分
- 检查 `moderatorPrompt`：默认的 prompt 强调"信息充分才能 stop"，旧版本 prompt 可能没有；从「模板」重新加载或手动改 prompt

### Q3: AI 不主动调用工具

- 确认 provider 支持工具调用（Ollama 不支持，见矩阵）
- 在 soul.md 里明确告诉它工具的存在和用法
- 试试更大的模型——小模型 tool use 能力差

### Q4: Manager 不自动 delegate

- 默认 LLM 会直接答而不调 delegate；在 manager 的 soul 里强制写"必须先用 list_team 看下属、根据任务决定派谁"
- 检查连线确实是 `manage` 类型（粉色实线），不是 pipe / assign
- 检查下属节点确实是 `agent` kind（discuss / room 不能被 delegate）

### Q5: MCP local 报 CORS 错误

浏览器 Network tab 看具体错误，一般是 server 没设 `Access-Control-Allow-Origin`。需要在你的 MCP server 上配 CORS 允许本站源，且 `Mcp-Session-Id` header 要在 `exposedHeaders` 里。

### Q6: MCP remote 报 URL 错误

remote 模式下 Anthropic 服务器去连你的 URL——localhost / Tailscale IP / 内网 IP 都不行，必须**公网可达**。要么换 local 模式，要么用 ngrok / Cloudflare Tunnel 把本地服务暴露到公网。

### Q7: TS 导入报 `Unexpected token`

通常是粘了不规范的对象字面量。系统会**自动**给裸对象字面量包 `export default`，但如果你的代码有别的语法问题（少分号、未闭合括号），sucrase 编译会报具体行号。

### Q8: 节点状态点一直橙色脉冲不动

- 看控制台是否有错误日志
- AI 响应可能确实慢（大模型 + 长 prompt 可能 30 秒+）
- 网络问题：浏览器 DevTools → Network 看 API 请求是否还在 pending
- 如果是 Discuss 节点：它在**等你输入**，不算"卡住"

### Q9: 历史里的输出乱码 / 不完整

- 流式过程中节点状态是实时更新的，运行结束写入历史时是当时的快照
- 中止的运行也会写入历史，状态是 `aborted`

### Q10: 浏览器存储满了

- 顶栏「历史」清理旧记录（200 条上限会自动淘汰最旧）
- 顶栏「文件」清理共享文件夹
- DevTools Application → Clear site data 全清

---

## 13. 安全须知

### API Key 是明文

所有 API key 保存在浏览器 `localStorage` **明文**。这意味着：

- ✅ **只在你自己的设备**上使用
- ❌ **不要**在公共电脑 / 共享 session 上输入
- ❌ **不要**在不可信的网站（如别人 fork 的部署）上输入
- ❌ **不要**把工作流 JSON 在导出后手动塞 API key 再分享

LocalStorage 能被同源任意脚本读，所以：
- 别在浏览器 console 跑别人给的代码
- 别用「从 TS 导入」加载不可信代码

### 「从 TS 导入」是有风险的

编译后的 JS 在你的浏览器里执行，等同任意脚本。它能：
- 读 localStorage（包括所有 API key）
- 发请求到任意地址
- 把数据发到攻击者控制的服务器

弹窗有黄色警告条。只导入**你自己写**的或**你信任**来源的代码。

### MCP server 信任

local 模式下浏览器会向你配的 URL 发请求。如果 MCP server 是恶意的：
- 它可以骗 AI 调用工具返回伪造结果（比如让 AI 觉得「已删除 X」其实没删）
- 它能看到你传过去的 task 描述（可能含敏感信息）
- 但**它读不到** localStorage 或你的 cookie（CORS 是单向的）

只用你信任的 MCP server。

### 共享文件夹是私有的

OPFS 是同源私有存储，其他网站读不到。但**同源里的所有脚本**都能读，所以前面那条「TS 导入 / console 别跑陌生代码」同样适用。

### Token 计费

- 跑一次工作流可能瞬间消耗几万 token（Room 多轮 + delegate 递归尤甚）
- 当前没有 token 预算 / 上限保护
- 建议先用便宜模型（haiku / 4o-mini）跑通一遍再换贵模型
- OpenRouter 控制台可以设月度额度；Anthropic / OpenAI 可以设 API key 级别上限

### 部署后的访问控制

部署到公网（如 Vercel）后**任何知道 URL 的人都能访问**。如果你不希望被陌生人用：

- 自己的 API key **不会自动暴露**给访客（key 存在每个用户自己的浏览器）
- 但访客可以配自己的 key 用你的部署——浪费你的 hosting 带宽但不直接花你的钱
- 想做访问控制就需要加一层（Cloudflare Access、basic auth、放内网等）

---

## 附录：键盘快捷键

| 快捷键 | 作用 |
|---|---|
| `Ctrl/Cmd + Z` | 撤销 |
| `Ctrl/Cmd + Shift + Z` 或 `Cmd + Y` | 重做 |
| `Delete` / `Backspace` | 删除选中的节点 / 连线 |
| 鼠标滚轮 | 缩放 |
| 拖空白处 | 平移画布 |
| 在节点的 textarea 里：Enter | 在 Discuss 节点发送消息；Shift+Enter 换行 |

---

## 附录：术语对照

| 中文 | 英文（代码里） |
|---|---|
| 任务入口 | trigger |
| AI 员工 | agent |
| 与用户讨论 | discuss |
| 群聊室 | room |
| 汇总 | aggregator |
| 分流 | router |
| 输出 | output |
| 管道 | pipe |
| 指派 | assign |
| 广播 | broadcast |
| 汇报 | report |
| 话题 | topic |
| 管理 | manage |
| 委派工具 | delegate / list_team |
| 共享文件夹 | OPFS / fs_* tools |

---

更多开发者细节（写模板代码、加新 soul 预设、贡献流程）见 [`templates.md`](./templates.md)。
