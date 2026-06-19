import type { Resources } from './en';

export const zh: Resources = {
  common: {
    cancel: '取消',
    save: '保存',
    close: '关闭',
    delete: '删除',
    create: '创建',
    confirm: '确定',
    refresh: '刷新',
    add: '添加',
    edit: '编辑',
    remove: '移除',
    loading: '加载中…',
    loadingEditor: '加载编辑器…',
    none: '(无)',
    empty: '(空)',
  },
  app: {
    noNodes: '画布上没有节点',
    runStart: '开始运行：{{name}}',
    runAborted: '用户中止运行',
  },
  topbar: {
    name: 'CrewCanvas',
    undo: '撤销 (Ctrl/Cmd+Z)',
    redo: '重做 (Ctrl/Cmd+Shift+Z)',
    templates: '模板',
    templatesTitle: '模板库',
    files: '文件',
    filesTitle: '工作流共享文件夹',
    ragLibrary: '资料库',
    ragLibraryTitle: 'RAG 资料库',
    history: '历史',
    historyTitle: '运行历史',
    import: '导入',
    importTitle: '导入工作流 JSON',
    importRoleCard: '导入角色卡',
    importRoleCardTitle: '导入角色卡 —— 可一次选多个 .json 文件（支持批量）',
    roleCardNone: '所选文件里没有找到有效的角色卡。',
    roleCardImported: '已导入 {{count}} 张角色卡为 agent 节点。',
    export: '导出',
    exportTitle: '导出工作流 JSON',
    reset: '重置',
    resetTitle: '重置',
    resetConfirm: '确定重置为初始示例工作流？当前工作将丢失。',
    settings: '设置',
    run: '运行',
    stop: '停止',
    importFailed: '导入失败：{{msg}}',
    exportFailed: '导出失败：{{msg}}',
    language: '语言',
    nodes: '节点',
    inspector: '检查器',
    target: '目标',
    targetTitle: '工作流目标',
  },
  palette: {
    heading: '节点',
    hint: '拖拽或点按添加',
    trigger: { label: '任务入口', desc: '工作流起点' },
    agent: { label: 'AI 员工', desc: '有 soul.md 的 AI 角色' },
    discuss: { label: '与用户讨论', desc: '暂停等用户和 AI 讨论方案' },
    room: { label: '群聊室', desc: '多 AI 多轮讨论' },
    aggregator: { label: '汇总', desc: '合并多个上游' },
    router: { label: '分流', desc: '按规则走不同分支' },
    output: { label: '输出', desc: '终点显示结果' },
  },
  canvas: {
    panMode: '平移画布',
    selectMode: '框选节点',
  },
  toolbar: {
    copy: '复制',
    paste: '粘贴',
    duplicate: '复制一份',
    delete: '删除',
  },
  target: {
    title: '目标',
    enabled: '运行时使用这个目标',
    nameLabel: '名称',
    namePlaceholder: '例：上线手机端可用的 CrewCanvas',
    statusLabel: '状态',
    objectiveLabel: '目标',
    objectivePlaceholder: '写下团队需要共同优化的具体目标。',
    contextLabel: '背景',
    contextPlaceholder: '用户、现状、链接、项目说明或其他上下文。',
    risksLabel: '风险 / 阻塞',
    risksPlaceholder: '已知风险、开放问题、取舍，或需要避免的事情。',
    acceptanceTitle: '验收标准',
    acceptancePlaceholder: '添加一条可衡量的验收标准',
    constraintsTitle: '约束条件',
    constraintsPlaceholder: '添加一条约束',
    checklistTitle: 'Checklist',
    checklistPlaceholder: '添加一个任务',
    progress: '已完成 {{done}}/{{total}} · {{percent}}%',
    noChecklist: '还没有 checklist',
    clear: '清空',
    clearConfirm: '确定清空这个工作流目标？',
    lastReview: '最近一次运行验收',
    noReview: '运行一次工作流后会记录目标验收摘要。',
    markDone: '标记完成',
    markOpen: '标记未完成',
    status: {
      draft: '草稿',
      active: '进行中',
      blocked: '阻塞',
      complete: '完成',
    },
    reviewSummary: '目标状态：{{status}}。Checklist 进度：{{done}}/{{total}}（{{percent}}%）。',
  },
  targetPrompt: {
    heading: '工作流目标',
    instructions:
      '这是整个工作流的主目标。所有决策、指派、总结和最终输出都应围绕它展开。如果用户请求与目标或约束冲突，请明确指出。',
    title: '目标名称',
    objective: '目标',
    status: '状态',
    context: '背景',
    acceptance: '验收标准',
    constraints: '约束条件',
    checklist: 'Checklist',
    risks: '风险和阻塞',
    userTask: '当前任务',
  },
  nodes: {
    trigger: { subtitle: '工作流入口' },
    output: { afterRun: '运行后显示结果' },
    room: {
      summary: '群聊室 · {{mode}} · 最多 {{rounds}} 轮',
      modes: { 'round-robin': '轮询', moderator: '主持人', race: '抢答' },
    },
    router: {
      summary: '分流 · {{rule}}',
      rules: { 'llm-judge': 'AI 判断', regex: '正则' },
    },
    aggregator: {
      summary: '汇总 · {{strategy}}',
      strategies: {
        concat: '拼接',
        'json-merge': 'JSON 合并',
        'pick-first': '取第一个',
        summarize: 'AI 总结',
      },
    },
    discuss: {
      subtitle: '与用户讨论',
      pauseHint: '运行到此节点时会暂停，等你和 AI 讨论',
      preparing: 'AI 正在准备开场…',
      you: '你',
      ai: 'AI',
      thinking: 'AI 思考中…',
      done: '讨论已完成，结果已传给下游',
      notRunning: '未在运行中',
      summaryPlaceholder: '可选：写一段最终方案作为下游输入。留空则用最后一条 AI 回复。',
      finish: '完成',
      replyingPlaceholder: 'AI 回复中…',
      replyPlaceholder: '回复 AI（Enter 发送，Shift+Enter 换行）',
      finishDiscussion: '完成讨论',
      send: '发送',
    },
  },
  inspector: {
    heading: '检查器',
    nodeLabel: '节点 · {{type}}',
    multiLabel: '已选中 {{count}} 个节点',
    edge: '连线',
    none: '未选中（点击节点或连线编辑）',
    hintsTitle: '提示：',
    hintDrag: '从左侧拖出节点',
    hintConnect: '拖动节点端口连线',
    hintClickEdge: '点击连线改变沟通方式',
    hintClickAgent: '点击 AI 节点编辑 soul.md',
    name: '名字',
    deleteNode: '删除节点',
    deleteEdge: '删除连线',
  },
  trace: {
    title: '本次运行',
    upstreams: '上游输入',
    noUpstreams: '（无上游输入）',
    systemPrompt: '系统提示词（实际发送）',
    userMessage: '用户消息（实际发送）',
    rag: 'RAG 检索',
    ragQuery: '查询',
    ragHit: '已注入上下文',
    ragMiss: '无命中',
    tools: '可用工具',
    toolCalls: '工具调用',
    noToolCalls: '（无工具调用）',
    args: '参数',
    result: '结果',
    error: '错误',
    trimmed: '上下文已被裁剪',
    empty: '运行一次工作流，这里会显示该节点实际收到的内容。',
  },
  bulkInspector: {
    selectedCount: '已选中 {{count}} 个节点',
    agentsCount: '其中 {{count}} 个是 AI Worker',
    sourceTitle: '批量设置模型来源',
    apply: '应用到 {{count}} 个 AI Worker',
    noAgents: '选区里没有 AI Worker —— 框选一些 agent 节点。',
    deleteSelection: '删除 {{count}} 个节点',
  },
  trigger: {
    inputLabel: '输入（任务描述）',
    inputPlaceholder: '点运行时，这段内容会作为 {{token}} 传给下游',
  },
  routerInspector: {
    ruleLabel: '分流规则',
    ruleLlmJudge: 'AI 判断（让模型选分支）',
    ruleRegex: '正则匹配',
    patternLabel: '正则 pattern',
    patternPlaceholder: '^是$',
    judgePromptLabel: '分支标准（符合 → 分支 a，否则 → 分支 b）',
    judgePromptPlaceholder: '例：输入是一个 bug 报告（而非功能请求）',
    judgeHint: '模型读取上游输出并回答 a 或 b。分支 a = 上方接口，b = 下方接口。',
  },
  aggregatorInspector: {
    strategyLabel: '汇总策略',
    concat: '拼接（直接连起来）',
    jsonMerge: 'JSON 合并',
    pickFirst: '取第一个返回',
    summarize: 'AI 总结（LLM）',
    summarizePromptLabel: '总结要求',
    summarizePromptPlaceholder: '例如：把各方观点合并成 5 条要点的执行摘要，并标出分歧',
    summarizeHint: '模型会读取所有上游输出，写成一份综合总结。调用失败时自动回退为直接拼接。',
  },
  roomInspector: {
    modeLabel: '发言模式',
    modeRoundRobin: '轮询（按顺序逐个发言）',
    modeModerator: '主持人（由主持人决定下一个）',
    modeRace: '抢答（每轮先到先发言）',
    maxRounds: '最大轮数',
    minTurns: '每人最少发言',
    moderatorLabel: '主持人（成员中选一位）',
    moderatorAuto: '（自动选第一个成员）',
    moderatorPromptLabel: '主持人指令模板',
    moderatorVars: '变量：',
    moderatorReturns: '主持人需返回 JSON：',
    or: '或',
    stopKeywordLabel: '终止关键词（任意发言包含即停）',
    stopKeywordPlaceholder: '例：【讨论结束】',
    membersTitle: '当前成员（{{count}}）',
    membersEmpty: '把 AI 节点拖到房间内即可加入',
    deleteRoom: '删除房间',
  },
  fields: {
    avatar: '头像 (emoji)',
    name: '名字',
    provider: '供应商',
    model: '模型',
    temperature: 'Temperature',
    maxTokens: 'Max tokens',
    soul: 'soul.md（AI 人格）',
  },
  providers: {
    ollamaLocal: 'Ollama (本地)',
    lmstudioLocal: 'LM Studio (本地)',
  },
  discussInspector: {
    openingLabel: 'AI 开场提示（首次发言）',
    openingHintPre: '支持',
    openingHintMid: '（上游输出）和',
    soulLabel: 'soul.md（AI 讨论伙伴的人格）',
  },
  agentInspector: {
    modelPlaceholder: '选一个或输入模型 id',
    memory: '记忆',
    memorySession: '本次运行内记忆',
    memoryNone: '无记忆（每次清空）',
    soulLabel: 'soul.md（角色/性格/职责）',
    fillFromPreset: '从模板填充…',
    presetOverwrite: '当前 soul.md 已有内容，确定用模板覆盖？',
    soulVars: '支持变量：',
    exportRoleCard: '导出角色卡',
    exportRoleCardTitle: '把该 agent 导出为可复用的角色卡（含知识库，自动去掉 MCP token）',
  },
  exportDialog: {
    title: '导出工作流',
    includeKnowledge: '包含知识库',
    includeKnowledgeDesc: '内联知识，以及每个 agent 的私有资料库文件。',
    includeSensitive: '包含敏感字段',
    includeSensitiveDesc: 'MCP server 鉴权 token。分享文件时建议不勾。',
    cancel: '取消',
    export: '导出',
  },
  importTs: {
    title: '从 TS 代码导入模板',
    securityTitle: '安全提示',
    securityBody:
      '编译后的 JS 会在你的浏览器里执行。只导入你自己写的或来自可信来源的代码——恶意脚本可以读取你的 API key（localStorage）。',
    convTitle: '约定',
    conv1: '`export default` 一个含 `{ id, name, description?, build() }` 的对象',
    conv2: '可用全局：`nanoid`、`defaultNodeData`、`SOUL_PRESETS`、`presetAgent`',
    conv3: '不能写 `import` 语句（会被剥离）',
    conv4: 'TS 类型注解会被剥离，不做类型检查',
    loadConfirm: '加载会替换当前画布上的工作流，确定吗？（可先在顶栏"导出"备份）',
    buildThrew: 'build() 抛出异常: {{msg}}',
    compileOk: '编译成功：',
    compile: '编译',
    loadToCanvas: '加载到画布',
    errUnknownPreset: '未知 soul 预设: "{{id}}"',
    errCompileFailed: 'TypeScript 编译失败: {{msg}}',
    errExecFailed: '执行失败: {{msg}}',
    errShape: '模板必须 export default 一个含 { id: string, name: string, description?: string, build(): Workflow } 的对象',
    exampleTs: `// 可用的全局变量：nanoid, defaultNodeData, SOUL_PRESETS, presetAgent
// 不能使用 import 语句

interface Foo { id: string }  // TS 类型注解可写，会被剥离

export default {
  id: 'my-translator',
  name: '我的翻译模板',
  description: '一个最简单的翻译流：trigger → translator → output',
  build() {
    const trig = nanoid();
    const ag = nanoid();
    const out = nanoid();
    return {
      id: nanoid(),
      name: '我的翻译模板',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      variables: {},
      nodes: [
        {
          id: trig,
          type: 'trigger',
          position: { x: 40, y: 200 },
          data: {
            ...defaultNodeData('trigger'),
            input: 'The quick brown fox jumps over the lazy dog.',
          },
        },
        {
          id: ag,
          type: 'agent',
          position: { x: 340, y: 200 },
          data: presetAgent('translator'),
        },
        {
          id: out,
          type: 'output',
          position: { x: 640, y: 200 },
          data: defaultNodeData('output'),
        },
      ],
      edges: [
        { id: nanoid(), source: trig, target: ag,  type: 'pipe', data: { type: 'pipe' } },
        { id: nanoid(), source: ag,   target: out, type: 'pipe', data: { type: 'pipe' } },
      ],
    };
  },
};
`,
  },
  runConsole: {
    title: '控制台',
    stats: '{{logs}} 条日志 · {{nodes}} 个节点',
    clear: '清空',
    empty: '点击右上角"运行"开始',
  },
  templates: {
    title: '从模板创建',
    fromTs: '从 TS 导入',
    fromTsTitle: '粘贴 TS 代码创建自定义模板',
    loadConfirm: '加载模板会替换当前画布上的工作流，确定吗？（可先用顶栏"导出"备份）',
  },
  mcp: {
    title: 'MCP 工具',
    addTitle: '添加 MCP server',
    remoteOnlyAnthropic:
      '「remote」MCP 只有 Anthropic provider 生效。当前 provider ({{provider}}) 的 remote server 会被忽略；改成 local 即可生效。',
    ollamaNoTools: 'Ollama provider 暂不支持工具调用，MCP 配置会被忽略。',
    emptyHint: '点 + 添加。',
    emptyHint2: 'local = 浏览器直连（需 CORS）；remote = Anthropic 转发。',
    unnamed: '(未命名)',
    transport: 'Transport',
    transportLocal: 'local（浏览器直连）',
    transportRemote: 'remote（Anthropic 转发）',
    name: 'Name',
    url: 'URL',
    urlPlaceholder: 'https://your-server.example.com/mcp',
    authToken: 'Authorization token（可选）',
    allowedTools: '允许的工具（逗号分隔，留空 = 全部）',
    allowedToolsPlaceholder: 'search_docs, list_files',
    testConnection: '测试连接',
    connected: '连接成功 · 发现 {{count}} 个工具',
    connectFailed: '连接失败',
    connectedBadge: '已连接，发现 {{count}} 个工具',
    testRemoteUnsupported:
      'remote 模式由 Anthropic 服务器连，浏览器测不了。切到 local 测，或直接运行工作流验证。',
    urlEmpty: 'URL 是空的',
    footerLocal: 'local',
    footerLocalDesc: '：浏览器直连 MCP server，必须开 CORS 允许本站。',
    footerRemote: 'remote',
    footerRemoteDesc: '：Anthropic 服务器去连，URL 必须公网可达。',
  },
  rag: {
    sharedLibrary: '共享资料库',
    privateLibrary: '私有资料库',
    stats: '{{files}} 文件 · {{chars}} 字符',
    newTitle: '新建文本资料',
    uploadTitle: '上传文本资料',
    defaultName: '未命名.md',
    deleteConfirm: '确定删除这份资料？索引也会一起删除。',
    processing: '正在处理资料…',
    empty: '上传文本文件后会自动建立本地索引',
    rebuild: '重建',
    indexFailed: '索引失败',
  },
  ragLibrary: {
    title: '资料库',
    currentWorkflow: '当前工作流：{{name}}',
  },
  settings: {
    title: '设置',
    warningTitle: '关于浏览器直连 API',
    warningBody:
      '你的 API key 仅保存在本浏览器的 localStorage，所有请求由浏览器直接发往模型服务商。请只在你自己的设备上使用，不要在公共/共享电脑保存 key。后续版本将提供主密码加密。',
    apiKey: 'API Key',
    baseUrl: 'Base URL',
    openaiBaseUrl: 'Base URL（可填代理/兼容服务）',
    referer: 'HTTP-Referer（可选）',
    refererPlaceholder: '留空自动用本站域名',
    xTitle: 'X-Title（可选）',
    openrouterNotePre: '一个 key 调用所有模型，模型 id 形如',
    openrouterNotePost: '。Referer / Title 会显示在 OpenRouter dashboard。',
    lmstudioTitle: 'LM Studio (本地)',
    lmstudioKeyOptional: 'API Key（可选，部分代理需要）',
    leaveEmpty: '留空即可',
    lmstudioNotePre: 'LM Studio 启用 Local Server 后地址默认是',
    lmstudioNotePost: '。模型 id 用 LM Studio 当前加载的模型名。',
    ollamaTitle: 'Ollama (本地)',
    ollamaNotePre: '本地启动',
    ollamaNotePost: '后即可使用，无需 key。',
    syncTitle: '同步后端（可选）',
    endpoint: 'Endpoint',
    token: 'Token',
    syncNote: '留空则不开启同步，所有数据仅本地存储。同步协议在 M5 阶段接入。',
    pingOk: '连接成功',
    connectedBadge: '已连通',
  },
  history: {
    title: '运行历史',
    empty: '暂无历史。运行工作流后会自动保存到这里（最多保留 200 条）。',
    input: '输入',
    finalOutput: '最终输出',
    nodeOutputs: '各节点输出',
    status: {
      done: '完成',
      error: '出错',
      aborted: '已中止',
      running: '运行中',
      queued: '排队中',
      idle: '空闲',
    },
  },
  knowledge: {
    title: '知识库',
    inlineLabel: '内联背景（拼到 system prompt，每次都看得到）',
    inlinePlaceholder: '例：你是 ACME 公司的内部助理。公司刚发布新版本 v3.2，重要变更：...',
    privateLibrary: '私有资料库',
    footerInline: '内联',
    footerInlineDesc: '：短的、必看的信息。',
    footerLibrary: '私有资料库',
    footerLibraryDesc: '：长资料会自动索引，并在运行时按任务检索。',
  },
  files: {
    title: '工作流共享文件夹',
    subtitle:
      '所有 AI 节点可通过 fs_list / fs_read / fs_write / fs_delete 工具读写 · 当前工作流：{{name}}',
    newTitle: '新建文本文件',
    new: '新建',
    uploadTitle: '上传文件',
    upload: '上传',
    parent: '上级文件夹',
    root: '根目录',
    pathLabel: '路径（以 / 开头）',
    pathPlaceholder: '/spec.md',
    contentLabel: '内容',
    pathMustStart: '路径必须以 / 开头',
    empty: '空文件夹。AI 节点用 fs_write 创建文件后会出现在这里。',
    download: '下载',
    isDir: '（这是个目录，点开内部条目查看）',
    reading: '读取中…',
    truncated: '预览被截断（仅显示前 1MB）',
    selectToPreview: '选一个文件预览',
    readFailed: '(读取失败: {{msg}})',
    deleteConfirm: '确定删除 {{path}}？目录会递归删除。',
  },
  edges: {
    comm: '沟通方式',
    labelOptional: '标签（可选）',
    transformOptional: '输出变换（可选）',
    transformPlaceholder: '留空则透传，例：请评审：{{token}}',
    types: {
      assign: { label: '指派', description: '上司给下属派任务（阻塞，等返回）' },
      report: { label: '汇报', description: '下属向上司回传结果（异步）' },
      broadcast: { label: '广播', description: '一对多并行触发' },
      pipe: { label: '管道', description: '上游输出直接作为下游输入' },
      topic: { label: '话题', description: '在群聊室内发起话题' },
      manage: {
        label: '管理',
        description:
          '上司 → 下属（团队关系）。下属不进主调度，由上司 agent 自主用 delegate 工具决定何时派遣',
      },
    },
  },
  engine: {
    graphParsed: '图解析完成 · {{nodes}} 节点 · {{batches}} 个批次',
    runEnded: '运行结束 · {{status}}',
    targetReviewLog: '已保存目标验收 · 状态={{status}} · checklist={{done}}/{{total}}',
    noUpstream: '(无上游输出)',
    routePrefix: '[路由→{{branch}}] ',
    routedTo: '路由到分支 "{{branch}}"',
    skipped: '已跳过（未选中该分支）',
    routerJudgeSystem:
      '你是一个分流分类器。根据以下标准判断输入应该走哪个分支：\n\n{{criteria}}\n\n如果输入符合该标准，只回答字母 "a"；否则回答 "b"。只输出一个字母，不要有其他内容。',
    pleaseDiscuss: '请讨论。',
    waitingDiscuss: '等待用户讨论（{{provider}}/{{model}}）',
    discussDone: '讨论完成，输出已传给下游',
    calling: '调用 {{provider}}/{{model}}',
    done: '完成',
    doneWithTools: '完成 · 工具轮次 {{rounds}}',
    aborted: '已中止',
    assigned: '被指派：{{task}}',
    assignedDiscuss: '被指派讨论：{{task}}',
    delegateCycle: '(拒绝：检测到循环指派——{{name}} 已在当前调用栈上)',
    roomEmpty: '(房间 {{name}} 是空的——把 AI 节点拖进房间内才能讨论)',
    roomFailed: '(房间 {{name}} 执行失败：{{msg}})',
    subordinateFailed: '(下属 {{name}} 执行失败：{{msg}})',
    roomDelegateDesc:
      '[群聊室·{{mode}}模式·最多{{rounds}}轮] 成员：{{members}}。task 描述会作为讨论话题。',
    tagAssign: '【上级指派】',
    tagBroadcast: '【广播】',
    tagFrom: '【来自 {{name}}】',
    roomStart: '群聊开始 · 模式={{mode}} · 成员={{members}}',
    round: '--- 第 {{n}} 轮 ---',
    stopKeywordDetected: '检测到终止关键词，提前结束',
    firstSpeaker: '首轮发言：{{name}}',
    moderatorEnded: '主持人宣布结束',
    moderatorForceContinue: '主持人想 stop，但 {{names}} 还未达到最少 {{min}} 次发言；强制继续',
    moderatorTag: '{{name}}(主持)',
    summaryTag: '{{name}}(总结)',
    summaryPrompt: '请基于以上讨论历史，给出一段总结作为最终结论。',
    summarizeSystem:
      '你是一个总结 agent。把用户提供的多份上游输出合并成一份连贯的结果，并遵循以下要求：\n\n{{instruction}}\n\n只输出最终的总结，不要任何开场白。',
    summarizeDefaultInstruction:
      '把所有输入综合成一份清晰、结构良好的总结；保留关键点并指出任何冲突之处。',
    freeform: '（无输入，请自由发挥）',
    discussFirstMsg: '讨论话题：{{topic}}\n\n请你作为{{name}}发表你的看法。',
    discussNextMsg: '话题：{{topic}}\n\n当前讨论历史：\n{{history}}\n\n请你作为{{name}}发表你的看法。',
  },
  errors: {
    anthropicNoKey: 'Anthropic API key 未配置，请先在「设置」里录入。',
    anthropicNoKeyShort: '未配置 API key',
    anthropicRequestFailed: 'Anthropic 请求失败：{{status}} {{statusText}}',
    anthropicError: 'Anthropic 错误：{{msg}}',
    anthropicUnknown: '未知',
    anthropicPingFailed: 'Anthropic ping 失败：{{status}} — {{body}}',
    providerNoKey: '{{name}} API key 未配置，请先在「设置」里录入。',
    providerNoKeyShort: '未配置 API key',
    providerRequestFailed: '{{name}} 请求失败：{{status}} {{statusText}}',
    providerPingFailed: '{{name}} ping 失败：{{status}} — {{body}}',
    ollamaRequestFailed: 'Ollama 请求失败：{{status}} — {{body}}',
    ollamaPingFailed: 'Ollama ping 失败：{{status}}（检查 ollama serve 是否在运行）',
    importNotWorkflow: 'JSON 不像是工作流（缺少 nodes / edges）',
    fsForbiddenSegment: '不允许的路径段: "{{seg}}"',
    fsPathEmpty: '路径不能为空',
    fsPathRequired: '参数 path 必填',
    fsContentRequired: '参数 content 必填',
    fsFileNotExist: '文件不存在: {{path}}',
    fsPathNotExist: '路径不存在: {{path}}',
  },
  ragRuntime: {
    contextHeader: '## 相关知识片段（自动检索）',
    contextIntro:
      '以下内容来自当前工作流的共享知识库和该 AI 的私有知识库。回答时优先参考；如果片段不足，请说明不确定。',
    snippet: '片段',
    truncated: '[已截断]',
    defaultSourceName: '未命名资料',
  },
  store: {
    untitledWorkflow: '未命名工作流',
    demoName: '你好世界',
    demoAssistant: '助理小爱',
    outputLog: '◆ 输出\n{{text}}',
  },
  models: {
    localLoaded: '当前加载的本地模型',
  },
  tools: {
    noToolSupport: '\n⚠️ 当前 provider ({{provider}}) 不支持工具调用，fs_read / fs_write 不会提供给模型。\n',
    mcpConnectFail: '\n⚠️ MCP [{{server}}] 连接失败：{{msg}}\n',
    listTeamDesc: '列出你能指派的下属团队成员。当前下属：\n{{members}}',
    delegateDesc:
      '把一个具体任务派给一名下属，等待他完成并返回结果。可以多次调用、可以串行也可以基于上一次结果再派别的下属。',
    delegateNameDesc: '下属姓名（必须是 list_team 列出的之一）',
    delegateTaskDesc: '清晰、自包含的任务描述。下属看不到你之前的上下文，请把他需要的信息都写进 task。',
    errMissingName: '错误：缺少 name 参数',
    errMissingTask: '错误：缺少 task 参数',
    errNoSubordinate: '错误：找不到下属 "{{name}}"。可用：{{available}}',
    kbListDesc: '列出你的私人知识库中的所有文件（名字 + 大小 + 首行预览）',
    kbReadDesc: '按名字读取知识库中的一个文件。大文件会被截断；优先使用 kb_search 或内置 RAG 片段。',
    kbReadNameDesc: '文件名，必须是 kb_list 列出的之一',
    kbSearchDesc:
      '在知识库所有文件里关键词搜索（多个词空格分隔，OR 关系），返回命中文件 + 周围片段。先 search 再 read 比直接读全部更省 token。',
    kbSearchQueryDesc: '关键词，可空格分隔多个',
    kbSearchMaxDesc: '最多返回多少个命中文件（默认 5）',
    kbIndexLabel: '知识库文件列表',
    kbFileEntry: '- {{name}} ({{chars}} chars, 首行: {{firstLine}})',
    kbEmpty: '(知识库为空)',
    kbFileLabel: '知识库文件 {{name}}',
    kbNoFile: '(知识库中无此文件: {{name}}；可用文件:\n{{index}})',
    errMissingQuery: '错误：缺少 query 参数',
    errEmptyQuery: '错误：query 为空',
    kbHitHeader: '### {{name}} (命中 {{count}} 次)',
    kbNoHit: '(没有命中任何关键词)',
    contextTrimmed:
      '\n⚠️ 检测到上下文过长，已截断部分系统提示/历史/输入；长资料建议放入资料库由 RAG 自动检索。\n',
    kbInlineHeader: '## 个人知识背景（始终在你的上下文里）',
    maxToolRounds: '\n\n⛔ 达到工具调用次数上限（{{max}}），停止循环\n',
    toolCalling: '\n\n🔧 [{{name}}] 调用中…\n  参数: ',
    toolError: '⚠️ 工具错误',
    toolResult: '↩️ 工具结果',
    remoteToolCalling: '\n\n🔧 [{{name}}] 调用中…',
    argsLine: '\n  参数: {{args}}',
    unknownTool: 'unknown tool: {{name}}',
    truncatedNote: '\n\n[{{label}}已截断：原始 {{chars}} 字符，仅保留前后片段以避免超过模型上下文。]\n\n',
    labelSystemPrompt: '系统提示词',
    labelKbInline: '个人知识背景',
    labelUserMessage: '当前用户输入',
    labelAssistantPreTool: '模型工具调用前回复',
    noDesc: '(无描述)',
    argsTruncatedNote: '工具参数已从历史上下文中截断；真实参数已用于执行工具。',
    labelToolArgs: '{{name}} 工具参数',
    labelToolResult: '{{name}} 工具结果',
    labelHistory: '{{role}}历史消息',
    roleAI: 'AI ',
    roleTool: '工具',
    roleSystem: '系统',
    roleUser: '用户',
    runJsDesc:
      '在沙箱里执行 JavaScript（无网络、无 DOM、无文件系统）并拿到结果。返回 console.log 输出和最后一个表达式的值。用它来计算、测试或验证你写的代码。',
    runJsCodeDesc: '要运行的 JavaScript 源码，最后一个表达式的值会被返回。',
    runJsTimeoutDesc: '可选超时（毫秒），默认 3000，最大 15000。',
    runJsNoCode: '未提供代码。',
    fsListDesc:
      '列出当前工作流共享文件夹下的内容。当你需要确认有哪些文件、查找路径、读取记忆/报告/代码前，应先调用此工具。所有 AI 节点共享同一个文件夹。',
    fsListPathDesc: '相对路径，默认根目录 "/"。例如 "/" 或 "/docs"',
    fsReadDesc:
      '读取共享文件夹中一个文本文件的内容。为避免上下文过长，大文件只返回开头片段并提示截断；需要定位信息时先用资料库/RAG或让用户提供更小文件。',
    fsReadPathDesc: '文件相对路径，例如 "/spec.md" 或 "/data/users.json"',
    fsWriteDesc:
      '写入文本文件到共享文件夹（覆盖同名文件，必要的中间目录会自动创建）。需要保存长方案、报告、代码、JSON、记忆或给下游节点继续使用的内容时，优先调用此工具。追加文件时先 fs_read 旧内容再 fs_write 写回。',
    fsWritePathDesc: '文件相对路径，例如 "/plan.md"',
    fsWriteContentDesc: '文件内容（文本）；特别长的内容建议分段写入，避免工具参数过长。',
    fsDeleteDesc: '删除一个文件或目录（目录会递归删除）。',
    fsDeletePathDesc: '要删除的相对路径',
    emptyDir: '(空目录)',
    readTruncated:
      '{{content}}\n\n[文件被截断：工具读取上限 {{limit}}，原始大小 {{size}}。请改用资料库/RAG检索，或把文件拆小后再读取。]',
    writeOk: '已写入 {{path}} ({{size}})',
    deleteOk: '已删除 {{path}}',
    fsInstructions: `## 工作流共享文件夹工具

你可以使用共享文件夹工具在本工作流内读写文件：
- fs_list({ "path": "/" })：查看目录内容
- fs_read({ "path": "/file.md" })：读取已有文本文件（大文件只返回有限片段）
- fs_write({ "path": "/file.md", "content": "..." })：写入或覆盖文本文件
- fs_delete({ "path": "/file.md" })：删除文件或目录

使用规则：
- 自动 RAG 已经把相关知识片段注入上下文；只有需要精确查看共享文件时再调用 fs_list 或 fs_read。
- fs_read 面向模型有读取上限，遇到截断时不要反复读取同一个大文件；改用资料库检索、让用户拆分文件，或只处理已返回片段。
- 需要把长方案、报告、代码、JSON、记忆或下游要继续使用的内容保存下来时，优先调用 fs_write；对话里只简短说明写入路径和内容摘要。
- 追加文件时，先 fs_read 读取旧内容，再 fs_write 写回「旧内容 + 新内容」；如果旧内容被截断，先说明无法安全追加完整文件。
- 只有工具返回成功后，才能说自己已读取或已写入某个文件。`,
  },
  defaults: {
    agentName: '新员工',
    agentSoul: `# 角色

你是一名 AI 员工。请基于自身职责，认真完成上级派发的任务。

## 职责

- 用专业、可执行的方式回答问题
- 必要时主动提出澄清问题

## 风格

- 简洁、直接、不啰嗦
`,
    triggerName: '任务入口',
    triggerInput: '请帮我写一段产品介绍',
    roomName: '会议室',
    moderatorPrompt: `你是讨论主持人。任务：在已有讨论的基础上推进。

候选成员：{{members}}
讨论历史：
{{history}}

规则：
1) 只有当讨论已经充分（每个观点至少被双方各回应过一轮、且没有明显新信息可挖）时，才返回 stop
2) 否则选一个最能推进讨论的成员发言（优先让上轮被反驳但未回应的人）
3) 严格输出一行 JSON，没有其他字符：
   - 继续：{"next":"成员名"}
   - 结束：{"stop":true,"summary":"一句话结论"}`,
    stopKeyword: '【讨论结束】',
    aggregatorName: '汇总',
    routerName: '分流',
    outputName: '输出',
    discussName: '与用户讨论',
    discussSoul: `# 角色
你是用户的协作伙伴。用户会在此节点和你来回讨论一个方案，直到方案足够清晰、可以交给下游的执行者。

## 工作方式
- 看到上游传来的初步任务/方案后，先用 1-2 句确认你的理解，然后提 1-3 个最关键的澄清问题
- 收到用户回复后，迭代方案：补充细节、提出取舍、指出风险
- 不要急着给最终答案；以"帮用户把方案磨清楚"为目标
- 当用户表示满意或要求收尾时，输出一段结构化的「最终方案」供下游执行

## 风格
- 简洁、聚焦关键问题
- 一次只问最重要的 1-3 个问题，避免一次抛 10 个`,
    discussOpening:
      '下面是从上游传来的初始任务/方案：\n\n{{input}}\n\n请你和我（用户）一起讨论它。先用 1-2 句确认你的理解，然后提 1-3 个最关键的澄清问题。',
  },
  presets: {
    pm: {
      name: '产品经理小李',
      soul: `# 角色
你是一位有 8 年经验的资深产品经理，擅长把模糊需求拆成清晰的产品方案。

## 工作方式
- 收到任务时先复述你对需求的理解，再列出关键问题
- 用「用户故事」格式描述功能：作为 X，我希望 Y，以便 Z
- 给出可衡量的成功指标
- 对工程实现保持敏感，但不替工程师做技术决策

## 风格
- 结构化、有条理、用 bullet
- 不啰嗦，每条要点 ≤ 2 行
`,
    },
    engineer: {
      name: '工程师老王',
      soul: `# 角色
你是一位有 15 年经验的资深全栈工程师，注重代码质量和可维护性。

## 工作方式
- 收到需求后先评估技术可行性和风险
- 给出关键技术选型理由（不是堆术语）
- 写代码时遵守 KISS 原则：能简单就不复杂
- 主动指出需求里的歧义或潜在 bug

## 输出格式
- 短回答：直接给结论 + 1-2 行理由
- 长方案：架构图（mermaid 或 ASCII）+ 关键代码片段 + 风险点
`,
    },
    designer: {
      name: '设计师小米',
      soul: `# 角色
你是一位资深 UX/UI 设计师，关注用户认知负担和情感连接。

## 工作方式
- 任何设计先问：用户在什么场景下使用？要解决什么核心问题？
- 用文字描述布局：层级、留白、对比、视觉锚点
- 关注 micro-interaction：hover、focus、loading、empty state
- 解释设计决策时引用具体原则（如 Fitts's Law、格式塔）

## 输出格式
- 用 mermaid 或 ASCII 画线框
- 列举各状态：默认 / hover / active / disabled / loading / error / empty
`,
    },
    critic: {
      name: '批评家',
      soul: `# 角色
你是一位毒舌但公允的评论家，专门挑战观点和方案。

## 工作方式
- 收到内容后，先指出 3 个最致命的弱点
- 每个弱点配一个反例或反驳逻辑
- 区分「事实错误」和「立场分歧」，不混淆
- 末尾给一句最尖锐的总结

## 风格
- 直接、锋利、不和稀泥
- 但保持理性，不人身攻击
`,
    },
    optimist: {
      name: '乐观派',
      soul: `# 角色
你是一位乐观主义者，总能在任何方案里找到可能性和机会。

## 工作方式
- 收到方案后，找到它最闪光的 3 个点
- 想象方案成功后的最好场景
- 给出能放大这些优点的建议
- 不回避问题，但用「如何让它更好」的视角讨论

## 风格
- 真诚的鼓励，不是廉价吹捧
- 用具体例子和数据支撑乐观判断
`,
    },
    translator: {
      name: '翻译官',
      soul: `# 角色
你是一位精通中英文的资深翻译，背景在科技 / 学术领域。

## 工作方式
- 直接给译文，不解释（除非用户问）
- 中译英：地道、简洁、避免 Chinglish
- 英译中：自然中文，避免欧化句式
- 专有名词保留原文 + 中文备注

## 风格
- 不增加原文没有的修饰
- 保持原作者语气：严肃保严肃，活泼保活泼
`,
    },
    moderator: {
      name: '会议主持人',
      soul: `# 角色
你是一位群聊会议的主持人，负责推进讨论、控制节奏、保证产出。

## 工作方式
- 仔细看完讨论历史，识别当前焦点
- 决定让谁发言能最大化推进讨论
- 当各方观点已充分表达时，宣布结束并给出总结

## 输出格式
严格按一行 JSON 返回：
- 继续：{"next": "成员名"}
- 结束：{"stop": true, "summary": "结论摘要"}
不要输出任何其他内容。
`,
    },
  },
  templatesData: {
    pmName: '产品三人组（线性流）',
    pmDesc: 'PM 收到需求 → 工程师评估技术 → 设计师设计 UI → 输出综合方案',
    pmWorkflowName: '产品三人组',
    pmTriggerInput: '我想做一个可以让独立开发者快速搭建落地页的工具，目标用户是 indie hacker。',
    codeName: '代码执行器（写 + 跑）',
    codeDesc: '工程师写 JavaScript 并用 run_js 沙箱执行验证，再汇报结果。',
    codeWorkflowName: '代码执行器',
    codeTriggerInput: '写一个 isPrime(n) 函数，然后在 2、7、12、97、100 上测试，报告哪些是质数。',
    codeSoul:
      '你是一名资深软件工程师。遇到任何涉及计算、逻辑、解析或算法的任务：先写 JavaScript，并且必须调用 run_js 工具真正执行、验证结果之后再回答——绝不在没运行的情况下声称代码可用。用 console.log 打印中间值和测试用例。最终回复里附上可运行的代码和已验证的输出。',
  },
};
