import type { FastifyRequest, FastifyReply } from 'fastify';
import { verifyToken, hashToken, JWT_AUDIENCE_ACCESS } from '../services/auth.js';
import { config } from '../config.js';
import type { JWTPayload, ApiError } from '@conduit/shared';

declare module 'fastify' {
  interface FastifyRequest {
    user?: {
      id: string;
      email: string;
    };
    /** Set by requireHookToken / resolveHookTokenUser — the owning user's ID, or null for legacy global token */
    hookTokenUserId?: string | null;
  }
}

export async function requireAuth(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const token = request.cookies['conduit_access'];

  if (!token) {
    const error: ApiError = {
      error: 'Unauthorized',
      message: 'Access token is required',
      statusCode: 401,
    };
    reply.code(401).send(error);
    return;
  }

  const payload = verifyToken<JWTPayload>(token, config.jwtSecret, JWT_AUDIENCE_ACCESS);
  if (!payload) {
    const error: ApiError = {
      error: 'Unauthorized',
      message: 'Authentication required',
      statusCode: 401,
    };
    reply.code(401).send(error);
    return;
  }

  const tokenHash = hashToken(token);
  const db = request.server.db;
  const revoked = db.query(
    'SELECT 1 FROM revoked_access_tokens WHERE token_hash = ?',
  ).get(tokenHash) as { 1: number } | undefined;

  if (revoked) {
    const error: ApiError = {
      error: 'Unauthorized',
      message: 'Authentication required',
      statusCode: 401,
    };
    reply.code(401).send(error);
    return;
  }

  request.user = {
    id: payload.sub,
    email: payload.email,
  };
}

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export async function requireCsrf(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  if (!MUTATING_METHODS.has(request.method)) {
    return;
  }

  const xRequestedWith = request.headers['x-requested-with'];
  if (xRequestedWith !== 'XMLHttpRequest') {
    const error: ApiError = {
      error: 'Forbidden',
      message: 'Missing or invalid X-Requested-With header',
      statusCode: 403,
    };
    reply.code(403).send(error);
    return;
  }

  // Defense-in-depth: validate Origin header when present.
  // Browsers always send Origin on cross-origin requests and on same-origin
  // POST/PUT/DELETE. If present, it must match an allowed origin (web app URL
  // or Capacitor Android origins).
  const origin = request.headers['origin'];
  if (origin) {
    const allowedOrigins = [
      new URL(config.appUrl).origin,
      ...config.capacitorOrigins,
    ];
    if (!allowedOrigins.includes(origin)) {
      const error: ApiError = {
        error: 'Forbidden',
        message: 'Origin not allowed',
        statusCode: 403,
      };
      reply.code(403).send(error);
      return;
    }
  }
}
