# 模板开发文档

> 截至 2026-05-19。覆盖了所有现有节点类型（含 `discuss`）、连线类型（含 `manage`）、内置 fs 工具、MCP 配置。

本项目有两种"模板"：

- **Soul 模板** (`SoulPreset`)：单个 AI 角色的 `soul.md` + 头像 + 默认名字。Agent / Discuss 节点 inspector 顶部"从模板填充"下拉里能选到。
- **工作流模板** (`WorkflowTemplate`)：整个画布（节点 + 连线 + 变量）。顶栏「模板」按钮里能加载。

有三条创建路径：

| 路径 | 何时用 | 持久化 |
|---|---|---|
| 1. UI 搭好 → 导出 JSON | 一次性 / 分享给别人 | 用户的浏览器 IndexedDB |
| 2. 粘贴 TS 代码到「从 TS 导入」对话框 | 想用代码而不是 GUI 表达逻辑，但只用一次 | 加载后变成当前工作流 |
| 3. 写 TS 加进 `src/templates/*.ts` 重新 build | 想内置到产品里给所有人用 | 进代码仓库，构建时打包 |

---

## 1. 用户路径：JSON 导出 / 导入

### 导出当前工作流
顶栏 **导出** → 下载 `<工作流名>.json`。包含 `nodes` / `edges` / `variables`，**不含** API key、运行历史、MCP token、OPFS 文件。

### 导入
顶栏 **导入** → 选 JSON。会**替换**当前画布，建议先导出做备份。

### JSON 结构骨架

```json
{
  "id": "abc123",
  "name": "我的工作流",
  "createdAt": 1747641600000,
  "updatedAt": 1747641600000,
  "variables": { "sprintDays": "14" },
  "nodes": [/* see below */],
  "edges": [/* see below */]
}
```

变量在 soul.md / openingPrompt / 任何模板字符串里用 `{{var.sprintDays}}` 引用。

---

## 2. 粘贴 TS 路径：「从 TS 导入」对话框

顶栏「模板」→ 弹窗右上「从 TS 导入」→ Monaco 编辑器 → 粘代码 → 编译 → 加载到画布。

### 约定

- 用 `export default { id, name, description?, build() }` 导出
- **不写 `import` 语句**——会被自动剥离
- 可以直接用全局：`nanoid`、`defaultNodeData`、`SOUL_PRESETS`、`presetAgent`
- TS 类型注解可以写，会被剥离（sucrase 转 JS）

### 容错

如果你只粘了"裸的对象字面量"（例如从 `WORKFLOW_TEMPLATES` 数组里复制一项出来，包含末尾 `,`），系统会**自动包一层 `export default`** 并去掉末尾逗号——也就是说从已有代码复制粘贴可以直接用。

### 最小示例

```ts
export default {
  id: 'my-translator',
  name: '我的翻译模板',
  description: '一行翻译流',
  build() {
    const t = nanoid(), ag = nanoid(), o = nanoid();
    return {
      id: nanoid(),
      name: '我的翻译模板',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      variables: {},
      nodes: [
        { id: t, type: 'trigger', position: { x: 40, y: 200 },
          data: { ...defaultNodeData('trigger'), input: 'Hello world' } },
        { id: ag, type: 'agent', position: { x: 340, y: 200 },
          data: presetAgent('translator') },
        { id: o, type: 'output', position: { x: 640, y: 200 },
          data: defaultNodeData('output') },
      ],
      edges: [
        { id: nanoid(), source: t, target: ag, type: 'pipe', data: { type: 'pipe' } },
        { id: nanoid(), source: ag, target: o, type: 'pipe', data: { type: 'pipe' } },
      ],
    };
  },
};
```

### 把工作中的草稿放在哪
要在 `src/` 里保留 `.ts` 草稿但又不被 tsc 编译，用 `.draft.ts` 或 `.tpl.ts` 后缀（已在 tsconfig 里 `exclude`）。比如 `src/templates/my-team.draft.ts`。

