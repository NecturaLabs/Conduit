import type { FastifyInstance } from 'fastify';
import type { ApiError, ApiSuccess } from '@conduit/shared';
import { requireHookToken } from '../middleware/hook-auth.js';
import { sanitizeEventType, encodeSSEData } from '../lib/sse.js';
import { EventBus } from '../services/eventbus.js';

// SECURITY: Limit concurrent prompt SSE connections per user (identified by hook token user).
// Prevents resource exhaustion if a misconfigured or malicious plugin opens many streams.
const MAX_PROMPT_SSE_PER_USER = 5;
const promptSseConnectionCounts = new Map<string, number>();

// ---------------------------------------------------------------------------
// Prompt event bus — broadcasts prompt events to connected MCP server SSE clients
// Uses the shared EventBus class instead of a duplicated PromptBus.
// ---------------------------------------------------------------------------

/** Singleton prompt bus — import in sessions.ts to emit prompt.queued events */
export const promptBus = new EventBus();

/**
 * Prompt relay endpoints — called by the plugin (hook-token auth, no CSRF).
 *
 * GET  /prompts/pending   — returns all pending prompts for the plugin to relay
 * GET  /prompts/stream    — SSE stream that pushes prompt.queued events in real-time
 * POST /prompts/:id/ack   — marks a prompt as delivered (or failed)
 *
 * All queries are scoped to the user's instances via hookTokenUserId.
 */
export async function promptRelayRoutes(fastify: FastifyInstance): Promise<void> {
  // Auth: require hook token (same as instance registration)
  fastify.addHook('preHandler', requireHookToken);

  // GET /prompts/pending — return all pending prompts, atomically marking them as 'processing'
  // This prevents duplicate delivery when multiple callers (SSE handler, idle handler) race.
  // Scoped to user's instances via session_id → hook_events → instance → user.
  fastify.get('/pending', async (request, reply) => {
    const db = fastify.db;
    const hookUserId = request.hookTokenUserId;

    let rows: Array<{ id: string; session_id: string; content: string; is_command: number; command_name: string | null; created_at: string }>;

    if (hookUserId) {
      // Scope directly by user_id stored on the prompt row — no fragile hook_events join
      rows = db.query(
        `SELECT pp.id, pp.session_id, pp.content, pp.is_command, pp.command_name, pp.created_at
         FROM pending_prompts pp
         WHERE pp.status = 'pending'
           AND pp.user_id = ?
         ORDER BY pp.created_at ASC`,
      ).all(hookUserId) as typeof rows;
    } else {
      // Legacy global token — return all pending prompts
      rows = db.query(
        `SELECT id, session_id, content, is_command, command_name, created_at FROM pending_prompts WHERE status = 'pending' ORDER BY created_at ASC`,
      ).all() as typeof rows;
    }

    if (rows.length > 0) {
      const ids = rows.map((r) => r.id);
      // Mark all as processing so a concurrent call won't pick them up
      const placeholders = ids.map(() => '?').join(',');
      db.query(`UPDATE pending_prompts SET status = 'processing' WHERE id IN (${placeholders})`).run(...ids);
    }

    const prompts = rows.map((r) => ({
      id: r.id,
      sessionId: r.session_id,
      content: r.content,
      isCommand: r.is_command === 1,
      commandName: r.command_name,
      createdAt: r.created_at,
    }));

    const response: ApiSuccess<typeof prompts> = {
      data: prompts,
    };
    return reply.code(200).send(response);
  });

  // GET /prompts/stream — SSE stream for MCP server to receive prompt events in real-time
  // Scoped: only forwards events for sessions belonging to this user's instances
  fastify.get('/stream', async (request, reply) => {
    const hookUserId = request.hookTokenUserId;

    // Enforce per-user connection limit (use hookUserId, or 'global' for legacy tokens)
    const connKey = hookUserId ?? 'global';
    const currentConns = promptSseConnectionCounts.get(connKey) ?? 0;
    if (currentConns >= MAX_PROMPT_SSE_PER_USER) {
      const error: ApiError = {
        error: 'Too Many Requests',
        message: 'Too many concurrent prompt stream connections',
        statusCode: 429,
      };
      return reply.code(429).send(error);
    }
    promptSseConnectionCounts.set(connKey, currentConns + 1);

    // SSE streams must not be killed by the global requestTimeout
    request.raw.setTimeout(0);

    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    });

    // Send initial connected event
    reply.raw.write(`event: connected\n${encodeSSEData(JSON.stringify({ message: 'Prompt stream connected' }))}\n\n`);

    // Subscribe to prompt events
    const unsubscribe = promptBus.subscribe((eventType: string, data: string) => {
      try {
        // Filter by user_id embedded in the emitted event payload
        if (hookUserId) {
          const parsed = JSON.parse(data) as Record<string, unknown>;
          if (parsed.userId !== hookUserId) return;
        }
        reply.raw.write(`event: ${sanitizeEventType(eventType)}\n${encodeSSEData(data)}\n\n`);
      } catch {
        unsubscribe();
      }
    });

    // Heartbeat every 30 seconds
    const heartbeat = setInterval(() => {
      try {
        reply.raw.write(`:heartbeat\n\n`);
      } catch {
        clearInterval(heartbeat);
        unsubscribe();
      }
    }, 30_000);

    // Clean up on disconnect
    request.raw.on('close', () => {
      clearInterval(heartbeat);
      unsubscribe();
      const count = promptSseConnectionCounts.get(connKey) ?? 1;
      if (count <= 1) {
        promptSseConnectionCounts.delete(connKey);
      } else {
        promptSseConnectionCounts.set(connKey, count - 1);
      }
    });
  });

  // POST /prompts/:id/ack — mark a prompt as delivered or failed
  // Scoped: verify the prompt belongs to this user's sessions
  fastify.post<{ Params: { id: string }; Body: { status?: string; error?: string } }>(
    '/:id/ack',
    async (request, reply) => {
      const { id } = request.params;
      const hookUserId = request.hookTokenUserId;
      const body = request.body as { status?: string; error?: string } | null;
      const newStatus = body?.status === 'failed' ? 'failed' : 'delivered';

      let existing: { id: string } | undefined;
      if (hookUserId) {
        // Verify the prompt belongs to this user via the stored user_id column
        existing = fastify.db
          .query(
            `SELECT id FROM pending_prompts WHERE id = ? AND user_id = ?`,
          )
          .get(id, hookUserId) as { id: string } | undefined;
      } else {
        existing = fastify.db
          .query(`SELECT id FROM pending_prompts WHERE id = ?`)
          .get(id) as { id: string } | undefined;
      }

      if (!existing) {
        const error: ApiError = { error: 'Not Found', message: 'Prompt not found', statusCode: 404 };
        return reply.code(404).send(error);
      }

      // Update status (keep the row so the frontend can see the final state)
      fastify.db.query(`UPDATE pending_prompts SET status = ? WHERE id = ?`).run(newStatus, id);

      const response: ApiSuccess<{ message: string }> = {
        data: { message: `Prompt ${newStatus}` },
      };
      return reply.code(200).send(response);
    },
  );
}
