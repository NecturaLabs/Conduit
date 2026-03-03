import { config } from '../config.js';
import { resolveAndValidateUrl } from './url-validation.js';
import type {
  Session,
  SessionDetailResponse,
  SessionListResponse,
  SessionMessage,
  ConfigListResponse,
  ConfigUpdateResponse,
} from '@conduit/shared';

interface OpenCodeError {
  message: string;
  statusCode?: number;
}

async function request<T>(
  path: string,
  options: RequestInit = {},
  baseUrl?: string,
): Promise<T> {
  const base = baseUrl ?? config.opencodeUrl;
  const url = `${base}${path}`;

  // SSRF protection: validate that the target URL is not a private/internal address
  // when a user-supplied baseUrl is provided (e.g. from instance registration).
  // resolveAndValidateUrl also checks the DNS-resolved IP to defeat DNS rebinding.
  if (baseUrl) {
    await resolveAndValidateUrl(url);
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> ?? {}),
  };

  // SECURITY: Only send opencodePassword to the configured opencodeUrl, NEVER to
  // user-supplied baseUrls. Sending credentials to attacker-controlled URLs would
  // leak the password. See OWASP credential leakage guidelines.
  if (config.opencodePassword && !baseUrl) {
    headers['Authorization'] = `Bearer ${config.opencodePassword}`;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);

  // Server-to-server call to OpenCode API — URL from server config, not user input.
  const response = await fetch(url, { // codeql[js/file-access-to-http] — server-to-server; URL from server config
    ...options,
    headers,
    signal: options.signal ?? controller.signal,
  });
  clearTimeout(timeout);

  if (!response.ok) {
    let errorMessage = `OpenCode API error: ${response.status} ${response.statusText}`;
    try {
      const body = await response.json() as OpenCodeError;
      if (body.message) {
        errorMessage = body.message;
      }
    } catch {
      // Use default error message
    }
    const err = new Error(errorMessage) as Error & { statusCode: number };
    err.statusCode = response.status;
    throw err;
  }

  return response.json() as Promise<T>;
}

interface RawSession {
  id: string;
  title?: string | null;
  parentID?: string | null;
  time?: { created?: number; updated?: number };
}

function mapRawSession(raw: RawSession): Session {
  const createdMs = raw.time?.created ?? Date.now();
  const updatedMs = raw.time?.updated ?? createdMs;
  return {
    id: raw.id,
    title: raw.title ?? null,
    status: 'idle',
    createdAt: new Date(createdMs).toISOString(),
    updatedAt: new Date(updatedMs).toISOString(),
    messageCount: 0,
  };
}

export async function listSessions(
  page = 1,
  limit = 20,
  baseUrl?: string,
): Promise<SessionListResponse> {
  const raw = await request<RawSession[]>('/session', {}, baseUrl);
  const filtered = raw.filter((s) => !s.parentID);
  const total = filtered.length;
  const start = (page - 1) * limit;
  const paginated = filtered.slice(start, start + limit).map(mapRawSession);
  return { sessions: paginated, total };
}

// ---------------------------------------------------------------------------
// OpenCode message types — matches sst/opencode Message.Info shape
// ---------------------------------------------------------------------------

interface RawToolInvocation {
  state: 'call' | 'partial-call' | 'result';
  step?: number;
  toolCallId: string;
  toolName: string;
  args: unknown;
  result?: string;
}

type RawMessagePart =
  | { type: 'text'; text: string }
  | { type: 'reasoning'; text: string }
  | { type: 'tool-invocation'; toolInvocation: RawToolInvocation }
  | { type: 'source-url'; url: string; title?: string }
  | { type: 'file'; mediaType: string; filename?: string; url: string }
  | { type: 'step-start' }
  | { type: string; [k: string]: unknown };

interface RawMessage {
  id: string;
  role: 'user' | 'assistant';
  parts: RawMessagePart[];
  metadata: {
    time: { created: number; completed?: number };
    sessionID: string;
    tool?: Record<string, { title: string; time: { start: number; end: number }; [k: string]: unknown }>;
    assistant?: {
      modelID: string;
      providerID: string;
      cost: number;
      tokens: { input: number; output: number; reasoning: number; cache: { read: number; write: number } };
      summary?: boolean;
    };
    error?: { name: string; message?: string; [k: string]: unknown };
  };
}

/**
 * Map a single OpenCode RawMessage into one or more SessionMessages.
 *
 * Strategy:
 * - Collect all text/reasoning parts into one assistant/user bubble.
 * - Each tool-invocation part with state "result" becomes its own tool bubble
 *   (showing the tool name + formatted input/output).
 * - Partial-call / call parts without a result are folded into the parent
 *   bubble as toolCalls chips.
 */
