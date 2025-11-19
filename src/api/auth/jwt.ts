/**
 * JWT Authentication
 *
 * JWT token generation and verification using jose library
 */

import { webcrypto } from 'node:crypto';
import * as jose from 'jose';
import type { JWTClaims, TokenPair, User } from '../types';

// Use Node.js crypto for compatibility with Node 18
const crypto = webcrypto as unknown as Crypto;

/**
 * JWT configuration
 */
const JWT_ALGORITHM = 'HS256';
const ACCESS_TOKEN_EXPIRY = 60 * 60; // 1 hour
const REFRESH_TOKEN_EXPIRY = 30 * 24 * 60 * 60; // 30 days

/**
 * Generate JWT access token
 */
export async function generateAccessToken(user: User, secret: string): Promise<string> {
  // User-specific claims (don't include iat/exp, jose will set them)
  const claims = {
    sub: user.id,
    email: user.email,
    name: user.name,
    picture: user.picture,
    provider: user.provider,
  };

  const secretKey = new TextEncoder().encode(secret);

  const jwt = await new jose.SignJWT(claims)
    .setProtectedHeader({ alg: JWT_ALGORITHM })
    .setIssuedAt()
    .setExpirationTime(`${ACCESS_TOKEN_EXPIRY}s`)
    .sign(secretKey);

  return jwt;
}

/**
 * Generate refresh token (random string)
 */
export function generateRefreshToken(): string {
  // Generate cryptographically secure random token
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Generate token pair (access + refresh)
 */
export async function generateTokenPair(user: User, secret: string): Promise<TokenPair> {
  const accessToken = await generateAccessToken(user, secret);
  const refreshToken = generateRefreshToken();

  return {
    accessToken,
    refreshToken,
    expiresIn: ACCESS_TOKEN_EXPIRY,
  };
}

/**
 * Verify JWT token and extract claims
 */
export async function verifyToken(token: string, secret: string): Promise<JWTClaims> {
  try {
    const secretKey = new TextEncoder().encode(secret);

    const { payload } = await jose.jwtVerify(token, secretKey, {
      algorithms: [JWT_ALGORITHM],
    });

    return payload as unknown as JWTClaims;
  } catch (error) {
    if (error instanceof jose.errors.JWTExpired) {
      throw new JWTError('Token expired', 'TOKEN_EXPIRED');
    }
    if (error instanceof jose.errors.JWTInvalid) {
      throw new JWTError('Invalid token', 'TOKEN_INVALID');
    }
    throw new JWTError('Token verification failed', 'TOKEN_VERIFICATION_FAILED', error);
  }
}

/**
 * Extract token from Authorization header
 */
export function extractToken(authHeader: string | null): string | null {
  if (!authHeader) {
    return null;
  }

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return null;
  }

  return parts[1] || null;
}

/**
 * JWT error
 */
export class JWTError extends Error {
  constructor(
    message: string,
    public code: string,
    public override cause?: unknown
  ) {
    super(message);
    this.name = 'JWTError';
  }
}

/**
 * Get expiration time for refresh token
 */
export function getRefreshTokenExpiry(): Date {
  return new Date(Date.now() + REFRESH_TOKEN_EXPIRY * 1000);
}
