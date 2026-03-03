import type { Session, SessionMessage, ToolCall } from './session.js';

export type SSEEventType =
  | 'session.created'
  | 'session.updated'
  | 'session.deleted'
  | 'session.idle'
  | 'session.error'
  | 'session.compacting'
  | 'session.compacted'
  | 'message.created'
  | 'message.updated'
  | 'message.completed'
  | 'message.part.updated'
  | 'tool.started'
  | 'tool.completed'
  | 'tool.execute.after'
  | 'todo.updated'
  | 'mcp.tools.changed'
  | 'config.updated'
  | 'config.sync'
  | 'instance.updated'
  | 'connected'
  | 'heartbeat';

export interface SSEEvent<T> {
  type: SSEEventType;
  data: T;
  timestamp: string;
  id: string;
}

export type SessionEvent = SSEEvent<{ session: Session }>;

export type MessageEvent = SSEEvent<{ message: SessionMessage }>;

export type ToolEvent = SSEEvent<{ toolCall: ToolCall; sessionId: string }>;

export type ConfigEvent = SSEEvent<{ key: string; value: unknown }>;

export type HeartbeatEvent = SSEEvent<null>;