function mapRawMessage(m: RawMessage, sessionId: string): SessionMessage[] {
  const createdAt = new Date(m.metadata.time.created).toISOString();
  const modelID = m.metadata.assistant?.modelID;
  const author = m.role === 'user' ? 'User' : (modelID ?? 'Claude');

  // Collect text content
  const textParts: string[] = [];
  // Completed tool invocations → become separate tool bubbles
  const toolBubbles: SessionMessage[] = [];
  // Pending/partial tool calls → chips on the parent bubble
  const pendingToolCalls: SessionMessage['toolCalls'] = [];

  for (const part of m.parts ?? []) {
    if (part.type === 'text' || part.type === 'reasoning') {
      const text = (part as { text: string }).text.trim();
      if (text) textParts.push(text);
    } else if (part.type === 'tool-invocation') {
      const inv = (part as { type: 'tool-invocation'; toolInvocation: RawToolInvocation }).toolInvocation;
      const toolMeta = m.metadata.tool?.[inv.toolCallId];
      const toolTitle = toolMeta?.title ?? inv.toolName;

      if (inv.state === 'result') {
        // Format input args as readable content
        const inputStr = typeof inv.args === 'string'
          ? inv.args
          : JSON.stringify(inv.args, null, 2);
        const outputStr = inv.result ?? '';
        const content = [
          inputStr ? `Input:\n${inputStr}` : '',
          outputStr ? `Output:\n${outputStr}` : '',
        ].filter(Boolean).join('\n\n');

        toolBubbles.push({
          id: `${m.id}-${inv.toolCallId}`,
          sessionId,
          role: 'tool',
          author: toolTitle,
          content: content || '(no output)',
          createdAt,
        });
      } else {
        // call / partial-call — show as a chip
        pendingToolCalls.push({
          id: inv.toolCallId,
          name: toolTitle,
          input: (typeof inv.args === 'object' && inv.args !== null ? inv.args : {}) as Record<string, unknown>,
          status: inv.state === 'partial-call' ? 'running' : 'pending',
        });
      }
    }
    // step-start, source-url, file — ignored for now
  }

  const results: SessionMessage[] = [];

  // Main text bubble (only if there's something to show, or if there are pending chips)
  const mainContent = textParts.join('\n\n');
  if (mainContent || pendingToolCalls.length) {
    results.push({
      id: m.id,
      sessionId,
      role: m.role,
      author,
      content: mainContent,
      createdAt,
      toolCalls: pendingToolCalls.length ? pendingToolCalls : undefined,
    });
  }

  // Tool result bubbles follow the parent
  results.push(...toolBubbles);

  return results;
}

export async function getSession(id: string, baseUrl?: string): Promise<SessionDetailResponse> {
  const session = await request<RawSession>(`/session/${encodeURIComponent(id)}`, {}, baseUrl);
  const rawMessages = await request<RawMessage[]>(`/session/${encodeURIComponent(id)}/message`, {}, baseUrl);

  const messages: SessionMessage[] = rawMessages.flatMap((m) => mapRawMessage(m, id));

  return {
    session: mapRawSession(session),
    messages,
  };
}

export async function createSession(title?: string, baseUrl?: string): Promise<Session> {
  const raw = await request<RawSession>('/session', {
    method: 'POST',
    body: JSON.stringify({ title: title ?? null }),
  }, baseUrl);
  return mapRawSession(raw);
}

export async function deleteSession(id: string, baseUrl?: string): Promise<void> {
  await request<void>(`/session/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  }, baseUrl);
}

export async function getConfig(baseUrl?: string): Promise<ConfigListResponse> {
  return request<ConfigListResponse>('/config', {}, baseUrl);
}

export async function updateConfig(
  key: string,
  value: unknown,
  baseUrl?: string,
): Promise<ConfigUpdateResponse> {
  return request<ConfigUpdateResponse>('/config', {
    method: 'PATCH',
    body: JSON.stringify({ key, value }),
  }, baseUrl);
}

export async function subscribeToEvents(
  onEvent: (event: string, data: string) => void,
  signal?: AbortSignal,
  baseUrl?: string,
): Promise<void> {
  const base = baseUrl ?? config.opencodeUrl;
  const url = `${base}/events`;

  // SSRF protection: validate user-supplied baseUrl (static + DNS rebinding check)
  if (baseUrl) {
    await resolveAndValidateUrl(url);
  }

  const headers: Record<string, string> = {
    Accept: 'text/event-stream',
  };

  // SECURITY: Only send opencodePassword to the configured opencodeUrl (see request() above)
  if (config.opencodePassword && !baseUrl) {
    headers['Authorization'] = `Bearer ${config.opencodePassword}`;
  }

  const response = await fetch(url, { headers, signal }); // codeql[js/file-access-to-http] — server-to-server; URL from server config

  if (!response.ok || !response.body) {
    throw new Error(`Failed to connect to OpenCode SSE: ${response.status}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      let currentEvent = 'message';
      let currentData = '';

      for (const line of lines) {
        if (line.startsWith('event: ')) {
          currentEvent = line.slice(7).trim();
        } else if (line.startsWith('data: ')) {
          currentData = line.slice(6);
        } else if (line === '' && currentData) {
          onEvent(currentEvent, currentData);
          currentEvent = 'message';
          currentData = '';
        }
      }
    }
  } catch (err) {
    if (signal?.aborted) return;
    throw err;
  }
}