### 安全提示

编译后的 JS 会在浏览器里执行——**只导入你自己写的或可信来源的代码**。恶意脚本能读 localStorage（包括 API key）。

---

## 3. 内置到代码：`src/templates/`

### 新增 Soul 预设

编辑 [`src/templates/soulPresets.ts`](../src/templates/soulPresets.ts)，往 `SOUL_PRESETS` 数组追加一项：

```ts
{
  id: 'data-analyst',
  name: '数据分析师小赵',
  avatar: '📊',
  soul: `# 角色
你是一位资深数据分析师。

## 工作方式
- 看到问题先问"我们用什么指标衡量它"
- 给出可执行的 SQL / Python pandas 代码片段
- 结论必须配数据来源和置信度

## 风格
数字优先，故事其次。`,
}
```

Vite HMR 立即生效。新预设会出现在 agent / discuss inspector 的「从模板填充」下拉里。

### 新增工作流模板

编辑 [`src/templates/workflowTemplates.ts`](../src/templates/workflowTemplates.ts)，往 `WORKFLOW_TEMPLATES` 数组追加一项。结构是 `{ id, name, description, build(): Workflow }`。详见下面的「完整字段速查」。

---

## 4. 节点类型速查

```ts
type NodeType =
  | 'trigger'    // 入口
  | 'agent'      // AI 员工
  | 'discuss'    // 用户讨论（运行时暂停等用户）
  | 'room'       // 群聊室
  | 'aggregator' // 汇总多个上游
  | 'router'     // 条件分支
  | 'output';    // 终点
```

### `trigger` — TriggerNodeData

```ts
{
  kind: 'trigger',
  name: '任务入口',
  input: string,   // 用户在节点里写的任务，作为 {{input}} 传下游
}
```

### `agent` — AgentNodeData

```ts
{
  kind: 'agent',
  name: string,
  avatar: string,        // emoji，例 '🧑‍💻'
  soul: string,          // Markdown，作为 system prompt
  provider: 'anthropic' | 'openai' | 'openrouter' | 'ollama' | 'lmstudio',
  model: string,         // 例 'claude-sonnet-4-6' / 'gpt-4o' / 'anthropic/claude-sonnet-4'
  temperature: number,
  maxTokens: number,
  memory: 'none' | 'session',
  mcpServers?: McpServerConfig[],  // 可选，MCP 工具
}
```

#### `McpServerConfig`

```ts
{
  id: string,
  enabled: boolean,
  name: string,                 // 给 LLM 看的工具命名空间
  url: string,                  // MCP server endpoint
  transport: 'local' | 'remote',
  // local  = 浏览器直连（需要 server 开 CORS 允许本站源）
  // remote = Anthropic 服务器去连（仅 Anthropic provider 生效，URL 必须公网可达）
  authorizationToken?: string,
  allowedTools?: string[],      // 留空 = 全部启用
}
```

### `discuss` — DiscussNodeData（与用户讨论）

运行到这里时**暂停**，让你在节点里和 AI 来回对话，点「完成讨论」后才继续往下游走。

```ts
{
  kind: 'discuss',
  name: string,
  avatar: string,
  soul: string,           // AI 讨论伙伴的人格
  provider: ProviderId,
  model: string,
  temperature: number,
  maxTokens: number,
  openingPrompt: string,  // AI 开场提示，支持 {{input}} / {{var.X}}
}
```

### `room` — RoomNodeData（群聊室）

是一个**容器节点**，内部放多个 agent 子节点。子节点要写 `parentId: room.id` + `extent: 'parent'`，position 是相对 Room 内的坐标。Room 节点本身的 `style: { width, height }` 决定容器尺寸。

