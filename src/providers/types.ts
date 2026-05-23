import type { McpServerConfig, Message, ToolCall, ToolDef } from '../types';

export interface StreamChunk {
  delta?: string;
  done: boolean;
  usage?: { input: number; output: number };
  /** Yielded once per tool call when the model is asking us to invoke a tool.
   *  After all toolCalls + done arrive, the caller is expected to run them
   *  and call `stream()` again with the updated `messages`. */
  toolCall?: ToolCall;
  /** Why the model stopped. `tool_use` signals tools should be executed. */
  finishReason?: 'stop' | 'tool_use' | 'length' | 'other';
}

export interface StreamOpts {
  model: string;
  systemPrompt: string;
  messages: Message[];
  temperature?: number;
  maxTokens?: number;
  signal?: AbortSignal;
  /** MCP servers; the Anthropic provider only honors `transport: 'remote'` here.
   *  `transport: 'local'` servers are handled upstream by the agent runner. */
  mcpServers?: McpServerConfig[];
  /** Tools the model may call. Provided by the agent runner after loading
   *  any local MCP servers. Provider returns `toolCall` chunks for these. */
  tools?: ToolDef[];
}

export interface ChatProvider {
  id: string;
  stream(opts: StreamOpts): AsyncIterable<StreamChunk>;
  /** Quick connectivity probe — returns true on success or throws with a useful message. */
  ping(): Promise<true>;
}

export class ProviderError extends Error {
  status?: number;
  body?: string;
  constructor(msg: string, opts?: { status?: number; body?: string }) {
    super(msg);
    this.status = opts?.status;
    this.body = opts?.body;
  }
}
