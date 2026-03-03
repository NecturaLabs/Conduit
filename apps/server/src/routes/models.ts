import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { ApiError, ApiSuccess, ModelsResponse } from '@conduit/shared';
import { requireAuth } from '../middleware/auth.js';

const getModelsQuerySchema = z.object({
  instanceId: z.string().min(1),
});

export async function modelsRoutes(fastify: FastifyInstance): Promise<void> {
  // GET /api/models?instanceId=... — fetch available models for an instance.
  // Returns the model list last synced by the agent via models.sync.
  // Requires user auth: the instance must belong to the requesting user.
  fastify.get(
    '/',
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const parsed = getModelsQuerySchema.safeParse(request.query);
      if (!parsed.success) {
        const error: ApiError = {
          error: 'Bad Request',
          message: parsed.error.issues.map(i => i.message).join(', '),
          statusCode: 400,
        };
        return reply.code(400).send(error);
      }

      const { instanceId } = parsed.data;
      const userId = request.user!.id;
      const db = fastify.db;

      // Verify the instance belongs to this user
      const instance = db.query<{ id: string }, [string, string]>(
        `SELECT id FROM instances WHERE id = ? AND user_id = ?`,
      ).get(instanceId, userId);

      if (!instance) {
        const error: ApiError = {
          error: 'Not Found',
          message: 'Instance not found',
          statusCode: 404,
        };
        return reply.code(404).send(error);
      }

      interface ModelRow {
        provider_id: string;
        model_id: string;
        model_name: string;
      }

      const rows = db.query<ModelRow, [string]>(
        `SELECT provider_id, model_id, model_name
         FROM instance_models
         WHERE instance_id = ?
         ORDER BY provider_id, model_name`,
      ).all(instanceId);

      const response: ApiSuccess<ModelsResponse> = {
        data: {
          models: rows.map(r => ({
            providerId: r.provider_id,
            modelId: r.model_id,
            modelName: r.model_name,
          })),
        },
      };
      return reply.code(200).send(response);
    },
  );
}
