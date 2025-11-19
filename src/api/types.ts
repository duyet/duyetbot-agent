/**
 * API Types
 *
 * Type definitions for API, authentication, and user management
 */

import type { R2Bucket, VectorizeIndex } from '@cloudflare/workers-types';

/**
 * OAuth provider types
 */
export type OAuthProvider = 'github' | 'google';

/**
 * User model
 */
export interface User {
  id: string;
  email: string;
  name: string | null;
  picture: string | null;
  provider: OAuthProvider;
  providerId: string;
  createdAt: Date;
  updatedAt: Date;
  settings?: UserSettings;
}

/**
 * User settings
 */
export interface UserSettings {
  defaultModel?: string;
  defaultProvider?: string;
  uiTheme?: 'light' | 'dark' | 'system';
  notifications?: {
    email?: boolean;
    push?: boolean;
  };
}

/**
 * User creation input
 */
export interface CreateUserInput {
  email: string;
  name: string | null;
  picture: string | null;
  provider: OAuthProvider;
  providerId: string;
  settings?: UserSettings;
}

/**
 * User update input
 */
export interface UpdateUserInput {
  name?: string | null;
  picture?: string | null;
  settings?: Partial<UserSettings>;
}

/**
 * JWT claims
 */
export interface JWTClaims {
  sub: string; // User ID
  email: string;
  name: string | null;
  picture: string | null;
  provider: OAuthProvider;
  iat?: number; // Issued at (set by jose)
  exp?: number; // Expiration (set by jose)
}

/**
 * JWT token pair
 */
export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number; // seconds
}

/**
 * Device flow authorization request
 */
export interface DeviceAuthorizationResponse {
  deviceCode: string;
  userCode: string;
  verificationUri: string;
  expiresIn: number; // seconds
  interval: number; // seconds
}

/**
 * Device flow token request
 */
export interface DeviceTokenRequest {
  deviceCode: string;
}

/**
 * Device flow pending authorization (stored in KV)
 */
export interface DevicePendingAuthorization {
  deviceCode: string;
  userCode: string;
  userId?: string; // Set when user authorizes
  createdAt: number; // timestamp
  expiresAt: number; // timestamp
}

/**
 * Refresh token model
 */
export interface RefreshToken {
  id: string;
  userId: string;
  token: string;
  expiresAt: Date;
  createdAt: Date;
}

/**
 * OAuth profile from provider
 */
export interface OAuthProfile {
  id: string;
  email: string;
  name: string | null;
  picture: string | null;
}

/**
 * GitHub OAuth profile
 */
export interface GitHubProfile extends OAuthProfile {
  login: string;
  avatarUrl: string;
}

/**
 * Google OAuth profile
 */
export interface GoogleProfile extends OAuthProfile {
  sub: string;
  givenName?: string;
  familyName?: string;
}

/**
 * Usage statistics
 */
export interface UsageStats {
  userId: string;
  apiRequests: number;
  tokensUsed: number;
  storageUsed: number; // bytes
  period: {
    start: Date;
    end: Date;
  };
}

/**
 * API error response
 */
export interface APIError {
  success: false;
  error: string;
  message: string;
  code: string;
  details?: unknown;
}

/**
 * API success response
 */
export interface APISuccess<T = unknown> {
  success: true;
  data: T;
}

/**
 * API response (success or error)
 */
export type APIResponse<T = unknown> = APISuccess<T> | APIError;

/**
 * Auth response with tokens
 */
export interface AuthResponse {
  user: User;
  tokens: TokenPair;
}

/**
 * Refresh token request
 */
export interface RefreshTokenRequest {
  refreshToken: string;
}

/**
 * Cloudflare Workers environment bindings
 */
export interface Env {
  // D1 Database
  DB: D1Database;

  // KV Namespace
  KV: KVNamespace;

  // Vectorize Index
  VECTORIZE: VectorizeIndex;

  // R2 Bucket
  R2: R2Bucket;

  // Environment variables
  ENVIRONMENT: 'development' | 'staging' | 'production' | 'test';
  API_URL: string;
  WEB_URL: string;

  // Secrets (set via wrangler secret put)
  JWT_SECRET: string;
  GITHUB_CLIENT_ID: string;
  GITHUB_CLIENT_SECRET: string;
  GITHUB_REDIRECT_URI: string;
  GITHUB_WEBHOOK_SECRET: string;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  GOOGLE_REDIRECT_URI: string;
  ANTHROPIC_API_KEY: string;
  OPENAI_API_KEY: string;
  OPENROUTER_API_KEY: string;
  FRONTEND_URL: string;
}

/**
 * Request context with authenticated user
 */
export interface AuthContext {
  user: User;
  env: Env;
}

/**
 * Rate limit configuration
 */
export interface RateLimitConfig {
  maxRequests: number;
  windowSeconds: number;
}

/**
 * Rate limit result
 */
export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
}

/**
 * Request context extensions
 * These are added by middleware and available in handlers via c.get()
 */
export interface RequestContext {
  // From auth middleware
  user?: User;

  // From request-id middleware
  requestId: string;

  // From logger middleware
  logger: import('./middleware/logger').Logger;

  // From timing middleware
  timer: import('./middleware/timing').PerformanceTimer;
}

/**
 * Hono app environment type
 * Combines bindings (Cloudflare env) and variables (request context)
 */
export type AppEnv = {
  Bindings: Env;
  Variables: RequestContext;
};
