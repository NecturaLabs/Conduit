import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { ApiError, ApiSuccess } from '@conduit/shared';

// Strict UUID validation prevents injection and ensures instanceId is well-formed.
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const configSaveSchema = z.object({
  content: z.string().min(1).max(512_000, 'Config content exceeds 512 KB limit'),
  instanceId: z.string().regex(uuidPattern, 'instanceId must be a valid UUID').optional(),
});
import { requireAuth, requireCsrf } from '../middleware/auth.js';
import { resolveHookTokenUser } from '../middleware/hook-auth.js';
import { apiReadRateLimit, apiWriteRateLimit } from '../middleware/rateLimit.js';

// ── Shared helpers ─────────────────────────────────────────────────────────────

/** Returns the most-recently-updated config snapshot for the given instance type (or any), scoped to user. */
function getSnapshot(
  fastify: FastifyInstance,
  userId: string,
  instanceId?: string,
): { instance_id: string; agent_type: string; content: string; updated_at: string } | undefined {
  if (instanceId) {
    // Verify the instance belongs to this user
    return fastify.db
      .query(`SELECT cs.* FROM config_snapshots cs
              INNER JOIN instances i ON i.id = cs.instance_id
              WHERE cs.instance_id = ? AND i.user_id = ?`)
      .get(instanceId, userId) as { instance_id: string; agent_type: string; content: string; updated_at: string } | undefined;
  }
  return fastify.db
    .query(`SELECT cs.* FROM config_snapshots cs
            INNER JOIN instances i ON i.id = cs.instance_id
            WHERE i.user_id = ?
            ORDER BY cs.updated_at DESC LIMIT 1`)
    .get(userId) as { instance_id: string; agent_type: string; content: string; updated_at: string } | undefined;
}

/** Verify an instance exists and belongs to this user; return its id and type. */
function verifyInstance(
  fastify: FastifyInstance,
  userId: string,
  instanceId: string,
): { id: string; type: string } | undefined {
  return fastify.db
    .query(`SELECT id, type FROM instances WHERE id = ? AND user_id = ?`)
    .get(instanceId, userId) as { id: string; type: string } | undefined;
}

// ── Dashboard-facing routes ────────────────────────────────────────────────────

