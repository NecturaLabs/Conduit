/**
 * Periodic database cleanup service.
 *
 * Removes expired/stale data that is no longer needed:
 * - Expired magic link tokens (past expires_at)
 * - Expired OAuth state tokens (past expires_at — these are consumed atomically
 *   on use but any abandoned flows leave rows that must be pruned)
 * - Expired revoked access tokens (past expires_at, no longer needed for revocation checks)
 * - Used/revoked refresh tokens older than 30 days
 * - Hook events older than 30 days
 * - Failed pending prompts older than 7 days
 *
 * Runs every hour to keep the SQLite database lean.
 */

import type { Database } from 'bun:sqlite';

const CLEANUP_INTERVAL_MS = 60 * 60 * 1000; // 1 hour

let cleanupInterval: ReturnType<typeof setInterval> | null = null;

function runCleanup(db: Database, log?: { info: (msg: string) => void; error: (msg: string, ...args: unknown[]) => void }): void {
  try {
    // 1. Expired magic link tokens — no longer usable
    const magicLinks = db.query(`
      DELETE FROM magic_link_tokens
      WHERE expires_at < datetime('now')
    `).run();

    // 2. Expired OAuth state tokens — abandoned flows (completed flows are already
    //    consumed via atomic DELETE in the callback handler)
    const oauthStates = db.query(`
      DELETE FROM oauth_states
      WHERE expires_at < datetime('now')
    `).run();

    // 3. Expired revoked access tokens — JWT is already expired, no need to track revocation
    const revokedTokens = db.query(`
      DELETE FROM revoked_access_tokens
      WHERE expires_at < datetime('now')
    `).run();

    // 5. Used or revoked refresh tokens older than 30 days
    const refreshTokens = db.query(`
      DELETE FROM refresh_tokens
      WHERE (used_at IS NOT NULL OR revoked_at IS NOT NULL)
        AND created_at < datetime('now', '-30 days')
    `).run();

    // 6. Hook events older than 30 days (historical data)
    const hookEvents = db.query(`
      DELETE FROM hook_events
      WHERE received_at < datetime('now', '-30 days')
    `).run();

    // 7. Failed pending prompts older than 7 days
    const failedPrompts = db.query(`
      DELETE FROM pending_prompts
      WHERE status = 'failed'
        AND created_at < datetime('now', '-7 days')
    `).run();

    // 6. Deduplicate tool-type message.part.updated events — keep only the latest
    //    row per (session_id, callID). These stream in as pending→running→completed
    //    chunks; only the final state per callID matters for display.
    //    Only dedup events older than 5 minutes (avoid removing in-progress streams).
    const partDedup = db.query(`
      DELETE FROM hook_events
      WHERE event_type = 'message.part.updated'
        AND received_at < datetime('now', '-5 minutes')
        AND id NOT IN (
          SELECT id FROM (
            SELECT id, ROW_NUMBER() OVER (
              PARTITION BY session_id, json_extract(payload, '$.part.callID')
              ORDER BY received_at DESC
            ) as rn
            FROM hook_events
            WHERE event_type = 'message.part.updated'
              AND received_at < datetime('now', '-5 minutes')
              AND json_extract(payload, '$.part.callID') IS NOT NULL
          ) WHERE rn = 1
        )
        AND json_extract(payload, '$.part.callID') IS NOT NULL
    `).run();

    // 7. Deduplicate text-type message.part.updated events — keep only the latest
    //    row per (session_id, part.id). Text parts stream in as incremental chunks;
    //    the read path in sessions.ts already uses the last row per partId via
    //    partMap.set(), so all earlier chunks are dead weight.
    //    Only dedup events older than 5 minutes (avoid removing in-progress streams).
    const textPartDedup = db.query(`
      DELETE FROM hook_events
      WHERE event_type = 'message.part.updated'
        AND received_at < datetime('now', '-5 minutes')
        AND id NOT IN (
          SELECT id FROM (
            SELECT id, ROW_NUMBER() OVER (
              PARTITION BY session_id,
                COALESCE(json_extract(payload, '$.part.id'), json_extract(payload, '$.id'))
              ORDER BY received_at DESC
            ) as rn
            FROM hook_events
            WHERE event_type = 'message.part.updated'
              AND received_at < datetime('now', '-5 minutes')
              AND COALESCE(json_extract(payload, '$.part.type'), json_extract(payload, '$.type')) = 'text'
          ) WHERE rn = 1
        )
        AND COALESCE(json_extract(payload, '$.part.type'), json_extract(payload, '$.type')) = 'text'
    `).run();

    const totalCleaned =
      (magicLinks.changes ?? 0) +
      (oauthStates.changes ?? 0) +
      (revokedTokens.changes ?? 0) +
      (refreshTokens.changes ?? 0) +
      (hookEvents.changes ?? 0) +
      (failedPrompts.changes ?? 0) +
      (partDedup.changes ?? 0) +
      (textPartDedup.changes ?? 0);

    if (totalCleaned > 0 && log) {
      log.info(
        `DB cleanup: removed ${magicLinks.changes ?? 0} magic links, ` +
        `${oauthStates.changes ?? 0} oauth states, ` +
        `${revokedTokens.changes ?? 0} revoked tokens, ` +
        `${refreshTokens.changes ?? 0} refresh tokens, ` +
        `${hookEvents.changes ?? 0} hook events, ` +
        `${failedPrompts.changes ?? 0} failed prompts, ` +
        `${partDedup.changes ?? 0} duplicate tool part events, ` +
        `${textPartDedup.changes ?? 0} duplicate text part events`,
      );
    }
  } catch (err) {
    // Cleanup failures should never crash the server
    if (log) {
      log.error('DB cleanup error:', err);
    }
  }
}

/**
 * Start the periodic cleanup job.
 * Should be called once during server startup.
 */
export function startCleanupJob(
  db: Database,
  log?: { info: (msg: string) => void; error: (msg: string, ...args: unknown[]) => void },
): void {
  if (cleanupInterval) return; // Already running

  // Run once shortly after startup (30s delay to let server settle)
  setTimeout(() => runCleanup(db, log), 30_000);

  // Then run every hour
  cleanupInterval = setInterval(() => runCleanup(db, log), CLEANUP_INTERVAL_MS);
}

/**
 * Stop the periodic cleanup job.
 * Should be called during graceful shutdown.
 */
export function stopCleanupJob(): void {
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
    cleanupInterval = null;
  }
}
