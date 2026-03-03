import type { AgentType } from './instance';

export interface TokenUsage {
  input: number;
  output: number;
  reasoning: number;
  cacheRead: number;
  cacheWrite: number;
  total: number;
}

export interface SessionCost {
  totalCost: number;
  modelID?: string;
  providerID?: string;
}

export interface Todo {
  content: string;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  priority: 'high' | 'medium' | 'low';
}

export interface McpTool {
  server: string;
  name: string;
}

export interface Session {
  id: string;
  title: string | null;
  status: 'active' | 'idle' | 'completed' | 'error' | 'compacting';
  createdAt: string;
  updatedAt: string;
  messageCount: number;
  tokens?: TokenUsage;
  cost?: SessionCost;
  /** The instance type that produced this session */
  instanceType?: AgentType;
  /** The instance ID that produced this session */
  instanceId?: string;
}

export interface ToolCall {
  id: string;
  name: string;
  input: Record<string, unknown>;
  output?: string;
  status: 'pending' | 'running' | 'completed' | 'error';
}

export interface SessionMessage {
  id: string;
  sessionId: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  /** Display name for the message author, e.g. model name or "User" */
  author?: string;
  content: string;
  createdAt: string;
  toolCalls?: ToolCall[];
  /** Model ID used for this message (assistant messages only) */
  modelID?: string;
}

export interface SessionListResponse {
  sessions: Session[];
  total: number;
}

export type PendingPromptStatus = 'pending' | 'processing' | 'delivered' | 'failed';

export interface PendingPrompt {
  id: string;
  content: string;
  status: PendingPromptStatus;
  isCommand: boolean;
  createdAt: string;
}

export interface SessionDetailResponse {
  session: Session;
  messages: SessionMessage[];
  todos?: Todo[];
  mcpTools?: McpTool[];
  /** Whether there are older messages available to load */
  hasMore?: boolean;
  /** The ID of the oldest message in the current page (use as `before` cursor) */
  oldestMessageId?: string | null;
  /** Total number of messages in the session (across all pages) */
  totalMessages?: number;
  /** Prompts sent from the Conduit dashboard, shown in the chat before the agent processes them */
  pendingPrompts?: PendingPrompt[];
}
