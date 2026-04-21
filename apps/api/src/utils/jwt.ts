import jwt, { SignOptions } from 'jsonwebtoken';
import { randomUUID } from 'crypto';
import { config } from '../config';

export interface TokenPayload {
  userId: string;
  username: string;
  email: string;
  role: string;
  /** Same as refresh JWT jti; identifies UserSession.sessionId */
  sessionId?: string;
}

/** Verified refresh token always includes jti */
export interface RefreshTokenPayload extends TokenPayload {
  jti: string;
}

export const generateAccessToken = (payload: TokenPayload): string => {
  return jwt.sign(payload, config.jwt.accessSecret, {
    expiresIn: config.jwt.accessExpiresIn,
  } as any);
};

/**
 * Issue a refresh token. Reuse existingJti when rotating so the login session stays stable.
 */
export const generateRefreshToken = (
  payload: TokenPayload,
  existingJti?: string
): { token: string; jti: string } => {
  const jti = existingJti ?? randomUUID();
  const payloadWithJti = {
    ...payload,
    jti,
  };

  const token = jwt.sign(payloadWithJti, config.jwt.refreshSecret, {
    expiresIn: config.jwt.refreshExpiresIn,
  } as any);

  return { token, jti };
};

export const verifyAccessToken = (token: string): TokenPayload => {
  return jwt.verify(token, config.jwt.accessSecret) as TokenPayload;
};

export const verifyRefreshToken = (token: string): RefreshTokenPayload => {
  return jwt.verify(token, config.jwt.refreshSecret) as RefreshTokenPayload;
};

export const generateTempToken = (userId: string): string => {
  return jwt.sign({ userId, type: 'temp' }, config.jwt.accessSecret, {
    expiresIn: '15m', // Temporary token valid for 15 minutes
  } as any);
};

export const verifyTempToken = (token: string): { userId: string; type: string } => {
  const payload = jwt.verify(token, config.jwt.accessSecret) as any;
  if (payload.type !== 'temp') {
    throw new Error('Invalid token type');
  }
  return payload;
};