```ts
{
  kind: 'room',
  name: string,
  mode: 'round-robin' | 'moderator' | 'race',
  moderatorId?: string,       // moderator 模式必填，指向 room 内某个 agent 的 id
  maxRounds: number,
  minTurnsPerSpeaker?: number, // 默认 2；主持人 stop 之前每人至少发言这么多次
  moderatorPrompt?: string,
  stopKeyword?: string,
}
```

写 Room 模板时**父节点必须在子节点之前**出现在 `nodes` 数组里（store 内部有 `sortByParent` 兜底，但显式写对更稳）。

### `aggregator` — AggregatorNodeData

```ts
{
  kind: 'aggregator',
  name: string,
  strategy: 'concat' | 'json-merge' | 'pick-first' | 'summarize',
}
```

### `router` — RouterNodeData

```ts
{
  kind: 'router',
  name: string,
  rule: 'llm-judge' | 'regex',
  pattern: string,   // regex 规则时用
}
```

Router 有两个出 handle：`'a'`（命中）和 `'b'`（fallback）。边的 `sourceHandle` 字段对应。

### `output` — OutputNodeData

```ts
{
  kind: 'output',
  name: string,
}
```

最终结果显示在画布上 & 写入 RunRecord 的 `finalOutput`。

---

## 5. 连线类型速查

```ts
type EdgeType =
  | 'pipe'       // 透传：上游输出 → 下游输入（默认）
  | 'assign'     // 同 pipe 调度行为，但 prompt 加「上级指派」标记
  | 'broadcast'  // 一对多并行（实际就是多条 pipe 的语义糖）
  | 'report'     // 反向回传——在拓扑排序时被忽略，不构成依赖
  | 'topic'      // 仅 Room 内部使用
  | 'manage';    // 团队关系：下属不进主调度，由 manager agent 用 delegate 工具按需触发
```

### 边的字段

```ts
{
  id: string,
  source: string,         // 上游节点 id
  target: string,         // 下游节点 id
  type: EdgeType,         // 在节点的边上渲染样式用
  sourceHandle?: string,  // Router 用 'a' / 'b'
  data: {
    type: EdgeType,       // 与上面同
    label?: string,       // UI 显示的文字（覆盖默认）
    transform?: string,   // 可选模板，包装上游输出；例 '请评审：{{output}}'
  }
}
```

> ⚠️ `type` 和 `data.type` 都要填且相同。`type` 决定 React Flow 用哪个 edge component 渲染，`data.type` 决定调度引擎的行为，目前两者一致。

### `manage` 边的特殊语义

被 `manage` 边指向的节点 **完全不参与主调度** —— 即使你点「运行」它一开始也是 idle 状态。它只在上游 manager agent 调用 `delegate(name, task)` 工具时才执行。Manager agent 自动获得两个内置工具：

- `list_team()` — 列出可指派的下属
- `delegate({name, task})` — 同步派一个下属，等结果返回

`delegate` 是**独立 context** —— 下属看不到 manager 之前的对话，task 字符串必须自包含。

Manager 自身可以是「主调度链」上的节点（有 pipe/assign 入边），它的下属们只通过 manage 边挂在它下面。

---

## 6. 内置工具（每个 agent 自动获得）

### 文件系统工具（按 workflow.id 隔离的 OPFS 文件夹）

| 工具 | 作用 |
|---|---|
| `fs_list({path?})` | 列出指定路径下的内容 |
| `fs_read({path})` | 读文本文件（>1MB 截断） |
| `fs_write({path, content})` | 写文本文件（覆盖，自动创建中间目录） |
| `fs_delete({path})` | 删除文件 / 递归删目录 |

写模板时**不需要**显式启用 —— agent 自动获得。要让 LLM 知道这些工具存在并主动用，在 soul.md 里提一句即可：

```markdown
## 工作方式
- 大段内容请用 fs_write 写到工作流共享文件夹（/spec.md, /code/, ...），
  然后只在对话里报告"已写入 X"。下游员工会用 fs_read 取出来。
```

### 委派工具（仅当节点有 `manage` 出边时）

