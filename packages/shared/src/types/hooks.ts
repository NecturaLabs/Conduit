export type ClaudeHookEventType =
  | 'SessionStart'
  | 'UserPromptSubmit'
  | 'PreToolUse'
  | 'PostToolUse'
  | 'Stop'
  | 'SubagentStart'
  | 'SubagentStop'
  | 'TaskCompleted'
  | 'SessionEnd';

export type OpenCodeEventType =
  | 'session.created'
  | 'session.updated'
  | 'session.idle'
  | 'session.error'
  | 'message.updated'
  | 'message.part.updated'
  | 'tool.execute.after'
  | 'config.sync'    // Sent by both agents on startup with the local config file content
  | 'models.sync';  // Sent by OpenCode plugin on startup with available model list

/** @deprecated Use ClaudeHookEventType | OpenCodeEventType */
export type HookEventType = ClaudeHookEventType | OpenCodeEventType;

export interface HookPayload {
  event: HookEventType;
  timestamp: string;
  sessionId: string;
  data: Record<string, unknown>;
}

export interface HookResponse {
  received: boolean;
  id: string;
}
