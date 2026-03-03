import type { Database } from 'bun:sqlite';

/**
 * Metric names that map to the `metric` column in `metrics_counters`.
 */
type MetricName = 'messages' | 'tool_calls' | 'tokens' | 'cost';

/**
 * Returns the current hour bucket as an ISO string truncated to the hour.
 * Example: '2026-02-24T14:00:00.000Z'
 */
export function currentHourBucket(now?: Date): string {
  const d = new Date((now ?? new Date()).getTime());
  d.setMinutes(0, 0, 0);
  return d.toISOString();
}

/**
 * MetricsWriter writes metric increments directly to `metrics_counters` in the
 * request handler — no buffering, no flush timer. This avoids losing data on
 * restart and eliminates the 60-second lag in the metrics dashboard.
 *
 * Deduplication (sessions, messages, tool calls) is done via INSERT OR IGNORE
 * into `metrics_dedup` before incrementing the counter, so restarts are safe.
 */
export class MetricsAggregator {
  private db: Database;

  constructor(db: Database) {
    this.db = db;
  }

  /** No-op — kept for API compatibility with app.ts */
  start(): void {}

  /** No-op — kept for API compatibility with app.ts */
  stop(): void {}

  private upsertCounter(userId: string, instanceId: string, metric: MetricName, value: number, now?: Date): void {
    const hourBucket = currentHourBucket(now ?? new Date());
    this.db.query(`
      INSERT INTO metrics_counters (user_id, instance_id, hour_bucket, metric, value)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(user_id, instance_id, hour_bucket, metric)
      DO UPDATE SET value = value + excluded.value
    `).run(userId, instanceId, hourBucket, metric, value);
  }

  /**
   * Track a message. Deduplicates by messageId using metrics_dedup.
   */
  trackMessage(userId: string, instanceId: string, messageId: string, now?: Date): void {
    const hourBucket = currentHourBucket(now ?? new Date());
    const dedupKey = `msg|${messageId}`;
    const inserted = this.db.query(`
      INSERT OR IGNORE INTO metrics_dedup (dedup_key, hour_bucket)
      VALUES (?, ?)
    `).run(dedupKey, hourBucket);
    if (inserted.changes === 0) return;
    this.upsertCounter(userId, instanceId, 'messages', 1, now);
  }

  /**
   * Track a tool call. Deduplicates by callId using metrics_dedup.
   */
  trackToolCall(userId: string, instanceId: string, callId: string, now?: Date): void {
    const hourBucket = currentHourBucket(now ?? new Date());
    const dedupKey = `tool|${callId}`;
    const inserted = this.db.query(`
      INSERT OR IGNORE INTO metrics_dedup (dedup_key, hour_bucket)
      VALUES (?, ?)
    `).run(dedupKey, hourBucket);
    if (inserted.changes === 0) return;
    this.upsertCounter(userId, instanceId, 'tool_calls', 1, now);
  }

  /**
   * Track tokens and cost from a message.updated event.
   * Stores the latest cumulative value per message in metrics_dedup,
   * then increments the counter by the delta.
   */
  trackTokensAndCost(
    userId: string,
    instanceId: string,
    messageId: string,
    tokens: number,
    cost: number,
    now?: Date,
  ): void {
    const hourBucket = currentHourBucket(now ?? new Date());
    const dedupKey = `tokens|${messageId}`;

    // Look up previous values
    const prev = this.db.query(`
      SELECT meta FROM metrics_dedup WHERE dedup_key = ?
    `).get(dedupKey) as { meta: string } | undefined;

    if (prev?.meta) {
      const { t: prevTokens, c: prevCost } = JSON.parse(prev.meta) as { t: number; c: number };
      const tokenDelta = tokens - prevTokens;
      const costDelta = cost - prevCost;
      // Update stored values
      this.db.query(`UPDATE metrics_dedup SET meta = ? WHERE dedup_key = ?`)
        .run(JSON.stringify({ t: tokens, c: cost }), dedupKey);
      if (tokenDelta > 0) this.upsertCounter(userId, instanceId, 'tokens', tokenDelta, now);
      if (costDelta > 0) this.upsertCounter(userId, instanceId, 'cost', costDelta, now);
    } else {
      // First time seeing this message
      this.db.query(`
        INSERT OR IGNORE INTO metrics_dedup (dedup_key, hour_bucket, meta)
        VALUES (?, ?, ?)
      `).run(dedupKey, hourBucket, JSON.stringify({ t: tokens, c: cost }));
      if (tokens > 0) this.upsertCounter(userId, instanceId, 'tokens', tokens, now);
      if (cost > 0) this.upsertCounter(userId, instanceId, 'cost', cost, now);
    }
  }
}
