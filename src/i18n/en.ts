export const en = {
  common: {
    cancel: 'Cancel',
    save: 'Save',
    close: 'Close',
    delete: 'Delete',
    create: 'Create',
    confirm: 'Confirm',
    refresh: 'Refresh',
    add: 'Add',
    edit: 'Edit',
    remove: 'Remove',
    loading: 'Loading…',
    loadingEditor: 'Loading editor…',
    none: '(none)',
    empty: '(empty)',
  },
  app: {
    noNodes: 'No nodes on the canvas',
    runStart: 'Run started: {{name}}',
    runAborted: 'User aborted the run',
  },
  topbar: {
    name: 'CrewCanvas',
    undo: 'Undo (Ctrl/Cmd+Z)',
    redo: 'Redo (Ctrl/Cmd+Shift+Z)',
    templates: 'Templates',
    templatesTitle: 'Template library',
    files: 'Files',
    filesTitle: 'Workflow shared folder',
    ragLibrary: 'Library',
    ragLibraryTitle: 'RAG library',
    history: 'History',
    historyTitle: 'Run history',
    import: 'Import',
    importTitle: 'Import workflow JSON',
    importRoleCard: 'Import roles',
    importRoleCardTitle: 'Import role card(s) — pick one or more .json files (batch supported)',
    roleCardNone: 'No valid role cards found in the selected file(s).',
    roleCardImported: 'Imported {{count}} role card(s) as agent nodes.',
    export: 'Export',
    exportTitle: 'Export workflow JSON',
    reset: 'Reset',
    resetTitle: 'Reset',
    resetConfirm: 'Reset to the initial example workflow? Current work will be lost.',
    settings: 'Settings',
    run: 'Run',
    stop: 'Stop',
    importFailed: 'Import failed: {{msg}}',
    exportFailed: 'Export failed: {{msg}}',
    language: 'Language',
    nodes: 'Nodes',
    inspector: 'Inspector',
    target: 'Target',
    targetTitle: 'Workflow target',
  },
  palette: {
    heading: 'Nodes',
    hint: 'Drag or tap to add',
    trigger: { label: 'Task Entry', desc: 'Workflow start' },
    agent: { label: 'AI Worker', desc: 'An AI role with soul.md' },
    discuss: { label: 'Discuss with User', desc: 'Pause for you and the AI to discuss' },
    room: { label: 'Group Chat', desc: 'Multi-AI, multi-round discussion' },
    aggregator: { label: 'Aggregate', desc: 'Merge multiple upstreams' },
    router: { label: 'Branch', desc: 'Route to branches by rule' },
    output: { label: 'Output', desc: 'Final result display' },
  },
  canvas: {
    panMode: 'Pan canvas',
    selectMode: 'Select area',
  },
  toolbar: {
    copy: 'Copy',
    paste: 'Paste',
    duplicate: 'Duplicate',
    delete: 'Delete',
  },
  target: {
    title: 'Target',
    enabled: 'Use this target during runs',
    nameLabel: 'Name',
    namePlaceholder: 'e.g. Ship mobile-ready CrewCanvas',
    statusLabel: 'Status',
    objectiveLabel: 'Objective',
    objectivePlaceholder: 'Write the concrete goal the team should optimize for.',
    contextLabel: 'Context',
    contextPlaceholder: 'Background, users, current situation, links, or project notes.',
    risksLabel: 'Risks / blockers',
    risksPlaceholder: 'Known risks, open questions, tradeoffs, or things to avoid.',
    acceptanceTitle: 'Acceptance criteria',
    acceptancePlaceholder: 'Add a measurable criterion',
    constraintsTitle: 'Constraints',
    constraintsPlaceholder: 'Add a constraint',
    checklistTitle: 'Checklist',
    checklistPlaceholder: 'Add a task',
    progress: '{{done}}/{{total}} done · {{percent}}%',
    noChecklist: 'No checklist items yet',
    clear: 'Clear',
    clearConfirm: 'Clear the workflow target?',
    lastReview: 'Last run review',
    noReview: 'Run the workflow once to record a target review.',
    markDone: 'Mark done',
    markOpen: 'Mark open',
    status: {
      draft: 'Draft',
      active: 'Active',
      blocked: 'Blocked',
      complete: 'Complete',
    },
    reviewSummary:
      'Target status: {{status}}. Checklist progress: {{done}}/{{total}} ({{percent}}%).',
  },
  targetPrompt: {
    heading: 'Workflow Target',
    instructions:
      'Treat this as the controlling objective for the whole workflow. Align decisions, delegation, summaries, and final output to it. If a request conflicts with the target or constraints, call that out explicitly.',
    title: 'Target name',
    objective: 'Objective',
    status: 'Status',
    context: 'Context',
    acceptance: 'Acceptance criteria',
    constraints: 'Constraints',
    checklist: 'Checklist',
    risks: 'Risks and blockers',
    userTask: 'Current task',
  },
  nodes: {
    trigger: { subtitle: 'Workflow entry' },
    output: { afterRun: 'Result shows after running' },
    room: {
      summary: 'Group chat · {{mode}} · up to {{rounds}} rounds',
      modes: { 'round-robin': 'Round-robin', moderator: 'Moderator', race: 'Race' },
    },
    router: {
      summary: 'Branch · {{rule}}',
      rules: { 'llm-judge': 'AI judge', regex: 'Regex' },
    },
    aggregator: {
      summary: 'Aggregate · {{strategy}}',
      strategies: {
        concat: 'Concatenate',
        'json-merge': 'JSON merge',
        'pick-first': 'Pick first',
        summarize: 'AI summary',
      },
    },
    discuss: {
      subtitle: 'Discuss with user',
      pauseHint: 'Pauses here at runtime for you to discuss with the AI',
      preparing: 'AI is preparing an opening…',
      you: 'You',
      ai: 'AI',
      thinking: 'AI thinking…',
      done: 'Discussion finished — result sent downstream',
      notRunning: 'Not running',
      summaryPlaceholder:
        'Optional: write a final plan as the downstream input. Leave empty to use the last AI reply.',
      finish: 'Finish',
      replyingPlaceholder: 'AI replying…',
      replyPlaceholder: 'Reply to the AI (Enter to send, Shift+Enter for newline)',
      finishDiscussion: 'Finish discussion',
      send: 'Send',
    },
  },
  inspector: {
    heading: 'Inspector',
    nodeLabel: 'Node · {{type}}',
    multiLabel: '{{count}} nodes selected',
    edge: 'Edge',
    none: 'Nothing selected (click a node or edge to edit)',
    hintsTitle: 'Tips:',
    hintDrag: 'Drag a node out from the left',
    hintConnect: 'Drag from a node port to connect',
    hintClickEdge: 'Click an edge to change its communication type',
    hintClickAgent: 'Click an AI node to edit soul.md',
    name: 'Name',
    deleteNode: 'Delete node',
    deleteEdge: 'Delete edge',
  },
  trace: {
    title: 'This run',
    upstreams: 'Upstream inputs',
    noUpstreams: '(no upstream input)',
    systemPrompt: 'System prompt (as sent)',
    userMessage: 'User message (as sent)',
    rag: 'RAG retrieval',
    ragQuery: 'Query',
    ragHit: 'context injected',
    ragMiss: 'no match',
    tools: 'Tools offered',
    toolCalls: 'Tool calls',
    noToolCalls: '(no tool calls)',
    args: 'args',
    result: 'result',
    error: 'error',
    trimmed: 'context trimmed to fit limits',
    empty: 'Run the workflow to see what this node actually received.',
  },
  bulkInspector: {
    selectedCount: '{{count}} nodes selected',
    agentsCount: '{{count}} are AI Workers',
    sourceTitle: 'Bulk model source',
    apply: 'Apply to {{count}} AI Workers',
    noAgents: 'No AI Workers in the selection — box-select some agent nodes.',
    deleteSelection: 'Delete {{count}} nodes',
  },
  trigger: {
    inputLabel: 'Input (task description)',
    inputPlaceholder: 'On run, this content is passed downstream as {{token}}',
  },
  routerInspector: {
    ruleLabel: 'Branch rule',
    ruleLlmJudge: 'AI judge (let the model pick a branch)',
    ruleRegex: 'Regex match',
    patternLabel: 'Regex pattern',
    patternPlaceholder: '^yes$',
    judgePromptLabel: 'Branch criterion (met → branch a, else → branch b)',
    judgePromptPlaceholder: 'e.g. The input is a bug report (not a feature request)',
    judgeHint: 'The model reads the upstream output and answers a or b. Branch a = top handle, b = bottom.',
  },
  aggregatorInspector: {
    strategyLabel: 'Aggregation strategy',
    concat: 'Concatenate (join directly)',
    jsonMerge: 'JSON merge',
    pickFirst: 'Pick first returned',
    summarize: 'AI summary (LLM)',
    summarizePromptLabel: 'Summary instruction',
    summarizePromptPlaceholder:
      'e.g. Merge the views into a 5-bullet executive summary, highlighting disagreements',
    summarizeHint:
      'The model reads all upstream outputs and writes one combined summary. Falls back to plain concatenation if the call fails.',
  },
  roomInspector: {
    modeLabel: 'Speaking mode',
    modeRoundRobin: 'Round-robin (speak in order)',
    modeModerator: 'Moderator (moderator picks next)',
    modeRace: 'Race (first to respond each round)',
    maxRounds: 'Max rounds',
    minTurns: 'Min turns per speaker',
    moderatorLabel: 'Moderator (pick a member)',
    moderatorAuto: '(auto-pick first member)',
    moderatorPromptLabel: 'Moderator instruction template',
    moderatorVars: 'Variables:',
    moderatorReturns: 'The moderator must return JSON:',
    or: 'or',
    stopKeywordLabel: 'Stop keyword (any message containing it stops)',
    stopKeywordPlaceholder: 'e.g. [End discussion]',
    membersTitle: 'Current members ({{count}})',
    membersEmpty: 'Drag an AI node into the room to add it',
    deleteRoom: 'Delete room',
  },
  fields: {
    avatar: 'Avatar (emoji)',
    name: 'Name',
    provider: 'Provider',
    model: 'Model',
    temperature: 'Temperature',
    maxTokens: 'Max tokens',
    soul: 'soul.md (the AI persona)',
  },
  providers: {
    ollamaLocal: 'Ollama (local)',
    lmstudioLocal: 'LM Studio (local)',
  },
  discussInspector: {
    openingLabel: 'AI opening prompt (first turn)',
    openingHintPre: 'Supports',
    openingHintMid: '(upstream output) and',
    soulLabel: 'soul.md (the AI discussion partner persona)',
  },
  agentInspector: {
    modelPlaceholder: 'Pick one or type a model id',
    memory: 'Memory',
    memorySession: 'Remember within this run',
    memoryNone: 'No memory (cleared each time)',
    soulLabel: 'soul.md (role / personality / duties)',
    fillFromPreset: 'Fill from template…',
    presetOverwrite: 'soul.md already has content. Overwrite with the template?',
    soulVars: 'Supported variables:',
    exportRoleCard: 'Export role card',
    exportRoleCardTitle:
      'Download this agent as a reusable role card (knowledge included, MCP tokens stripped)',
  },
  exportDialog: {
    title: 'Export workflow',
    includeKnowledge: 'Include knowledge base',
    includeKnowledgeDesc: 'Inline knowledge and each agent’s private-library files.',
    includeSensitive: 'Include sensitive fields',
    includeSensitiveDesc: 'MCP server auth tokens. Leave off when sharing the file.',
    cancel: 'Cancel',
    export: 'Export',
  },
  importTs: {
    title: 'Import template from TS code',
    securityTitle: 'Security note',
    securityBody:
      'The compiled JS runs in your browser. Only import code you wrote or trust — malicious scripts can read your API keys (localStorage).',
    convTitle: 'Conventions',
    conv1: '`export default` an object with `{ id, name, description?, build() }`',
    conv2: 'Available globals: `nanoid`, `defaultNodeData`, `SOUL_PRESETS`, `presetAgent`',
    conv3: 'No `import` statements (they are stripped)',
    conv4: 'TS type annotations are stripped; no type checking',
    loadConfirm:
      'Loading replaces the current workflow on the canvas. Continue? (Export from the top bar first to back up.)',
    buildThrew: 'build() threw: {{msg}}',
    compileOk: 'Compiled successfully:',
    compile: 'Compile',
    loadToCanvas: 'Load to canvas',
    errUnknownPreset: 'Unknown soul preset: "{{id}}"',
    errCompileFailed: 'TypeScript compile failed: {{msg}}',
    errExecFailed: 'Execution failed: {{msg}}',
    errShape:
      'The template must export default an object with { id: string, name: string, description?: string, build(): Workflow }',
    exampleTs: `// Available globals: nanoid, defaultNodeData, SOUL_PRESETS, presetAgent
// import statements are not allowed

interface Foo { id: string }  // TS type annotations are fine; they get stripped

export default {
  id: 'my-translator',
  name: 'My Translation Template',
  description: 'A minimal translation flow: trigger → translator → output',
  build() {
    const trig = nanoid();
    const ag = nanoid();
    const out = nanoid();
    return {
      id: nanoid(),
      name: 'My Translation Template',
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
    title: 'Console',
    stats: '{{logs}} logs · {{nodes}} nodes',
    clear: 'Clear',
    empty: 'Click "Run" at the top right to start',
  },
  templates: {
    title: 'Create from template',
    fromTs: 'Import from TS',
    fromTsTitle: 'Paste TS code to create a custom template',
    loadConfirm:
      'Loading a template replaces the current workflow on the canvas. Continue? (Export from the top bar first to back up.)',
  },
  mcp: {
    title: 'MCP tools',
    addTitle: 'Add MCP server',
    remoteOnlyAnthropic:
      '"remote" MCP only works with the Anthropic provider. The remote server for the current provider ({{provider}}) is ignored; switch to local to enable it.',
    ollamaNoTools: 'The Ollama provider does not support tool calling yet; MCP config is ignored.',
    emptyHint: 'Click + to add.',
    emptyHint2: 'local = direct from the browser (needs CORS); remote = forwarded by Anthropic.',
    unnamed: '(unnamed)',
    transport: 'Transport',
    transportLocal: 'local (direct from browser)',
    transportRemote: 'remote (Anthropic forwards)',
    name: 'Name',
    url: 'URL',
    urlPlaceholder: 'https://your-server.example.com/mcp',
    authToken: 'Authorization token (optional)',
    allowedTools: 'Allowed tools (comma-separated, empty = all)',
    allowedToolsPlaceholder: 'search_docs, list_files',
    testConnection: 'Test connection',
    connected: 'Connected · found {{count}} tools',
    connectFailed: 'Connection failed',
    connectedBadge: 'Connected, found {{count}} tools',
    testRemoteUnsupported:
      "remote mode is connected by Anthropic's servers; the browser can't test it. Switch to local to test, or run the workflow to verify.",
    urlEmpty: 'URL is empty',
    footerLocal: 'local',
    footerLocalDesc:
      ': the browser connects directly to the MCP server; it must allow CORS for this site.',
    footerRemote: 'remote',
    footerRemoteDesc: ": Anthropic's servers connect; the URL must be publicly reachable.",
  },
  rag: {
    sharedLibrary: 'Shared library',
    privateLibrary: 'Private library',
    stats: '{{files}} files · {{chars}} chars',
    newTitle: 'New text source',
    uploadTitle: 'Upload text source',
    defaultName: 'untitled.md',
    deleteConfirm: 'Delete this source? Its index will be removed too.',
    processing: 'Processing source…',
    empty: 'Upload text files to auto-build a local index',
    rebuild: 'Rebuild',
    indexFailed: 'Indexing failed',
  },
  ragLibrary: {
    title: 'Library',
    currentWorkflow: 'Current workflow: {{name}}',
  },
  settings: {
    title: 'Settings',
    warningTitle: 'About browser-direct API access',
    warningBody:
      "Your API keys are stored only in this browser's localStorage, and all requests go directly from the browser to the model providers. Only use this on your own device — don't save keys on public/shared computers. A master-password encryption option is coming.",
    apiKey: 'API Key',
    baseUrl: 'Base URL',
    openaiBaseUrl: 'Base URL (proxy / compatible service)',
    referer: 'HTTP-Referer (optional)',
    refererPlaceholder: "Empty = auto-use this site's domain",
    xTitle: 'X-Title (optional)',
    openrouterNotePre: 'One key calls all models; model ids look like',
    openrouterNotePost: '. Referer / Title show up in the OpenRouter dashboard.',
    lmstudioTitle: 'LM Studio (local)',
    lmstudioKeyOptional: 'API Key (optional, some proxies need it)',
    leaveEmpty: 'Leave empty',
    lmstudioNotePre: "LM Studio's Local Server defaults to",
    lmstudioNotePost: '. Use the currently loaded model name as the model id.',
    ollamaTitle: 'Ollama (local)',
    ollamaNotePre: 'Run',
    ollamaNotePost: 'locally to use it — no key needed.',
    syncTitle: 'Sync backend (optional)',
    endpoint: 'Endpoint',
    token: 'Token',
    syncNote: 'Empty = sync off; all data stays local only. The sync protocol lands in M5.',
    pingOk: 'Connected',
    connectedBadge: 'Connected',
  },
  history: {
    title: 'Run history',
    empty: 'No history yet. Runs are saved here automatically (up to 200 kept).',
    input: 'Input',
    finalOutput: 'Final output',
    nodeOutputs: 'Per-node output',
    status: {
      done: 'done',
      error: 'error',
      aborted: 'aborted',
      running: 'running',
      queued: 'queued',
      idle: 'idle',
    },
  },
  knowledge: {
    title: 'Knowledge base',
    inlineLabel: 'Inline background (appended to the system prompt, always visible)',
    inlinePlaceholder:
      'e.g. You are ACME\'s internal assistant. The company just shipped v3.2; key changes: ...',
    privateLibrary: 'Private library',
    footerInline: 'Inline',
    footerInlineDesc: ': short, must-read info.',
    footerLibrary: 'Private library',
    footerLibraryDesc: ': long material is auto-indexed and retrieved by task at runtime.',
  },
  files: {
    title: 'Workflow shared folder',
    subtitle:
      'All AI nodes can read/write via fs_list / fs_read / fs_write / fs_delete · current workflow: {{name}}',
    newTitle: 'New text file',
    new: 'New',
    uploadTitle: 'Upload files',
    upload: 'Upload',
    parent: 'Parent folder',
    root: 'Root folder',
    pathLabel: 'Path (starts with /)',
    pathPlaceholder: '/spec.md',
    contentLabel: 'Content',
    pathMustStart: 'Path must start with /',
    empty: 'Empty folder. Files created by AI nodes via fs_write will appear here.',
    download: 'Download',
    isDir: '(This is a directory — open an inner entry to view it)',
    reading: 'Reading…',
    truncated: 'Preview truncated (first 1MB only)',
    selectToPreview: 'Select a file to preview',
    readFailed: '(Read failed: {{msg}})',
    deleteConfirm: 'Delete {{path}}? Directories are removed recursively.',
  },
  edges: {
    comm: 'Communication type',
    labelOptional: 'Label (optional)',
    transformOptional: 'Output transform (optional)',
    transformPlaceholder: 'Leave empty to pass through, e.g. Please review: {{token}}',
    types: {
      assign: { label: 'Assign', description: 'Manager assigns a task to a report (blocks, waits for return)' },
      report: { label: 'Report', description: 'Report sends results back to the manager (async)' },
      broadcast: { label: 'Broadcast', description: 'One-to-many parallel trigger' },
      pipe: { label: 'Pipe', description: 'Upstream output flows directly into downstream input' },
      topic: { label: 'Topic', description: 'Start a topic inside a group chat room' },
      manage: {
        label: 'Manage',
        description:
          'Manager → report (team relationship). Reports stay out of the main schedule; the manager agent decides when to dispatch them via the delegate tool.',
      },
    },
  },
  engine: {
    graphParsed: 'Graph parsed · {{nodes}} nodes · {{batches}} batches',
    runEnded: 'Run ended · {{status}}',
    targetReviewLog: 'Target review saved · status={{status}} · checklist={{done}}/{{total}}',
    noUpstream: '(no upstream output)',
    routePrefix: '[route→{{branch}}] ',
    routedTo: 'Routed to branch "{{branch}}"',
    skipped: 'Skipped (branch not taken)',
    routerJudgeSystem:
      'You are a routing classifier. Decide which branch the input should follow based on this criterion:\n\n{{criteria}}\n\nIf the input matches the criterion, answer with the single letter "a". Otherwise answer "b". Output only one letter, nothing else.',
    pleaseDiscuss: 'Please discuss.',
    waitingDiscuss: 'Waiting for user discussion ({{provider}}/{{model}})',
    discussDone: 'Discussion finished, output sent downstream',
    calling: 'Calling {{provider}}/{{model}}',
    done: 'Done',
    doneWithTools: 'Done · {{rounds}} tool rounds',
    aborted: 'Aborted',
    assigned: 'Assigned: {{task}}',
    assignedDiscuss: 'Assigned to discuss: {{task}}',
    delegateCycle: '(Refused: delegation cycle detected — {{name}} is already on the call stack)',
    roomEmpty: '(Room {{name}} is empty — drag AI nodes into the room to discuss)',
    roomFailed: '(Room {{name}} failed: {{msg}})',
    subordinateFailed: '(Report {{name}} failed: {{msg}})',
    roomDelegateDesc:
      '[Group chat · {{mode}} mode · up to {{rounds}} rounds] Members: {{members}}. The task description becomes the discussion topic.',
    tagAssign: '[Assigned by manager]',
    tagBroadcast: '[Broadcast]',
    tagFrom: '[From {{name}}]',
    roomStart: 'Group chat started · mode={{mode}} · members={{members}}',
    round: '--- Round {{n}} ---',
    stopKeywordDetected: 'Stop keyword detected; ending early',
    firstSpeaker: 'First speaker: {{name}}',
    moderatorEnded: 'Moderator declared the end',
    moderatorForceContinue:
      'Moderator wanted to stop, but {{names}} have not reached the minimum {{min}} turns; forcing continuation',
    moderatorTag: '{{name}} (moderator)',
    summaryTag: '{{name}} (summary)',
    summaryPrompt: 'Based on the discussion history above, give a summary as the final conclusion.',
    summarizeSystem:
      'You are a summarizing agent. Combine the multiple upstream outputs the user provides into a single coherent result. Follow this instruction:\n\n{{instruction}}\n\nOutput only the final summary, with no preamble.',
    summarizeDefaultInstruction:
      'Synthesize all inputs into one clear, well-structured summary; keep key points and note any conflicts.',
    freeform: '(No input, feel free to improvise)',
    discussFirstMsg: 'Discussion topic: {{topic}}\n\nPlease share your view as {{name}}.',
    discussNextMsg:
      'Topic: {{topic}}\n\nDiscussion so far:\n{{history}}\n\nPlease share your view as {{name}}.',
  },
  errors: {
    anthropicNoKey: 'Anthropic API key not configured. Please enter it in Settings first.',
    anthropicNoKeyShort: 'API key not configured',
    anthropicRequestFailed: 'Anthropic request failed: {{status}} {{statusText}}',
    anthropicError: 'Anthropic error: {{msg}}',
    anthropicUnknown: 'unknown',
    anthropicPingFailed: 'Anthropic ping failed: {{status}} — {{body}}',
    providerNoKey: '{{name}} API key not configured. Please enter it in Settings first.',
    providerNoKeyShort: 'API key not configured',
    providerRequestFailed: '{{name}} request failed: {{status}} {{statusText}}',
    providerPingFailed: '{{name}} ping failed: {{status}} — {{body}}',
    ollamaRequestFailed: 'Ollama request failed: {{status}} — {{body}}',
    ollamaPingFailed: 'Ollama ping failed: {{status}} (check whether ollama serve is running)',
    importNotWorkflow: 'This JSON does not look like a workflow (missing nodes / edges)',
    fsForbiddenSegment: 'Forbidden path segment: "{{seg}}"',
    fsPathEmpty: 'Path cannot be empty',
    fsPathRequired: 'Parameter "path" is required',
    fsContentRequired: 'Parameter "content" is required',
    fsFileNotExist: 'File does not exist: {{path}}',
    fsPathNotExist: 'Path does not exist: {{path}}',
  },
  ragRuntime: {
    contextHeader: '## Relevant knowledge snippets (auto-retrieved)',
    contextIntro:
      'The following comes from this workflow\'s shared knowledge base and this AI\'s private knowledge base. Prefer it when answering; if the snippets are insufficient, say you are unsure.',
    snippet: 'snippet',
    truncated: '[truncated]',
    defaultSourceName: 'untitled source',
  },
  store: {
    untitledWorkflow: 'Untitled workflow',
    demoName: 'Hello World',
    demoAssistant: 'Assistant Aya',
    outputLog: '◆ Output\n{{text}}',
  },
  models: {
    localLoaded: 'Currently loaded local model',
  },
  tools: {
    noToolSupport:
      '\n⚠️ The current provider ({{provider}}) does not support tool calling; fs_read / fs_write will not be offered to the model.\n',
    mcpConnectFail: '\n⚠️ MCP [{{server}}] connection failed: {{msg}}\n',
    listTeamDesc:
      'List the subordinate team members you can delegate to. Current subordinates:\n{{members}}',
    delegateDesc:
      'Delegate a concrete task to one subordinate, wait for them to finish, and return the result. You can call it multiple times, serially, or chain based on previous results.',
    delegateNameDesc: 'Subordinate name (must be one listed by list_team)',
    delegateTaskDesc:
      'A clear, self-contained task description. The subordinate cannot see your prior context, so include everything they need.',
    errMissingName: 'Error: missing "name" parameter',
    errMissingTask: 'Error: missing "task" parameter',
    errNoSubordinate: 'Error: subordinate "{{name}}" not found. Available: {{available}}',
    kbListDesc: 'List all files in your private knowledge base (name + size + first-line preview)',
    kbReadDesc:
      'Read a knowledge base file by name. Large files are truncated; prefer kb_search or the built-in RAG snippets.',
    kbReadNameDesc: 'File name, must be one listed by kb_list',
    kbSearchDesc:
      'Keyword search across all knowledge base files (space-separated terms, OR logic); returns matching files + surrounding snippets. Search then read is more token-efficient than reading everything.',
    kbSearchQueryDesc: 'Keywords, space-separated for multiple',
    kbSearchMaxDesc: 'Max matching files to return (default 5)',
    kbIndexLabel: 'Knowledge base file list',
    kbFileEntry: '- {{name}} ({{chars}} chars, first line: {{firstLine}})',
    kbEmpty: '(knowledge base is empty)',
    kbFileLabel: 'Knowledge base file {{name}}',
    kbNoFile: '(no such file in the knowledge base: {{name}}; available files:\n{{index}})',
    errMissingQuery: 'Error: missing "query" parameter',
    errEmptyQuery: 'Error: query is empty',
    kbHitHeader: '### {{name}} ({{count}} hits)',
    kbNoHit: '(no keyword matches)',
    contextTrimmed:
      '\n⚠️ Context too long; trimmed part of the system prompt/history/input. Put long material in the library for automatic RAG retrieval.\n',
    kbInlineHeader: '## Personal knowledge background (always in your context)',
    maxToolRounds: '\n\n⛔ Reached the tool-call limit ({{max}}); stopping the loop\n',
    toolCalling: '\n\n🔧 [{{name}}] calling…\n  args: ',
    toolError: '⚠️ Tool error',
    toolResult: '↩️ Tool result',
    remoteToolCalling: '\n\n🔧 [{{name}}] calling…',
    argsLine: '\n  args: {{args}}',
    unknownTool: 'unknown tool: {{name}}',
    truncatedNote:
      '\n\n[{{label}} truncated: {{chars}} chars original; only head/tail kept to avoid exceeding the model context.]\n\n',
    labelSystemPrompt: 'System prompt',
    labelKbInline: 'Personal knowledge background',
    labelUserMessage: 'Current user input',
    labelAssistantPreTool: 'Model reply before tool call',
    noDesc: '(no description)',
    argsTruncatedNote:
      'Tool args were truncated from the history context; the real args were used to run the tool.',
    labelToolArgs: '{{name}} tool args',
    labelToolResult: '{{name}} tool result',
    labelHistory: '{{role}} history message',
    roleAI: 'AI ',
    roleTool: 'tool',
    roleSystem: 'system',
    roleUser: 'user',
    runJsDesc:
      'Execute JavaScript in a sandbox (no network, DOM, or filesystem access) and get the result. Returns console.log output and the value of the last expression. Use this to compute, test, or verify code you wrote.',
    runJsCodeDesc: 'JavaScript source to run. The value of the last expression is returned.',
    runJsTimeoutDesc: 'Optional timeout in ms (default 3000, max 15000).',
    runJsNoCode: 'No code provided.',
    fsListDesc:
      'List the contents of this workflow\'s shared folder. Call this first when you need to confirm which files exist, find a path, or before reading memory/reports/code. All AI nodes share the same folder.',
    fsListPathDesc: 'Relative path, defaults to root "/". e.g. "/" or "/docs"',
    fsReadDesc:
      'Read the content of one text file in the shared folder. To avoid overly long context, large files only return a leading slice with a truncation note; to locate info, use the library/RAG first or ask the user for a smaller file.',
    fsReadPathDesc: 'Relative file path, e.g. "/spec.md" or "/data/users.json"',
    fsWriteDesc:
      'Write a text file to the shared folder (overwrites a file of the same name; needed intermediate directories are created). Prefer this when you need to save long plans, reports, code, JSON, memory, or content for downstream nodes. To append, fs_read the old content first, then fs_write it back.',
    fsWritePathDesc: 'Relative file path, e.g. "/plan.md"',
    fsWriteContentDesc:
      'File content (text); for very long content, write in segments to avoid overly long tool args.',
    fsDeleteDesc: 'Delete a file or directory (directories are removed recursively).',
    fsDeletePathDesc: 'Relative path to delete',
    emptyDir: '(empty directory)',
    readTruncated:
      '{{content}}\n\n[File truncated: tool read limit {{limit}}, original size {{size}}. Use the library/RAG, or split the file before reading.]',
    writeOk: 'Wrote {{path}} ({{size}})',
    deleteOk: 'Deleted {{path}}',
    fsInstructions: `## Workflow shared folder tools

You can use the shared folder tools to read/write files within this workflow:
- fs_list({ "path": "/" }): view directory contents
- fs_read({ "path": "/file.md" }): read an existing text file (large files return only a limited slice)
- fs_write({ "path": "/file.md", "content": "..." }): write or overwrite a text file
- fs_delete({ "path": "/file.md" }): delete a file or directory

Usage rules:
- Automatic RAG already injects relevant knowledge snippets into your context; only call fs_list or fs_read when you need to see exact shared files.
- fs_read has a read limit for the model; when truncated, don't repeatedly read the same large file — use library retrieval, ask the user to split the file, or work with the returned slice only.
- When saving a long plan, report, code, JSON, memory, or content for downstream nodes, prefer fs_write; in the conversation just briefly note the path and a summary.
- To append, first fs_read the old content, then fs_write back "old + new"; if the old content was truncated, say you can't safely append the full file.
- Only claim you've read or written a file after the tool returns success.`,
  },
  defaults: {
    agentName: 'New hire',
    agentSoul: `# Role

You are an AI employee. Based on your responsibilities, carefully complete the tasks assigned by your manager.

## Responsibilities

- Answer questions in a professional, actionable way
- Proactively raise clarifying questions when needed

## Style

- Concise, direct, no fluff
`,
    triggerName: 'Task entry',
    triggerInput: 'Help me write a short product introduction',
    roomName: 'Meeting room',
    moderatorPrompt: `You are the discussion moderator. Task: advance the discussion based on what has been said.

Candidate members: {{members}}
Discussion history:
{{history}}

Rules:
1) Only return stop when the discussion is sufficient (each viewpoint has been responded to at least once by both sides, and no obvious new info remains)
2) Otherwise pick the member who can best advance the discussion (prefer someone rebutted last round who hasn't responded)
3) Output exactly one line of JSON, no other characters:
   - Continue: {"next":"member name"}
   - End: {"stop":true,"summary":"one-sentence conclusion"}`,
    stopKeyword: '[End discussion]',
    aggregatorName: 'Aggregate',
    routerName: 'Branch',
    outputName: 'Output',
    discussName: 'Discuss with user',
    discussSoul: `# Role
You are the user's collaboration partner. The user will discuss a plan with you back and forth at this node, until the plan is clear enough to hand to the downstream executor.

## How you work
- After seeing the initial task/plan from upstream, confirm your understanding in 1-2 sentences, then ask the 1-3 most critical clarifying questions
- After the user replies, iterate on the plan: add detail, propose trade-offs, point out risks
- Don't rush to a final answer; aim to "polish the plan with the user"
- When the user is satisfied or asks to wrap up, output a structured "final plan" for downstream execution

## Style
- Concise, focused on the key questions
- Ask only the 1-3 most important questions at a time; avoid throwing out 10 at once`,
    discussOpening:
      'Here is the initial task/plan passed from upstream:\n\n{{input}}\n\nPlease discuss it together with me (the user). First confirm your understanding in 1-2 sentences, then ask the 1-3 most critical clarifying questions.',
  },
  presets: {
    pm: {
      name: 'PM Li',
      soul: `# Role
You are a senior product manager with 8 years of experience, skilled at turning vague needs into clear product plans.

## How you work
- When you get a task, first restate your understanding of the need, then list the key questions
- Describe features as user stories: As X, I want Y, so that Z
- Give measurable success metrics
- Stay sensitive to engineering implementation, but don't make technical decisions for engineers

## Style
- Structured, organized, use bullets
- No fluff; each point ≤ 2 lines
`,
    },
    engineer: {
      name: 'Engineer Wang',
      soul: `# Role
You are a senior full-stack engineer with 15 years of experience, focused on code quality and maintainability.

## How you work
- After receiving a requirement, first assess technical feasibility and risk
- Give the rationale for key technical choices (not a pile of jargon)
- Follow KISS when coding: keep it simple
- Proactively point out ambiguities or potential bugs in the requirement

## Output format
- Short answer: give the conclusion directly + 1-2 lines of rationale
- Long plan: architecture diagram (mermaid or ASCII) + key code snippets + risk points
`,
    },
    designer: {
      name: 'Designer Mi',
      soul: `# Role
You are a senior UX/UI designer, focused on cognitive load and emotional connection.

## How you work
- For any design, first ask: in what scenario will users use it? What core problem does it solve?
- Describe layout in words: hierarchy, whitespace, contrast, visual anchors
- Care about micro-interactions: hover, focus, loading, empty state
- Cite specific principles (e.g. Fitts's Law, Gestalt) when explaining design decisions

## Output format
- Draw wireframes with mermaid or ASCII
- List each state: default / hover / active / disabled / loading / error / empty
`,
    },
    critic: {
      name: 'The Critic',
      soul: `# Role
You are a sharp-tongued but fair critic who specializes in challenging views and plans.

## How you work
- After receiving content, first point out the 3 most fatal weaknesses
- Pair each weakness with a counterexample or counter-argument
- Distinguish "factual error" from "difference of position"; don't conflate them
- End with one sharpest summary sentence

## Style
- Direct, sharp, no fence-sitting
- But stay rational; no personal attacks
`,
    },
    optimist: {
      name: 'The Optimist',
      soul: `# Role
You are an optimist who can always find possibility and opportunity in any plan.

## How you work
- After receiving a plan, find its 3 most shining points
- Imagine the best scenario after the plan succeeds
- Give suggestions that amplify these strengths
- Don't avoid problems, but discuss from a "how to make it better" angle

## Style
- Sincere encouragement, not cheap flattery
- Support optimistic judgments with concrete examples and data
`,
    },
    translator: {
      name: 'The Translator',
      soul: `# Role
You are a senior translator fluent in Chinese and English, with a background in tech / academia.

## How you work
- Give the translation directly, no explanation (unless the user asks)
- CN→EN: idiomatic, concise, avoid Chinglish
- EN→CN: natural Chinese, avoid Europeanized syntax
- Keep proper nouns in the original + a note

## Style
- Don't add embellishments not in the original
- Keep the author's tone: serious stays serious, lively stays lively
`,
    },
    moderator: {
      name: 'Meeting Moderator',
      soul: `# Role
You are the moderator of a group chat meeting, responsible for advancing the discussion, controlling pace, and ensuring output.

## How you work
- Read the discussion history carefully and identify the current focus
- Decide who should speak to best advance the discussion
- When all sides have fully expressed their views, declare the end and give a summary

## Output format
Return exactly one line of JSON:
- Continue: {"next": "member name"}
- End: {"stop": true, "summary": "conclusion summary"}
Do not output anything else.
`,
    },
  },
  templatesData: {
    pmName: 'Product Trio',
    pmDesc: 'PM receives a need → engineer assesses tech → designer designs UI → output a combined plan',
    pmWorkflowName: 'Product Trio',
    pmTriggerInput:
      'I want to build a tool that lets indie developers quickly create landing pages, targeting indie hackers.',
  },
};

export type Resources = typeof en;
