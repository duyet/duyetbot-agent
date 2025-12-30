/**
 * API Security - Types
 *
 * Shared types for API key management, rate limiting, and request throttling.
 */

/**
 * API key metadata stored in D1 database
 */
export interface APIKeyRecord {
  /** Primary key */
  id: string;
  /** API key identifier (hash) */
  keyId: string;
  /** SHA-256 hash of the API key value */
  keyHash: string;
  /** Key name/description for management */
  name: string;
  /** Key owner/creator */
  createdBy: string;
  /** Creation timestamp */
  createdAt: number;
  /** Expiration timestamp (0 for no expiration) */
  expiresAt: number;
  /** Whether the key is currently active */
  isActive: boolean;
  /** Last used timestamp */
  lastUsedAt: number;
  /** Usage count */
  usageCount: number;
  /** Key version for rotation support */
  version: number;
  /** ID of the key this replaces (for rotation) */
  replacesId?: string;
}

/**
 * Rate limit state for an API key
 */
export interface RateLimitState {
  /** API key identifier */
  keyId: string;
  /** Request timestamps in current window */
  requestTimestamps: number[];
  /** Current throttle expiration */
  throttleUntil: number;
  /** Burst detection state */
  burstStart?: number;
  /** Burst message count */
  burstCount: number;
}

/**
 * Throttle configuration for expensive operations
 */
export interface ThrottleConfig {
  /** Maximum concurrent operations */
  maxConcurrent: number;
  /** Per-operations delay in milliseconds */
  perOperationDelay: number;
  /** Window for concurrent tracking */
  windowMs: number;
}

/**
 * Throttle state for tracking operations
 */
export interface ThrottleState {
  /** Active operation count */
  activeCount: number;
  /** Last operation timestamp */
  lastOperationAt: number;
  /** Queue of pending operations */
  pendingQueue: number[];
}

/**
 * Webhook signature verification options
 */
export interface SignatureVerificationOptions {
  /** Maximum allowed signature age in milliseconds (default: 5 minutes) */
  maxAge?: number;
  /** Whether to require timestamp header */
  requireTimestamp?: boolean;
  /** Custom clock skew tolerance in milliseconds (default: 30s) */
  clockSkewTolerance?: number;
}

/**
 * API key rotation options
 */
export interface RotationOptions {
  /** Grace period in milliseconds before old key is invalid */
  gracePeriodMs: number;
  /** Whether to automatically revoke old key after grace period */
  autoRevoke: boolean;
  /** Notification callback for rotation events */
  onRotation?: (oldKeyId: string, newKeyId: string) => void | Promise<void>;
}

/**
 * API key validation result
 */
export interface KeyValidationResult {
  /** Whether the key is valid */
  valid: boolean;
  /** API key record if valid */
  record?: APIKeyRecord;
  /** Error reason if invalid */
  error?:
    | 'KEY_NOT_FOUND'
    | 'KEY_EXPIRED'
    | 'KEY_REVOKED'
    | 'KEY_FORMAT_INVALID'
    | 'RATE_LIMITED'
    | 'UNKNOWN_ERROR';
  /** Retry delay if rate limited */
  retryAfter?: number;
}

/**
 * Per-API-key rate limit configuration
 */
export interface PerKeyRateLimitConfig {
  /** Requests per minute */
  requestsPerMinute: number;
  /** Burst limit */
  maxBurst: number;
  /** Burst window in milliseconds */
  burstWindow: number;
  /** Throttle duration when exceeded */
  throttleDuration: number;
  /** Priority (higher = more important) */
  priority: number;
}
