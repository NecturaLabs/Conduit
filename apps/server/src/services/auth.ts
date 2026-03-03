import { createHash, createHmac, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import type { JWTPayload, RefreshJWTPayload } from '@conduit/shared';

function base64urlEncode(data: string | Buffer): string {
  const buf = typeof data === 'string' ? Buffer.from(data, 'utf-8') : data;
  return buf.toString('base64url');
}

function base64urlDecode(str: string): string {
  return Buffer.from(str, 'base64url').toString('utf-8');
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function generateMagicLinkToken(): { raw: string; hash: string } {
  const raw = randomBytes(32).toString('hex');
  const hash = hashToken(raw);
  return { raw, hash };
}

export function verifyMagicLinkToken(raw: string, storedHash: string): boolean {
  const computedHash = hashToken(raw);
  const a = Buffer.from(computedHash, 'hex');
  const b = Buffer.from(storedHash, 'hex');
  if (a.length !== b.length) {
    return false;
  }
  return timingSafeEqual(a, b);
}

function signJwt(payload: Record<string, unknown>, secret: string): string {
  const header = { alg: 'HS256', typ: 'JWT' };
  const encodedHeader = base64urlEncode(JSON.stringify(header));
  const encodedPayload = base64urlEncode(JSON.stringify(payload));
  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const signature = createHmac('sha256', secret).update(signingInput).digest();
  const encodedSignature = base64urlEncode(signature);
  return `${signingInput}.${encodedSignature}`;
}

function verifyJwtSignature(token: string, secret: string): Record<string, unknown> | null {
  const parts = token.split('.');
  if (parts.length !== 3) {
    return null;
  }
  const [encodedHeader, encodedPayload, encodedSignature] = parts as [string, string, string];

  // SECURITY: Validate the alg header to prevent algorithm confusion attacks.
  // We only sign with HS256; reject anything else (e.g. "none", "RS256").
  try {
    const header = JSON.parse(base64urlDecode(encodedHeader)) as Record<string, unknown>;
    if (header.alg !== 'HS256') {
      return null;
    }
  } catch {
    return null;
  }

  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const expectedSignature = createHmac('sha256', secret).update(signingInput).digest();
  const actualSignature = Buffer.from(encodedSignature, 'base64url');

  if (expectedSignature.length !== actualSignature.length) {
    return null;
  }

  if (!timingSafeEqual(expectedSignature, actualSignature)) {
    return null;
  }

  try {
    const payload = JSON.parse(base64urlDecode(encodedPayload)) as Record<string, unknown>;
    return payload;
  } catch {
    return null;
  }
}

// Access token TTL: 2 hours
const ACCESS_TOKEN_TTL_SECONDS = 2 * 60 * 60;
// Refresh token TTL: 30 days (rolling — each use re-issues a fresh 30-day token)
const REFRESH_TOKEN_TTL_SECONDS = 30 * 24 * 60 * 60;

/** JWT issuer claim — constant for all Conduit tokens */
const JWT_ISSUER = 'conduit';
/** JWT audience for access tokens */
const JWT_AUD_ACCESS = 'conduit:access';
/** JWT audience for refresh tokens */
const JWT_AUD_REFRESH = 'conduit:refresh';

export function createAccessToken(payload: Omit<JWTPayload, 'iat' | 'exp' | 'iss' | 'aud'>, secret: string): string {
  const now = Math.floor(Date.now() / 1000);
  const fullPayload: Record<string, unknown> = {
    ...payload,
    iss: JWT_ISSUER,
    aud: JWT_AUD_ACCESS,
    iat: now,
    exp: now + ACCESS_TOKEN_TTL_SECONDS,
  };
  return signJwt(fullPayload, secret);
}

export function createRefreshToken(
  payload: Omit<RefreshJWTPayload, 'iat' | 'exp' | 'iss' | 'aud'>,
  secret: string,
): string {
  const now = Math.floor(Date.now() / 1000);
  const fullPayload: Record<string, unknown> = {
    ...payload,
    iss: JWT_ISSUER,
    aud: JWT_AUD_REFRESH,
    iat: now,
    exp: now + REFRESH_TOKEN_TTL_SECONDS,
  };
  return signJwt(fullPayload, secret);
}

export function verifyToken<T extends JWTPayload | RefreshJWTPayload>(
  token: string,
  secret: string,
  expectedAudience?: string,
): T | null {
  const payload = verifyJwtSignature(token, secret);
  if (!payload) {
    return null;
  }

  const exp = payload['exp'];
  if (typeof exp !== 'number') {
    return null;
  }

  const now = Math.floor(Date.now() / 1000);
  if (now >= exp) {
    return null;
  }

  // SECURITY: Validate iss claim — reject tokens not issued by Conduit.
  // Tokens minted before this change lack iss/aud; accept them during a
  // transition period to avoid mass-invalidation on upgrade. New tokens
  // always include both claims.
  if (payload['iss'] !== undefined && payload['iss'] !== JWT_ISSUER) {
    return null;
  }

  // SECURITY: Validate aud claim — prevents using a refresh token as an
  // access token and vice-versa (token confusion / cross-audience attack).
  if (expectedAudience && payload['aud'] !== undefined && payload['aud'] !== expectedAudience) {
    return null;
  }

  return payload as T;
}

/** Audience constant for access tokens — use with verifyToken() */
export const JWT_AUDIENCE_ACCESS = JWT_AUD_ACCESS;
/** Audience constant for refresh tokens — use with verifyToken() */
export const JWT_AUDIENCE_REFRESH = JWT_AUD_REFRESH;

/** Generate a cryptographically random UUID. */
export function generateId(): string {
  return randomUUID();
}

export function computeHmacSignature(secret: string, data: string): string {
  return createHmac('sha256', secret).update(data).digest('hex');
}

export function verifyHmacSignature(
  secret: string,
  data: string,
  signature: string,
): boolean {
  const expected = computeHmacSignature(secret, data);
  const a = Buffer.from(expected, 'hex');
  const b = Buffer.from(signature, 'hex');
  if (a.length !== b.length) {
    return false;
  }
  return timingSafeEqual(a, b);
}