`list_team` + `delegate` — 见上一节。

### 用户 MCP 工具

`agent.mcpServers` 配置的工具，名字会用 `serverName__toolName` 命名空间隔开避免撞名。

### 谁支持工具调用

| Provider | tools |
|---|---|
| Anthropic | ✅ |
| OpenAI | ✅ |
| OpenRouter | ✅ |
| LM Studio | ✅（模型得自身支持） |
| Ollama | ❌ |

Ollama 的 agent **不会看到** fs / delegate / MCP 任何工具。

---

## 7. soul.md 写法

### 可用变量

| 变量 | 解析 |
|---|---|
| `{{input}}` | 上游传入内容（多个上游会拼接） |
| `{{upstream.节点名}}` | 指定上游节点的输出 |
| `{{upstream.节点名.output}}` | 同上，显式 `.output` 写法 |
| `{{var.X}}` | 工作流变量 `X` |
| `{{X}}` | 找不到时回退到 `{{var.X}}`（兼容旧 prompt） |
| `{{room.history}}` | 群聊室历史（仅 Room 内 agent 有意义） |

### 写法经验

- **角色 + 工作方式 + 风格** 三段式最稳。每段标题加 `##`，模型更容易抓重点
- **不要写"你是全能 AI"** —— 越具体越好用
- **明确输出格式** —— 要 JSON / 表格 / mermaid / 特定 markdown 结构，直接在 soul 里写死
- **避免命令式第二人称指令**（"你需要先做 X 再做 Y"）——容易让模型把 prompt 本身当任务执行；改用第三人称描述"该角色的工作方式"
- **大段内容写文件**：在 soul 里告诉 agent 用 `fs_write` 把方案/代码写到工作流共享文件夹，对话里只发简短状态报告，省 token

---

## 8. 完整示例

### 例 A：用户讨论 + 一线员工

```ts
export default {
  id: 'discuss-then-execute',
  name: '先讨论再执行',
  description: '用户和 AI 把方案敲定后，交给执行 agent 落地',
  build() {
    const t = nanoid(), d = nanoid(), exec = nanoid(), o = nanoid();
    return {
      id: nanoid(),
      name: '先讨论再执行',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      variables: {},
      nodes: [
        {
          id: t, type: 'trigger', position: { x: 40, y: 200 },
          data: {
            ...defaultNodeData('trigger'),
            input: '我想做一个独立开发者用的落地页工具',
          },
        },
        {
          id: d, type: 'discuss', position: { x: 280, y: 160 },
          data: defaultNodeData('discuss'),
        },
        {
          id: exec, type: 'agent', position: { x: 720, y: 200 },
          data: presetAgent('engineer'),
        },
        {
          id: o, type: 'output', position: { x: 1020, y: 200 },
          data: defaultNodeData('output'),
        },
      ],
      edges: [
        { id: nanoid(), source: t, target: d, type: 'pipe', data: { type: 'pipe' } },
        { id: nanoid(), source: d, target: exec, type: 'assign',
          data: { type: 'assign', label: '请落地方案',
            transform: '请实现以下与产品经理讨论后定下的方案：\n\n{{output}}' } },
        { id: nanoid(), source: exec, target: o, type: 'pipe', data: { type: 'pipe' } },
      ],
    };
  },
};
```

### 例 B：自主组织（manage 边）

```ts
export default {
  id: 'autonomous-team',
  name: '自主 CEO 团队',
  description: 'CEO 自己决定派谁、几次。技术问题派 CTO，市场问题派 CMO',
  build() {
    const t = nanoid(), ceo = nanoid(), cto = nanoid(), cmo = nanoid(), o = nanoid();
    return {
      id: nanoid(),
      name: '自主 CEO 团队',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      variables: {},
      nodes: [
        { id: t, type: 'trigger', position: { x: 40, y: 240 },
          data: { ...defaultNodeData('trigger'),
            input: '评估"做一个 AI 编程助手"这个项目的可行性' } },
        { id: ceo, type: 'agent', position: { x: 300, y: 240 },
          data: {
            ...defaultNodeData('agent'),
            name: 'CEO',
            avatar: '🧑‍💼',
            soul: `# 角色
