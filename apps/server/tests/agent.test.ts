import { describe, it, expect } from 'vitest';
import { getApp, getTestSecrets, createTestUser, createTestHookToken } from './setup.js';

// Helper: send an agent request with a Bearer token
function agentHeaders(token: string) {
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  };
}

// Helper: insert a pending prompt directly into the DB
function insertPrompt(
  app: ReturnType<typeof getApp>,
  userId: string,
  overrides: Record<string, unknown> = {},
) {
  const id = crypto.randomUUID();
  app.db.prepare(
    `INSERT INTO pending_prompts (id, session_id, user_id, content, status, is_command, command_name)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    (overrides['session_id'] as string) ?? 'sess-1',
    userId,
    (overrides['content'] as string) ?? 'Hello from test',
    (overrides['status'] as string) ?? 'pending',
    (overrides['is_command'] as number) ?? 0,
    (overrides['command_name'] as string | null) ?? null,
  );
  return id;
}

// ── 1. Authentication ─────────────────────────────────────────────────────────

describe('Agent route authentication', () => {
  it('rejects requests with no Authorization header → 401', async () => {
    const app = getApp();
    const res = await app.inject({
      method: 'POST',
      url: '/agent/register',
      payload: {},
      headers: { 'Content-Type': 'application/json' },
    });
    expect(res.statusCode).toBe(401);
  });

  it('rejects requests with an invalid token → 401', async () => {
    const app = getApp();
    const res = await app.inject({
      method: 'POST',
      url: '/agent/register',
      payload: {},
      headers: agentHeaders('totally-invalid-token'),
    });
    expect(res.statusCode).toBe(401);
  });

  it('rejects the global/legacy CONDUIT_HOOK_TOKEN → 401', async () => {
    const app = getApp();
    const { hookToken } = getTestSecrets();
    const res = await app.inject({
      method: 'POST',
      url: '/agent/register',
      payload: {},
      headers: agentHeaders(hookToken),
    });
    expect(res.statusCode).toBe(401);
    expect(res.json().message).toContain('per-user');
  });

  it('accepts a valid per-user hook token → not 401', async () => {
    const app = getApp();
    const user = createTestUser();
    const token = await createTestHookToken(user.id);
    const res = await app.inject({
      method: 'POST',
      url: '/agent/register',
      payload: {},
      headers: agentHeaders(token),
    });
    expect(res.statusCode).not.toBe(401);
  });
});

// ── 2. POST /agent/register ───────────────────────────────────────────────────

describe('POST /agent/register', () => {
  it('creates an instance on first call and returns instanceId', async () => {
    const app = getApp();
    const user = createTestUser();
    const token = await createTestHookToken(user.id);

    const res = await app.inject({
      method: 'POST',
      url: '/agent/register',
      payload: { name: 'my-agent' },
      headers: agentHeaders(token),
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.instanceId).toBeDefined();
    expect(body.status).toBe('registered');

    // Verify the instance exists in DB
    const instance = app.db.prepare(
      `SELECT * FROM instances WHERE id = ?`,
    ).get(body.instanceId) as Record<string, unknown> | undefined;
    expect(instance).toBeDefined();
    expect(instance!['name']).toBe('my-agent');
    expect(instance!['user_id']).toBe(user.id);
    expect(instance!['type']).toBe('claude-code');
  });

  it('is idempotent — second call returns the same instanceId', async () => {
    const app = getApp();
    const user = createTestUser();
    const token = await createTestHookToken(user.id);

    const res1 = await app.inject({
      method: 'POST',
      url: '/agent/register',
      payload: { name: 'agent-v1' },
      headers: agentHeaders(token),
    });
    const res2 = await app.inject({
      method: 'POST',
      url: '/agent/register',
      payload: { name: 'agent-v2' },
      headers: agentHeaders(token),
    });

    expect(res1.statusCode).toBe(200);
    expect(res2.statusCode).toBe(200);
    expect(res1.json().instanceId).toBe(res2.json().instanceId);
  });

  it('stores the provided name in the instances table', async () => {
    const app = getApp();
    const user = createTestUser();
    const token = await createTestHookToken(user.id);

    const res = await app.inject({
      method: 'POST',
      url: '/agent/register',
      payload: { name: 'special-name' },
      headers: agentHeaders(token),
    });

    expect(res.statusCode).toBe(200);
    const { instanceId } = res.json();
    const row = app.db.prepare(
      `SELECT name FROM instances WHERE id = ?`,
    ).get(instanceId) as { name: string } | undefined;
    expect(row?.name).toBe('special-name');
  });
});

// ── 3. POST /agent/event ──────────────────────────────────────────────────────

describe('POST /agent/event', () => {
  it('accepts a session.start event → 200 and stores in hook_events', async () => {
    const app = getApp();
    const user = createTestUser();
    const token = await createTestHookToken(user.id);

    const res = await app.inject({
      method: 'POST',
      url: '/agent/event',
      payload: { type: 'session.start', sessionId: 'sess-abc', data: {} },
      headers: agentHeaders(token),
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().ok).toBe(true);

    const row = app.db.prepare(
      `SELECT event_type, session_id FROM hook_events WHERE session_id = 'sess-abc' LIMIT 1`,
    ).get() as Record<string, unknown> | undefined;
    expect(row).toBeDefined();
    expect(row!['event_type']).toBe('SessionStart');
  });

  it('accepts a message event with inputTokens/outputTokens → 200', async () => {
    const app = getApp();
    const user = createTestUser();
    const token = await createTestHookToken(user.id);

    const res = await app.inject({
      method: 'POST',
      url: '/agent/event',
      payload: {
        type: 'message',
        sessionId: 'sess-msg-1',
        data: { inputTokens: 100, outputTokens: 50 },
      },
      headers: agentHeaders(token),
    });

    expect(res.statusCode).toBe(200);

    const row = app.db.prepare(
      `SELECT event_type, payload FROM hook_events WHERE session_id = 'sess-msg-1' LIMIT 1`,
    ).get() as { event_type: string; payload: string } | undefined;
    expect(row).toBeDefined();
    expect(row!.event_type).toBe('message.updated');
    const payload = JSON.parse(row!.payload) as Record<string, unknown>;
    expect((payload['info'] as Record<string, unknown>)['tokens']).toBeDefined();
  });

  it('accepts a tool.use event with toolName → 200', async () => {
    const app = getApp();
    const user = createTestUser();
    const token = await createTestHookToken(user.id);

    const res = await app.inject({
      method: 'POST',
      url: '/agent/event',
      payload: {
        type: 'tool.use',
        sessionId: 'sess-tool-1',
        data: { toolName: 'Bash' },
      },
      headers: agentHeaders(token),
    });

    expect(res.statusCode).toBe(200);

    const row = app.db.prepare(
      `SELECT event_type, payload FROM hook_events WHERE session_id = 'sess-tool-1' LIMIT 1`,
    ).get() as { event_type: string; payload: string } | undefined;
    expect(row).toBeDefined();
    expect(row!.event_type).toBe('PostToolUse');
    const payload = JSON.parse(row!.payload) as Record<string, unknown>;
    expect(payload['tool_name']).toBe('Bash');
  });

  it('rejects an unknown event type → 400', async () => {
    const app = getApp();
    const user = createTestUser();
    const token = await createTestHookToken(user.id);

    const res = await app.inject({
      method: 'POST',
      url: '/agent/event',
      payload: { type: 'unknown.type', sessionId: 'sess-x', data: {} },
      headers: agentHeaders(token),
    });

    expect(res.statusCode).toBe(400);
  });

  it('rejects a missing sessionId → 400', async () => {
    const app = getApp();
    const user = createTestUser();
    const token = await createTestHookToken(user.id);

    const res = await app.inject({
      method: 'POST',
      url: '/agent/event',
      payload: { type: 'session.start', data: {} },
      headers: agentHeaders(token),
    });

    expect(res.statusCode).toBe(400);
  });
});

// ── 4. GET /agent/prompts ─────────────────────────────────────────────────────

describe('GET /agent/prompts', () => {
  it('returns an empty array when no pending prompts exist', async () => {
    const app = getApp();
    const user = createTestUser();
    const token = await createTestHookToken(user.id);

    const res = await app.inject({
      method: 'GET',
      url: '/agent/prompts',
      headers: agentHeaders(token),
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().prompts).toEqual([]);
  });

  it('returns pending prompts for the authenticated user', async () => {
    const app = getApp();
    const user = createTestUser();
    const token = await createTestHookToken(user.id);
    insertPrompt(app, user.id, { content: 'Do something', session_id: 'sess-prompts-1' });

    const res = await app.inject({
      method: 'GET',
      url: '/agent/prompts',
      headers: agentHeaders(token),
    });

    expect(res.statusCode).toBe(200);
    const { prompts } = res.json() as { prompts: Array<Record<string, unknown>> };
    expect(prompts.length).toBe(1);
    expect(prompts[0]!['content']).toBe('Do something');
    expect(prompts[0]!['sessionId']).toBe('sess-prompts-1');
  });

  it('does NOT return prompts belonging to a different user', async () => {
    const app = getApp();
    const user1 = createTestUser();
    const user2 = createTestUser();
    const token2 = await createTestHookToken(user2.id);

    // Insert a prompt for user1 only
    insertPrompt(app, user1.id, { content: 'User1 prompt' });

    const res = await app.inject({
      method: 'GET',
      url: '/agent/prompts',
      headers: agentHeaders(token2),
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().prompts).toEqual([]);
  });
});

// ── 5. POST /agent/prompts/:id/ack ────────────────────────────────────────────

describe('POST /agent/prompts/:id/ack', () => {
  it('returns 404 if the prompt does not exist', async () => {
    const app = getApp();
    const user = createTestUser();
    const token = await createTestHookToken(user.id);

    const res = await app.inject({
      method: 'POST',
      url: '/agent/prompts/nonexistent-id/ack',
      payload: { status: 'delivered' },
      headers: agentHeaders(token),
    });

    expect(res.statusCode).toBe(404);
  });

  it('returns 404 if the prompt belongs to a different user', async () => {
    const app = getApp();
    const user1 = createTestUser();
    const user2 = createTestUser();
    const token2 = await createTestHookToken(user2.id);

    const promptId = insertPrompt(app, user1.id);

    const res = await app.inject({
      method: 'POST',
      url: `/agent/prompts/${promptId}/ack`,
      payload: { status: 'delivered' },
      headers: agentHeaders(token2),
    });

    expect(res.statusCode).toBe(404);
  });

  it('successfully acks own prompt → 200 and updates status', async () => {
    const app = getApp();
    const user = createTestUser();
    const token = await createTestHookToken(user.id);

    const promptId = insertPrompt(app, user.id);

    const res = await app.inject({
      method: 'POST',
      url: `/agent/prompts/${promptId}/ack`,
      payload: { status: 'delivered' },
      headers: agentHeaders(token),
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().ok).toBe(true);

    // Verify status was updated in DB
    const row = app.db.prepare(
      `SELECT status FROM pending_prompts WHERE id = ?`,
    ).get(promptId) as { status: string } | undefined;
    expect(row?.status).toBe('delivered');
  });
});

// ── 6. POST /agent/models ─────────────────────────────────────────────────────

describe('POST /agent/models', () => {
  it('syncs models for the authenticated user instance → 200', async () => {
    const app = getApp();
    const user = createTestUser();
    const token = await createTestHookToken(user.id);

    const res = await app.inject({
      method: 'POST',
      url: '/agent/models',
      payload: {
        models: [
          { providerId: 'anthropic', modelId: 'claude-3-5-sonnet', modelName: 'Claude 3.5 Sonnet' },
          { providerId: 'anthropic', modelId: 'claude-3-haiku', modelName: 'Claude 3 Haiku' },
        ],
      },
      headers: agentHeaders(token),
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().ok).toBe(true);
    expect(res.json().synced).toBe(2);

    // Verify the instance was created and models were stored
    const instance = app.db.prepare(
      `SELECT id FROM instances WHERE user_id = ? AND type = 'claude-code' LIMIT 1`,
    ).get(user.id) as { id: string } | undefined;
    expect(instance).toBeDefined();

    const models = app.db.prepare(
      `SELECT model_id FROM instance_models WHERE instance_id = ?`,
    ).all(instance!.id) as Array<{ model_id: string }>;
    expect(models.length).toBe(2);
    expect(models.map((m) => m.model_id).sort()).toEqual(['claude-3-5-sonnet', 'claude-3-haiku'].sort());
  });

  it('only affects the authenticated user instance, not another user', async () => {
    const app = getApp();
    const user1 = createTestUser();
    const user2 = createTestUser();
    const token1 = await createTestHookToken(user1.id);
    const token2 = await createTestHookToken(user2.id);

    // Register user2 first so they have an instance
    await app.inject({
      method: 'POST',
      url: '/agent/register',
      payload: {},
      headers: agentHeaders(token2),
    });

    // Sync models for user1
    await app.inject({
      method: 'POST',
      url: '/agent/models',
      payload: {
        models: [{ providerId: 'anthropic', modelId: 'claude-sonnet', modelName: 'Claude Sonnet' }],
      },
      headers: agentHeaders(token1),
    });

    // user2's instance should have no models
    const instance2 = app.db.prepare(
      `SELECT id FROM instances WHERE user_id = ? AND type = 'claude-code' LIMIT 1`,
    ).get(user2.id) as { id: string } | undefined;
    expect(instance2).toBeDefined();

    const modelsForUser2 = app.db.prepare(
      `SELECT model_id FROM instance_models WHERE instance_id = ?`,
    ).all(instance2!.id) as Array<{ model_id: string }>;
    expect(modelsForUser2.length).toBe(0);
  });

  it('rejects an empty models array shape (missing required fields) → 400', async () => {
    const app = getApp();
    const user = createTestUser();
    const token = await createTestHookToken(user.id);

    const res = await app.inject({
      method: 'POST',
      url: '/agent/models',
      payload: {
        models: [{ providerId: 'anthropic' }], // missing modelId + modelName
      },
      headers: agentHeaders(token),
    });

    expect(res.statusCode).toBe(400);
  });
});
