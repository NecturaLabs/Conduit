/** Rate limit for magic-link send and verify endpoints.
 *  Keyed by IP. 10 attempts per 15 minutes is generous enough for
 *  legitimate users (including retries) while still blocking brute-force. */
export const authRateLimit = {
  max: 10,
  timeWindow: '15 minutes',
};

/** Rate limit for OAuth /start endpoints.
 *  /start only stores a state row and issues a redirect — it does NOT send
 *  email — so a looser limit is appropriate. 20 per 15 minutes handles
 *  users who mis-click or switch between providers without locking them out. */
export const oauthStartRateLimit = {
  max: 20,
  timeWindow: '15 minutes',
};

/** Rate limit for OAuth callback endpoints.
 *  Callbacks involve DB writes and outbound HTTP to providers so they should
 *  be rate-limited, but generously — a legitimate user only hits this once per
 *  login and many users may share an IP behind a corporate proxy. */
export const oauthCallbackRateLimit = {
  max: 30,
  timeWindow: '15 minutes',
};

export const webhookRateLimit = {
  max: 1000,
  timeWindow: '1 minute',
};

export const refreshRateLimit = {
  max: 60,
  timeWindow: '1 minute',
};

/** Rate limit for authenticated API read endpoints (sessions, config, metrics, instances). */
export const apiReadRateLimit = {
  max: 120,
  timeWindow: '1 minute',
};

/** Rate limit for authenticated API write/mutate endpoints (PATCH, POST, DELETE). */
export const apiWriteRateLimit = {
  max: 30,
  timeWindow: '1 minute',
};
