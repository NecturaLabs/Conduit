/**
 * Shared database helper functions.
 *
 * Centralises row-mapping and timestamp normalisation logic that was
 * previously duplicated across multiple route and service files.
 */

import type { Database } from 'bun:sqlite';
import type { User } from '@conduit/shared';

/**
 * When a legacy global hook token is used, the hook user ID is null.
 * For single-user self-hosted deployments, fall back to the one user in the
 * system so that instances and hook events are associated with that user and
 * therefore visible in the dashboard.
 *
 * Returns null if there are zero users (fresh install, not yet registered) or
 * multiple users (unsafe to assume which user owns the data).
 */
export function resolveFallbackUserId(db: Database): string | null {
  const rows = db.query(`SELECT id FROM users LIMIT 2`).all() as Array<{ id: string }>;
  return rows.length === 1 ? (rows[0]?.id ?? null) : null;
}

/**
 * Normalise SQLite datetime strings ("YYYY-MM-DD HH:MM:SS") to ISO 8601 with
 * a trailing Z suffix. Already-normalised strings are returned as-is.
 */
export function normalizeTs(ts: string | null | undefined): string {
  if (!ts) return '';
  // Already has timezone info — return as-is
  if (/[Zz+\-]\d{2}:\d{2}$|[Zz]$/.test(ts)) return ts;
  // Convert "YYYY-MM-DD HH:MM:SS" → "YYYY-MM-DDTHH:MM:SSZ"
  return ts.replace(' ', 'T') + 'Z';
}

/**
 * Map a raw user database row to the shared `User` type.
 * Handles column name mapping (snake_case → camelCase) and defaults.
 */
export function mapUserRow(row: Record<string, unknown>): User {
  return {
    id: row['id'] as string,
    email: row['email'] as string,
    displayName: (row['display_name'] as string) ?? '',
    useCase: (row['use_case'] as User['useCase']) ?? 'personal',
    onboardingComplete: (row['onboarding_complete'] as number) === 1,
    subscriptionStatus:
      (row['subscription_status'] as User['subscriptionStatus']) ?? 'trial',
    trialStartedAt: (row['trial_started_at'] as string) ?? null,
    createdAt: row['created_at'] as string,
    updatedAt: row['updated_at'] as string,
  };
}