你是 CEO，统筹决策。

## 工作方式
- 收到任务后，先用 list_team 看下属
- 决定先派谁、需要从他那里得到什么具体信息
- 拿到结果后再决定下一步：可能继续派别人、可能再派同一个人深入某点
- 综合所有反馈后给出最终决策

## 风格
- 决策导向、不亲自做技术细节` } },
        { id: cto, type: 'agent', position: { x: 600, y: 120 },
          data: { ...defaultNodeData('agent'), name: 'CTO', avatar: '🧠',
            soul: '# 角色\n你是 CTO，负责技术可行性评估、架构、风险。' } },
        { id: cmo, type: 'agent', position: { x: 600, y: 360 },
          data: { ...defaultNodeData('agent'), name: 'CMO', avatar: '📣',
            soul: '# 角色\n你是 CMO，负责市场分析、竞品、目标用户、定价模型。' } },
        { id: o, type: 'output', position: { x: 920, y: 240 },
          data: defaultNodeData('output') },
      ],
      edges: [
        { id: nanoid(), source: t, target: ceo, type: 'pipe', data: { type: 'pipe' } },
        // 关键：manage 连线让 CTO/CMO 不进主调度，CEO 自己决定何时派
        { id: nanoid(), source: ceo, target: cto, type: 'manage', data: { type: 'manage' } },
        { id: nanoid(), source: ceo, target: cmo, type: 'manage', data: { type: 'manage' } },
        { id: nanoid(), source: ceo, target: o, type: 'pipe', data: { type: 'pipe' } },
      ],
    };
  },
};
```

跑起来你会看到 CEO 多轮 `delegate(CTO, ...)` / `delegate(CMO, ...)`，每次基于上一次的反馈调整下一次的任务描述。

### 例 C：Room 群聊（父子节点）

```ts
export default {
  id: 'debate-quick',
  name: '快速辩论',
  description: '乐观派 vs 批评家，主持人引导，6 轮内出结论',
  build() {
    const t = nanoid(), room = nanoid(),
          optimist = nanoid(), critic = nanoid(), mod = nanoid(), o = nanoid();
    return {
      id: nanoid(),
      name: '快速辩论',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      variables: {},
      nodes: [
        { id: t, type: 'trigger', position: { x: 20, y: 240 },
          data: { ...defaultNodeData('trigger'),
            input: '远程办公应该成为默认选项吗？' } },
        // Room 父节点 — 父先于子
        { id: room, type: 'room', position: { x: 280, y: 140 },
          style: { width: 380, height: 320 },
          data: {
            ...defaultNodeData('room'),
            name: '辩论室',
            mode: 'moderator',
            moderatorId: mod,
            maxRounds: 6,
            minTurnsPerSpeaker: 2,
          } },
        // 子节点：parentId + extent='parent'，position 相对 Room
        { id: optimist, type: 'agent', parentId: room, extent: 'parent',
          position: { x: 20, y: 60 }, data: presetAgent('optimist') },
        { id: critic, type: 'agent', parentId: room, extent: 'parent',
          position: { x: 20, y: 150 }, data: presetAgent('critic') },
        { id: mod, type: 'agent', parentId: room, extent: 'parent',
          position: { x: 20, y: 240 }, data: presetAgent('moderator') },
        { id: o, type: 'output', position: { x: 720, y: 240 },
          data: defaultNodeData('output') },
      ],
      edges: [
        { id: nanoid(), source: t, target: room, type: 'pipe', data: { type: 'pipe' } },
        { id: nanoid(), source: room, target: o, type: 'pipe', data: { type: 'pipe' } },
      ],
    };
  },
};
```

### 例 D：用文件系统协作