export async function configRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.addHook('preHandler', requireAuth);

  /**
   * GET /config
   * Returns the latest config snapshot stored by the agent, scoped to user.
   * Query param: ?instanceId=<uuid>  (optional — defaults to most-recently-updated)
   *
   * If the instance exists but has no config snapshot yet, returns a default
   * empty config so the model picker remains interactive.
   */
  fastify.get<{ Querystring: { instanceId?: string } }>(
    '/',
    { config: { rateLimit: apiReadRateLimit } },
    async (request, reply) => {
    const { instanceId } = request.query;
    const userId = request.user!.id;

    // Validate instanceId format before using it in queries
    if (instanceId && !uuidPattern.test(instanceId)) {
      const error: ApiError = {
        error: 'Validation Error',
        message: 'instanceId must be a valid UUID',
        statusCode: 400,
      };
      return reply.code(400).send(error);
    }

    const snapshot = getSnapshot(fastify, userId, instanceId);

    if (!snapshot) {
      // If a specific instance was requested and it exists, return a default
      // empty config rather than 404.  This lets the model picker remain
      // interactive even before the first config.sync arrives.
      // SECURITY: verifyInstance scopes to the authenticated userId — no
      // cross-user data leakage is possible. The instanceId only determines
      // whether we return an empty default vs 404, not access to another
      // user's data. codeql[js/user-controlled-bypass]
      if (instanceId) {
        const inst = verifyInstance(fastify, userId, instanceId);
        if (inst) {
          const response: ApiSuccess<{
            instanceId: string;
            agentType: string;
            content: unknown;
            updatedAt: string;
          }> = {
            data: {
              instanceId: inst.id,
              agentType: inst.type,
              content: {},
              updatedAt: new Date().toISOString(),
            },
          };
          return reply.code(200).send(response);
        }
      }

      const error: ApiError = {
        error: 'Not Available',
        message:
          'No configuration has been synced yet. ' +
          'Start a new Claude Code or OpenCode session to send the config to Conduit.',
        statusCode: 404,
      };
      return reply.code(404).send(error);
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(snapshot.content);
    } catch {
      parsed = snapshot.content;
    }

    const response: ApiSuccess<{
      instanceId: string;
      agentType: string;
      content: unknown;
      updatedAt: string;
    }> = {
      data: {
        instanceId: snapshot.instance_id,
        agentType: snapshot.agent_type,
        content: parsed,
        updatedAt: snapshot.updated_at.replace(' ', 'T').replace(/(?<!\d{3})Z?$/, 'Z'),
      },
    };
    return reply.code(200).send(response);
  });

  /**
   * PATCH /config
   * Saves an updated config (full JSON string) and queues it as a pending update
   * for the agent to pick up next time it starts.
   * Body: { content: string, instanceId?: string }
   *
   * If no config snapshot exists yet for the instance, one is created automatically.
   */
  fastify.patch(
    '/',
    { preHandler: [requireCsrf], config: { rateLimit: apiWriteRateLimit } },
    async (request, reply) => {
      const parsed = configSaveSchema.safeParse(request.body);
      if (!parsed.success) {
        const error: ApiError = {
          error: 'Validation Error',
          message: parsed.error.issues.map((i: { message: string }) => i.message).join(', '),
          statusCode: 400,
        };
        return reply.code(400).send(error);
      }

      // Validate JSON
      try {
        JSON.parse(parsed.data.content);
      } catch {
        const error: ApiError = {
          error: 'Validation Error',
          message: 'content must be valid JSON',
          statusCode: 400,
        };
        return reply.code(400).send(error);
      }

      const userId = request.user!.id;
      let snapshot = getSnapshot(fastify, userId, parsed.data.instanceId);

      // If no snapshot exists but a valid instanceId was provided, create one on the fly
      if (!snapshot && parsed.data.instanceId) {
        const inst = verifyInstance(fastify, userId, parsed.data.instanceId);
        if (inst) {
          fastify.db.query(`
            INSERT INTO config_snapshots (instance_id, agent_type, content, updated_at)
            VALUES (?, ?, ?, datetime('now'))
            ON CONFLICT(instance_id) DO UPDATE SET
              content    = excluded.content,
              agent_type = excluded.agent_type,
              updated_at = datetime('now')
          `).run(inst.id, inst.type, parsed.data.content);
          snapshot = { instance_id: inst.id, agent_type: inst.type, content: parsed.data.content, updated_at: new Date().toISOString() };
        }
      }

      if (!snapshot) {
        const error: ApiError = {
          error: 'Not Found',
          message: 'No config snapshot found for this instance. Start a session first.',
          statusCode: 404,
        };
        return reply.code(404).send(error);
      }

      const instanceId = parsed.data.instanceId ?? snapshot.instance_id;

      // Update the snapshot immediately so the dashboard reflects the change
      fastify.db.query(`
        UPDATE config_snapshots
        SET content = ?, updated_at = datetime('now')
        WHERE instance_id = ?
      `).run(parsed.data.content, instanceId);

      // Queue the update for the agent to pick up
      fastify.db.query(`
        INSERT INTO config_pending (instance_id, content, queued_at)
        VALUES (?, ?, datetime('now'))
        ON CONFLICT(instance_id) DO UPDATE SET
          content   = excluded.content,
          queued_at = datetime('now')
      `).run(instanceId, parsed.data.content);

      const response: ApiSuccess<{ message: string; instanceId: string }> = {
        data: {
          message: 'Configuration queued — the agent will apply it on next startup.',
          instanceId,
        },
      };
      return reply.code(200).send(response);
    },
  );

  /**
   * GET /config/instances
   * List all instances that have synced a config (so the UI can show a picker), scoped to user.
   */
  fastify.get('/instances', { config: { rateLimit: apiReadRateLimit } }, async (request, reply) => {
    const userId = request.user!.id;
    const rows = fastify.db.query(`
      SELECT cs.instance_id, cs.agent_type, cs.updated_at, i.name
      FROM config_snapshots cs
      INNER JOIN instances i ON i.id = cs.instance_id
      WHERE i.user_id = ?
      ORDER BY cs.updated_at DESC
    `).all(userId) as Array<{ instance_id: string; agent_type: string; updated_at: string; name: string }>;

    const response: ApiSuccess<{ instances: typeof rows }> = { data: { instances: rows } };
    return reply.code(200).send(response);
  });
}

// ── Agent-facing routes (bearer-token auth, no session/CSRF) ──────────────────

