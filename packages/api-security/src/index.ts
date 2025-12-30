/**
 * API Security Package
 *
 * Comprehensive security utilities for Cloudflare Workers including:
 * - API key management with rotation
 * - Enhanced webhook signature verification
 * - Per-API-key rate limiting
 * - Request throttling for expensive operations
 */

// Types
export * from './types.js';

// API Key Management
export {
  generateAPIKey,
  validateAPIKeyFormat,
  parseAPIKey,
  generateKeyId,
  hashAPIKey,
  createAPIKeyRecord,
  validateAPIKey,
  shouldRotateKey,
  rotateAPIKey,
} from './api-keys.js';

// Signature Verification
export {
  verifySignatureWithTimestamp,
  generateSignature,
  extractTimestamp,
  createSignatureOptions,
  timingSafeEqual,
} from './signature.js';

// Rate Limiting
export {
  checkRateLimit,
  getRateLimitState,
  saveRateLimitState,
  resetRateLimit,
  getRateLimitStats,
  cleanupStaleRateLimits,
  DEFAULT_RATE_LIMIT_CONFIG,
  RATE_LIMIT_SCHEMA,
} from './rate-limit.js';

// Request Throttling
export {
  checkThrottle,
  acquireThrottleSlot,
  queueOperation,
  executeThrottled,
  getThrottleStats,
  resetThrottleState,
  cleanupStaleThrottleStates,
  DEFAULT_THROTTLE_CONFIG,
} from './throttle.js';

// D1 Storage
export {
  createAPIKey,
  validateAndUpdateAPIKey,
  rotateAPIKeyInStorage,
  revokeAPIKey,
  getAPIKey,
  listAPIKeys,
  getAPIKeyAuditLog,
  checkKeysNeedingRotation,
  initializeAPIKeysStorage,
  API_KEYS_SCHEMA,
} from './storage.js';

// Hono Middleware Wrappers
export {
  createSignatureMiddleware,
  createAPIKeyAuthMiddleware,
  createRateLimitMiddleware,
  createThrottleMiddleware,
  createSecurityMiddleware,
  type SecurityEnv,
} from './middleware.js';
