import type { Node, Edge } from '@xyflow/react';

export type ProviderId =
  | 'openai'
  | 'anthropic'
  | 'ollama'
  | 'openrouter'
  | 'lmstudio';

export type NodeType =
  | 'agent'
  | 'trigger'
  | 'room'
  | 'aggregator'
  | 'router'
  | 'output'
  | 'discuss';

export type EdgeType =
  | 'assign'
  | 'report'
  | 'broadcast'
  | 'pipe'
  | 'topic'
  | 'manage';

export interface McpServerConfig {
  id: string;
  enabled: boolean;
  /** 显示名 */
  name: string;
  /** MCP server URL */
  url: string;
  /** remote = 让 Anthropic 服务器去连（仅 Anthropic provider 生效，URL 必须公网可达）
   *  local  = 浏览器直接连（所有 provider 通用，但 server 必须允许 CORS） */
  transport: 'remote' | 'local';
  /** 可选鉴权 token */
  authorizationToken?: string;
  /** 留空 = 启用全部工具；填了只启用列表里的 */
  allowedTools?: string[];
}

/** A single text file in an agent's private knowledge base. */
export interface KbFile {
  id: string;
  name: string;
  content: string;
}

/** Per-agent knowledge base. `inline` is always prepended to the system
 *  prompt; `files` are exposed to the agent via kb_list / kb_read /
 *  kb_search tools so it pulls them on demand. */
export interface AgentKnowledge {
  inline?: string;
  files?: KbFile[];
}

export interface AgentNodeData extends Record<string, unknown> {
  kind: 'agent';
  name: string;
  avatar: string;
  soul: string;
  provider: ProviderId;
  model: string;
  temperature: number;
  maxTokens: number;
  memory: 'none' | 'session';
  mcpServers?: McpServerConfig[];
  /** Optional private knowledge base for this agent. */
  knowledge?: AgentKnowledge;
}

export interface TriggerNodeData extends Record<string, unknown> {
  kind: 'trigger';
  name: string;
  input: string;
}

export interface RoomNodeData extends Record<string, unknown> {
  kind: 'room';
  name: string;
  mode: 'round-robin' | 'moderator' | 'race';
  moderatorId?: string;
  maxRounds: number;
  /** moderator 模式：每个非主持人成员至少发言这么多次后，主持人 stop 才有效 */
  minTurnsPerSpeaker?: number;
  /** 主持人模式下用的指令模板 */
  moderatorPrompt?: string;
  /** 终止关键词，主持人/任意发言包含即停 */
  stopKeyword?: string;
}

export interface AggregatorNodeData extends Record<string, unknown> {
  kind: 'aggregator';
  name: string;
  strategy: 'concat' | 'json-merge' | 'pick-first' | 'summarize';
  /** summarize: provider + model + custom instruction for the summarizing agent. */
  provider?: ProviderId;
  model?: string;
  prompt?: string;
}

export interface RouterNodeData extends Record<string, unknown> {
  kind: 'router';
  name: string;
  rule: 'llm-judge' | 'regex';
  pattern: string;
  /** llm-judge: the criterion that sends the input down branch a (else b). */
  prompt?: string;
  /** llm-judge: provider + model used to make the decision. */
  provider?: ProviderId;
  model?: string;
}

export interface OutputNodeData extends Record<string, unknown> {
  kind: 'output';
  name: string;
}

/** A node that pauses execution and lets the user chat with an AI until they
 *  click "完成". The final output going downstream is either the last AI
 *  reply, or text the user types into the "结论" box on finishing. */
export interface DiscussNodeData extends Record<string, unknown> {
  kind: 'discuss';
  name: string;
  avatar: string;
  /** System prompt for the AI partner in the discussion */
  soul: string;
  provider: ProviderId;
  model: string;
  temperature: number;
  maxTokens: number;
  /** Opening hint: how should the AI open the conversation once it sees the
   *  upstream input? (Templated, can use {{input}}.) */
  openingPrompt: string;
}

export type AnyNodeData =
  | AgentNodeData
  | TriggerNodeData
  | RoomNodeData
  | AggregatorNodeData
  | RouterNodeData
  | OutputNodeData
  | DiscussNodeData;

export type FlowNode = Node<AnyNodeData, NodeType>;

export interface EdgeData extends Record<string, unknown> {
  type: EdgeType;
  label?: string;
  transform?: string;
}

export type FlowEdge = Edge<EdgeData>;

export interface Workflow {
  id: string;
  name: string;
  nodes: FlowNode[];
  edges: FlowEdge[];
  variables: Record<string, string>;
  createdAt: number;
  updatedAt: number;
}

export interface ToolCall {
  id: string;
  name: string;
  /** JSON-stringified arguments */
  arguments: string;
}

export interface Message {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  /** Only set on `assistant` messages that requested tool calls. */
  toolCalls?: ToolCall[];
  /** Required for `tool` role; ID of the call this is a response to. */
  toolCallId?: string;
  /** Required for `tool` role; human-readable name (for Anthropic schema). */
  toolName?: string;
}

export interface ToolDef {
  name: string;
  description?: string;
  /** JSON Schema for the input */
  inputSchema: Record<string, unknown>;
}

export interface NodeRunState {
  status: 'idle' | 'queued' | 'running' | 'done' | 'error' | 'skipped';
  output: string;
  error?: string;
  startedAt?: number;
  finishedAt?: number;
  tokensIn?: number;
  tokensOut?: number;
}
