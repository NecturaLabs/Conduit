/** OAuth provider identifier — used in route params, DB records, and frontend UI. */
export type OAuthProvider = 'github' | 'gitlab';

export interface MagicLinkRequest {
  email: string;
}

export interface MagicLinkResponse {
  message: string;
}

export interface VerifyTokenRequest {
  token: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface RefreshRequest {
  refreshToken: string;
}

/** Common fields shared by all JWT payloads */
export interface BaseJWTPayload {
  sub: string;
  iat: number;
  exp: number;
  /** JWT issuer claim — must be 'conduit' */
  iss: string;
  /** JWT audience claim — 'conduit:access' or 'conduit:refresh' */
  aud: string;
}

export interface JWTPayload extends BaseJWTPayload {
  email: string;
}

export interface RefreshJWTPayload extends BaseJWTPayload {
  family: string;
}
