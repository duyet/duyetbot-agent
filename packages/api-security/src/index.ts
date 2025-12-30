/**
 * API Security Package
 *
 * Comprehensive security utilities for Cloudflare Workers including:
 * - API key management with rotation
 * - Enhanced webhook signature verification
 * - Per-API-key rate limiting
 * - Request throttling for expensive operations
 */

// API Key Management
export {
  createAPIKeyRecord,
  generateAPIKey,
  generateKeyId,
  hashAPIKey,
  parseAPIKey,
  rotateAPIKey,
  shouldRotateKey,
  validateAPIKey,
  validateAPIKeyFormat,
} from './api-keys.js';
// Hono Middleware Wrappers
export {
  createAPIKeyAuthMiddleware,
  createRateLimitMiddleware,
  createSecurityMiddleware,
  createSignatureMiddleware,
  createThrottleMiddleware,
  type SecurityEnv,
} from './middleware.js';
// Rate Limiting
export {
  checkRateLimit,
  cleanupStaleRateLimits,
  DEFAULT_RATE_LIMIT_CONFIG,
  getRateLimitState,
  getRateLimitStats,
  RATE_LIMIT_SCHEMA,
  resetRateLimit,
  saveRateLimitState,
} from './rate-limit.js';
// Signature Verification
export {
  createSignatureOptions,
  extractTimestamp,
  generateSignature,
  timingSafeEqual,
  verifySignatureWithTimestamp,
} from './signature.js';
// D1 Storage
export {
  API_KEYS_SCHEMA,
  checkKeysNeedingRotation,
  createAPIKey,
  getAPIKey,
  getAPIKeyAuditLog,
  initializeAPIKeysStorage,
  listAPIKeys,
  revokeAPIKey,
  rotateAPIKeyInStorage,
  validateAndUpdateAPIKey,
} from './storage.js';
// Request Throttling
export {
  acquireThrottleSlot,
  checkThrottle,
  cleanupStaleThrottleStates,
  DEFAULT_THROTTLE_CONFIG,
  executeThrottled,
  getThrottleStats,
  queueOperation,
  resetThrottleState,
} from './throttle.js';
// Types
export * from './types.js';
