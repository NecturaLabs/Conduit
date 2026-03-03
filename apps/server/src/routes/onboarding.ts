import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { ApiError, ApiSuccess, User } from '@conduit/shared';
import { requireAuth } from '../middleware/auth.js';
import { mapUserRow } from '../lib/db-helpers.js';

const onboardingSchema = z.object({
  displayName: z.string().min(1).max(100),
  useCase: z.enum(['personal', 'team', 'agency']),
});

export async function onboardingRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.post(
    '/',
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const parsed = onboardingSchema.safeParse(request.body);
      if (!parsed.success) {
        const error: ApiError = {
          error: 'Validation Error',
          message: parsed.error.issues.map(i => i.message).join(', '),
          statusCode: 400,
        };
        return reply.code(400).send(error);
      }

      const { displayName, useCase } = parsed.data;
      const userId = request.user!.id;
      const db = fastify.db;

      db.query(`
        UPDATE users
        SET display_name = ?, use_case = ?, onboarding_complete = 1, updated_at = datetime('now')
        WHERE id = ?
      `).run(displayName, useCase, userId);

      const userRow = db.query('SELECT * FROM users WHERE id = ?').get(userId) as Record<string, unknown>;
      const user = mapUserRow(userRow);

      const response: ApiSuccess<{ user: User }> = {
        data: { user },
      };
      return reply.code(200).send(response);
    },
  );
}
