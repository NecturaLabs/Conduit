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
