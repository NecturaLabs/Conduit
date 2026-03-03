import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { ApiError, ApiSuccess, MetricsDashboard, MetricsTimeSeries } from '@conduit/shared';
import { requireAuth, requireCsrf } from '../middleware/auth.js';
import * as metricsService from '../services/metrics.js';

const timeSeriesSchema = z.object({
  metric: z.enum(['sessions', 'messages', 'tools', 'tokens', 'cost']),
  period: z.enum(['1h', '24h', '7d', '30d']).default('24h'),
  instanceId: z.string().uuid().optional(),
});

// Shared schema for summary/dashboard querystring — validates period and instanceId
const summaryQuerySchema = z.object({
  period: z.enum(['1h', '24h', '7d', '30d']).optional(),
  instanceId: z.string().uuid().optional(),
});

export async function metricsRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.addHook('preHandler', requireAuth);

  // DELETE /metrics — wipe all metrics counters and dedup for this user
  fastify.delete(
    '/',
    { preHandler: [requireCsrf] },
    async (request, reply) => {
      const userId = request.user!.id;
      const db = fastify.db;
      db.query(`DELETE FROM metrics_counters WHERE user_id = ?`).run(userId);
      // SECURITY: Scope dedup DELETE to keys for this user's instances only.
      // The dedup_key format is '<type>|<instanceId>|...' — filter by instance ownership.
      db.query(
        `DELETE FROM metrics_dedup WHERE (dedup_key LIKE 'msg|%' OR dedup_key LIKE 'tool|%' OR dedup_key LIKE 'tokens|%' OR dedup_key LIKE 'session|%')
           AND substr(dedup_key, instr(dedup_key, '|') + 1, 36) IN (SELECT id FROM instances WHERE user_id = ?)`,
      ).run(userId);
      const response: ApiSuccess<{ message: string }> = { data: { message: 'Metrics cleared' } };
      return reply.code(200).send(response);
    },
  );

  // GET /metrics/summary
  fastify.get(
    '/summary',
    async (request, reply) => {
      const parsed = summaryQuerySchema.safeParse(request.query);
      if (!parsed.success) {
        const error: ApiError = {
          error: 'Validation Error',
          message: parsed.error.issues.map(i => i.message).join(', '),
          statusCode: 400,
        };
        return reply.code(400).send(error);
      }
      const db = fastify.db;
      const { instanceId, period } = parsed.data;
      const userId = request.user!.id;

      try {
        const summary = await metricsService.getSummary(db, instanceId, period, userId);
        const response: ApiSuccess<typeof summary> = {
          data: summary,
        };
        return reply.code(200).send(response);
      } catch (err) {
        fastify.log.error({ err, period, instanceId }, 'Metrics summary aggregation failed');
        const error: ApiError = {
          error: 'Internal Server Error',
          message: 'Failed to aggregate metrics summary',
          statusCode: 500,
        };
        return reply.code(500).send(error);
      }
    },
  );

  // GET /metrics/timeseries
  fastify.get(
    '/timeseries',
    async (request, reply) => {
      const parsed = timeSeriesSchema.safeParse(request.query);
      if (!parsed.success) {
        const error: ApiError = {
          error: 'Validation Error',
          message: parsed.error.issues.map(i => i.message).join(', '),
          statusCode: 400,
        };
        return reply.code(400).send(error);
      }

      const { metric, period, instanceId } = parsed.data;
      const db = fastify.db;
      const userId = request.user!.id;

      try {
        const timeSeries = metricsService.getTimeSeries(db, metric, period, instanceId, userId);
        const response: ApiSuccess<MetricsTimeSeries> = {
          data: timeSeries,
        };
        return reply.code(200).send(response);
      } catch (err) {
        fastify.log.error({ err, metric, period, instanceId }, 'Metrics timeseries query failed');
        const error: ApiError = {
          error: 'Internal Server Error',
          message: 'Failed to compute timeseries',
          statusCode: 500,
        };
        return reply.code(500).send(error);
      }
    },
  );

  // GET /metrics/dashboard
  fastify.get(
    '/dashboard',
    async (request, reply) => {
      const parsed = summaryQuerySchema.safeParse(request.query);
      if (!parsed.success) {
        const error: ApiError = {
          error: 'Validation Error',
          message: parsed.error.issues.map(i => i.message).join(', '),
          statusCode: 400,
        };
        return reply.code(400).send(error);
      }
      const db = fastify.db;
      const { instanceId, period = '24h' } = parsed.data;
      const userId = request.user!.id;

      try {
        const summary = await metricsService.getSummary(db, instanceId, period, userId);
        const sessionActivity = metricsService.getTimeSeries(db, 'sessions', period, instanceId, userId);
        const toolUsage = metricsService.getTimeSeries(db, 'tools', period, instanceId, userId);
        const messageVolume = metricsService.getTimeSeries(db, 'messages', period, instanceId, userId);
        const tokenUsage = metricsService.getTimeSeries(db, 'tokens', period, instanceId, userId);
        const costOverTime = metricsService.getTimeSeries(db, 'cost', period, instanceId, userId);

        const dashboard: MetricsDashboard = {
          summary,
          sessionActivity,
          toolUsage,
          messageVolume,
          tokenUsage,
          costOverTime,
        };

        const response: ApiSuccess<MetricsDashboard> = {
          data: dashboard,
        };
        return reply.code(200).send(response);
      } catch (err) {
        fastify.log.error({ err, period, instanceId }, 'Dashboard metrics aggregation failed');
        const error: ApiError = {
          error: 'Internal Server Error',
          message: 'Failed to aggregate dashboard metrics',
          statusCode: 500,
        };
        return reply.code(500).send(error);
      }
    },
  );
}