export async function configAgentRoutes(fastify: FastifyInstance): Promise<void> {
  /**
   * GET /config/pending
   * Called by the CLI agent to check if a dashboard-queued update is waiting.
   * Returns { data: { content: string, instanceId: string } } or 204 if nothing pending.
   *
   * Scoping (most-specific wins):
   *   ?instanceId=<uuid>  — return pending only for that exact instance
   *   ?sessionId=<id>     — resolve the instance via hook_events for that session, then filter
   *   (none)              — return oldest pending across ALL of the user's instances (legacy fallback)
   *
   * The caller should always pass one of the above so multi-machine users
   * don't receive each other's pending config updates.
   */
  fastify.get<{ Querystring: { instanceId?: string; sessionId?: string } }>(
    '/pending',
    async (request, reply) => {
      const resolution = resolveHookTokenUser(request);
      if (!resolution) {
        return reply.code(401).send({ error: 'Unauthorized', message: 'Invalid token', statusCode: 401 });
      }

      const hookUserId = resolution.userId;
      const { instanceId: qInstanceId, sessionId: qSessionId } = request.query;

      let row: { instance_id: string; content: string } | undefined;

      if (hookUserId) {
        // Resolve target instance_id from the most specific hint available
        let targetInstanceId: string | undefined = qInstanceId;

        if (!targetInstanceId && qSessionId) {
          // Look up the instance that last sent events for this session
          const sessionInstance = fastify.db.query(
            `SELECT instance_id FROM hook_events
             WHERE session_id = ?
               AND instance_id IN (SELECT id FROM instances WHERE user_id = ?)
             ORDER BY received_at DESC LIMIT 1`,
          ).get(qSessionId, hookUserId) as { instance_id: string } | undefined;
          targetInstanceId = sessionInstance?.instance_id;
        }

        if (targetInstanceId) {
          // Exact instance match — only return pending for that instance
          row = fastify.db.query(
            `SELECT cp.instance_id, cp.content
             FROM config_pending cp
             INNER JOIN instances i ON i.id = cp.instance_id
             WHERE cp.instance_id = ? AND i.user_id = ?`,
          ).get(targetInstanceId, hookUserId) as { instance_id: string; content: string } | undefined;
        } else {
          // No instance hint — legacy fallback: oldest pending across all of the user's instances
          row = fastify.db.query(
            `SELECT cp.instance_id, cp.content
             FROM config_pending cp
             INNER JOIN instances i ON i.id = cp.instance_id
             WHERE i.user_id = ?
             ORDER BY cp.queued_at ASC LIMIT 1`,
          ).get(hookUserId) as { instance_id: string; content: string } | undefined;
        }
      } else {
        // Legacy global token — return the oldest pending entry regardless
        row = fastify.db.query(
          `SELECT instance_id, content FROM config_pending ORDER BY queued_at ASC LIMIT 1`,
        ).get() as { instance_id: string; content: string } | undefined;
      }

      if (!row) {
        return reply.code(204).send();
      }

      const response: ApiSuccess<{ content: string; instanceId: string }> = {
        data: { content: row.content, instanceId: row.instance_id },
      };
      return reply.code(200).send(response);
    },
  );

  /**
   * POST /config/ack
   * Called by the CLI agent after successfully applying a pending config update.
   * Body: { instanceId?: string }
   *
   * If instanceId is provided (and owned by this user) only that instance's
   * pending row is removed.  Without it, all of the user's pending rows are
   * cleared (legacy behaviour — kept for backward compat with older hook scripts).
   */
  fastify.post('/ack', async (request, reply) => {
    const resolution = resolveHookTokenUser(request);
    if (!resolution) {
      return reply.code(401).send({ error: 'Unauthorized', message: 'Invalid token', statusCode: 401 });
    }

    const hookUserId = resolution.userId;
    const body = request.body as { instanceId?: string } | null;
    const instanceId = typeof body?.instanceId === 'string' ? body.instanceId : undefined;

    if (hookUserId) {
      if (instanceId) {
        // Delete only the specific instance's pending row (most precise)
        fastify.db.query(
          `DELETE FROM config_pending
           WHERE instance_id = ?
             AND instance_id IN (SELECT id FROM instances WHERE user_id = ?)`,
        ).run(instanceId, hookUserId);
      } else {
        // Legacy fallback: clear all pending for the user's instances
        fastify.db.query(
          `DELETE FROM config_pending WHERE instance_id IN (SELECT id FROM instances WHERE user_id = ?)`,
        ).run(hookUserId);
      }
    } else {
      // Legacy global token — delete all (old behavior)
      fastify.db.query(`DELETE FROM config_pending`).run();
    }

    return reply.code(200).send({ data: { acknowledged: true } });
  });
}
