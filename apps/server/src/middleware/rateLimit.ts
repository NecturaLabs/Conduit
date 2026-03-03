export const authRateLimit = {
  max: 5,
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