```ts
// 在 trigger 内容 + 几个 agent 的 soul 里互相约定文件路径
// agent 之间不需要直接连线传内容；用 fs_write/fs_read 解耦

soul: `# 角色
你是产品经理。

## 工作方式
1. 把需求拆成 user stories，用 fs_write 写到 /spec.md
2. 对话里只回答 "已完成需求拆解，详见 /spec.md"

下游工程师会从 /spec.md 读取。` 
```

下游 engineer 节点的 soul：

```markdown
## 工作方式
1. 第一步用 fs_read 读 /spec.md 拿到需求
2. 实现代码用 fs_write 写到 /src/*.ts
3. 对话里报告 "已实现 X、Y、Z，文件在 /src/"
```

这样**大段方案不在 prompt 里传来传去**，token 省 90% 以上，且每个 agent 看到的对话很短。

---

## 9. 内置 helper 速查

写模板时**优先复用**这些，别手抄字段：

| Helper | 功能 |
|---|---|
| `nanoid()` | 生成 id（节点、边、工作流） |
| `defaultNodeData(type)` | 该 type 的默认 data（所有必填字段都有合理默认） |
| `presetAgent(presetId)` | 用某个 `SOUL_PRESETS` 的角色作为 agent data（名字 + 头像 + soul 一并填好） |
| `SOUL_PRESETS` | 内置角色数组（产品经理 / 工程师 / 设计师 / 批评家 / 乐观派 / 翻译 / 主持人） |

在 TS 粘贴对话框里这些都是 **全局变量**，不要写 import。

---

## 10. 调试

### 常见报错

| 现象 | 通常原因 |
|---|---|
| TS 编译失败：`Unexpected token` | 粘了裸对象字面量但不规范（多了 ,;）—— autoWrap 处理 80% 的情况，剩下手动包 `export default { ... };` |
| 加载后画布是空的 | `nodes[].type` 拼错（必须是 7 种 NodeType 之一），React Flow 找不到 component 静默跳过 |
| Room 成员不显示在房间里 | 子节点没写 `parentId` 或 `extent: 'parent'`；或 Room 在 nodes 数组中排在子节点之后（要父先子后） |
| 跑到某 agent 报"工具未知" | 一般是 LLM 想调你没声明过的工具；检查 mcpServers 配置 / provider 是否支持 tools |
| `delegate(name, task)` 找不到下属 | 下属节点的 `data.name` 跟 LLM 传的 name 字段对不上；下属必须是 `agent` kind |
| 变量没替换显示成 `{{X}}` | 用 `{{var.X}}` 而不是 `{{X}}`（兼容性 fallback 仅在 vars 里实际有 X 时有效） |
| Manager 没自动调用 delegate | LLM 决定不调用工具直接答 —— 在 soul 里明确"必须先 list_team 看下属再决定" |
| 主持人模式群聊首轮就 stop | 模板里的 `moderatorPrompt` 太宽松 —— 用 `defaultNodeData('room')` 的默认 prompt，且代码层有 `minTurnsPerSpeaker` 兜底 |

### 实时调试

- 顶栏 **历史** —— 每次运行的完整 trace（每个节点的 input/output/status），最多保留 200 条
- 底部控制台 —— 流式日志（哪个节点开始、tool 调用、tokens 用量）
- 节点上的状态点（绿/黄/红）—— `idle / queued / running / done / error`
- 顶栏 **文件** —— 看 OPFS 共享文件夹的实际内容

---

## 11. 贡献到项目

1. **Soul 预设** → 改 [`src/templates/soulPresets.ts`](../src/templates/soulPresets.ts)
2. **工作流模板** → 改 [`src/templates/workflowTemplates.ts`](../src/templates/workflowTemplates.ts)
3. 跑 `npm run build` 确保无 TS 错误
4. 提 PR，附 1-2 句使用场景

或者**不写代码**：直接导出 JSON 贴在 issue 里也 OK。