/**
 * Health check — used for periodic instance status polling.
 * Returns true if OpenCode responds OK to /global/health.
 */
/**
 * Send a message to an active OpenCode session asynchronously (fire-and-forget).
 * Uses POST /session/:id/prompt_async which returns 204 and does not wait for
 * the model response — ideal for real-time remote prompt injection.
 */
export async function sendMessage(
  sessionId: string,
  content: string,
  baseUrl?: string,
): Promise<void> {
  const base = baseUrl ?? config.opencodeUrl;
  const url = `${base}/session/${encodeURIComponent(sessionId)}/prompt_async`;

  if (baseUrl) {
    await resolveAndValidateUrl(url);
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (config.opencodePassword && !baseUrl) {
    headers['Authorization'] = `Bearer ${config.opencodePassword}`;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);

  const response = await fetch(url, { // codeql[js/file-access-to-http] — server-to-server; URL from server config
    method: 'POST',
    headers,
    body: JSON.stringify({
      parts: [{ type: 'text', text: content }],
    }),
    signal: controller.signal,
  });
  clearTimeout(timeout);

  if (!response.ok && response.status !== 204) {
    let errorMessage = `OpenCode sendMessage error: ${response.status} ${response.statusText}`;
    try {
      const body = await response.json() as OpenCodeError;
      if (body.message) errorMessage = body.message;
    } catch { /* use default */ }
    const err = new Error(errorMessage) as Error & { statusCode: number };
    err.statusCode = response.status;
    throw err;
  }
}

/**
 * Execute a slash command in an active OpenCode session.
 * Uses POST /session/:id/command which runs a built-in command like /compact, /cost, /clear.
 */
export async function sendCommand(
  sessionId: string,
  command: string,
  args: string,
  baseUrl?: string,
): Promise<void> {
  const base = baseUrl ?? config.opencodeUrl;
  const url = `${base}/session/${encodeURIComponent(sessionId)}/command`;

  if (baseUrl) {
    await resolveAndValidateUrl(url);
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (config.opencodePassword && !baseUrl) {
    headers['Authorization'] = `Bearer ${config.opencodePassword}`;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);

  const response = await fetch(url, { // codeql[js/file-access-to-http] — server-to-server; URL from server config
    method: 'POST',
    headers,
    body: JSON.stringify({ command, arguments: args }),
    signal: controller.signal,
  });
  clearTimeout(timeout);

  if (!response.ok && response.status !== 204) {
    let errorMessage = `OpenCode sendCommand error: ${response.status} ${response.statusText}`;
    try {
      const body = await response.json() as OpenCodeError;
      if (body.message) errorMessage = body.message;
    } catch { /* use default */ }
    const err = new Error(errorMessage) as Error & { statusCode: number };
    err.statusCode = response.status;
    throw err;
  }
}

// Minimal shape we care about from OpenCode's GET /provider response
interface OpenCodeProviderModel {
  id: string;
  name: string;
}
interface OpenCodeProvider {
  id: string;
  name: string;
  models: Record<string, OpenCodeProviderModel>;
}
interface OpenCodeProviderResponse {
  all: OpenCodeProvider[];
  connected: string[];
}

/**
 * Fetch the list of providers (and their models) from an OpenCode instance.
 * Returns only the connected providers — those the user has actually configured
 * with credentials — so the model list reflects what is actually usable.
 */
export async function getProviders(baseUrl: string): Promise<OpenCodeProvider[]> {
  const data = await request<OpenCodeProviderResponse>('/provider', {}, baseUrl);
  const connected = new Set(data.connected);
  return data.all.filter(p => connected.has(p.id));
}

export async function checkHealth(baseUrl: string): Promise<{ healthy: boolean; latency: number }> {
  const start = Date.now();
  try {
    // SSRF protection: validate the target URL (static + DNS rebinding check)
    await resolveAndValidateUrl(`${baseUrl}/global/health`);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const response = await fetch(`${baseUrl}/global/health`, { // codeql[js/file-access-to-http] — server-to-server health check; URL from server config
      signal: controller.signal,
    });
    clearTimeout(timeout);
    const latency = Date.now() - start;
    return { healthy: response.ok, latency };
  } catch {
    return { healthy: false, latency: Date.now() - start };
  }
}
