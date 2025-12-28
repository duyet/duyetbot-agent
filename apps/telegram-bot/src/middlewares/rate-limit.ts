/**
 * Rate limiting middleware for Telegram bot
 *
 * Implements per-user rate limiting to prevent abuse and reduce API costs.
 * Uses sliding window counter algorithm for smooth rate limiting.
 *
 * Rate limits:
 * - Default: 20 messages per minute per user
 * - Burst: 5 messages within 10 seconds triggers temporary throttle
 * - Admin users are exempt from rate limiting
 *
 * @example
 * ```typescript
 * import { createRateLimitMiddleware } from './rate-limit.js';
 *
 * app.use('/webhook', createRateLimitMiddleware());
 * ```
 */

import { logger } from '@duyetbot/hono-middleware';
import type { MiddlewareHandler } from 'hono';

import type { AuthVariables, Env } from './types.js';

/**
 * Rate limit configuration
 */
export interface RateLimitConfig {
  /** Maximum messages per minute per user (default: 20) */
  maxPerMinute: number;
  /** Maximum burst messages within burstWindow (default: 5) */
  maxBurst: number;
  /** Burst detection window in milliseconds (default: 10s) */
  burstWindow: number;
  /** Throttle duration in milliseconds when burst exceeded (default: 60s) */
  throttleDuration: number;
}

/**
 * Default rate limit configuration
 *
 * Aligned with Telegram Bot API limits (30 msg/sec global, much higher per-user)
 */
export const DEFAULT_RATE_LIMIT: RateLimitConfig = {
  maxPerMinute: 20,
  maxBurst: 5,
  burstWindow: 10_000, // 10 seconds
  throttleDuration: 60_000, // 1 minute
};

/**
 * Rate limit state for a single user
 */
export interface UserRateLimitState {
  /** Message timestamps in current sliding window */
  messageTimestamps: number[];
  /** When throttle expires (0 if not throttled) */
  throttleUntil: number;
  /** First message timestamp in burst window */
  burstStart?: number;
  /** Message count in current burst window */
  burstCount: number;
}

/**
 * In-memory rate limit state (worker-local)
 *
 * For production with multiple workers, this should be moved to D1 KV or DO storage.
 * Current implementation is suitable for single-worker deployments or as a first line of defense.
 */
const rateLimitState = new Map<number, UserRateLimitState>();

/**
 * Cleanup stale entries from rate limit state
 *
 * Runs periodically to prevent memory leaks from inactive users.
 * Removes entries older than 5 minutes.
 */
function cleanupStaleEntries(): void {
  const now = Date.now();
  const staleThreshold = 5 * 60 * 1000; // 5 minutes

  for (const [userId, state] of rateLimitState.entries()) {
    // Remove if no recent messages and not throttled
    const hasRecentMessages =
      state.messageTimestamps.some((ts) => now - ts < staleThreshold) || state.throttleUntil > now;

    if (!hasRecentMessages) {
      rateLimitState.delete(userId);
      logger.debug('[RATE_LIMIT] Cleaned up stale entry', { userId });
    }
  }
}

// Run cleanup every 5 minutes
setInterval(cleanupStaleEntries, 5 * 60 * 1000);

/**
 * Check if user is currently throttled
 *
 * @param state - User's rate limit state
 * @param now - Current timestamp
 * @returns Remaining throttle time in milliseconds (0 if not throttled)
 */
function checkThrottle(state: UserRateLimitState, now: number): number {
  if (state.throttleUntil > now) {
    return state.throttleUntil - now;
  }
  // Reset throttle if expired
  state.throttleUntil = 0;
  return 0;
}

/**
 * Check per-minute rate limit
 *
 * Uses sliding window algorithm - counts messages within the last 60 seconds.
 *
 * @param state - User's rate limit state
 * @param config - Rate limit configuration
 * @param now - Current timestamp
 * @returns true if under limit, false if exceeded
 */
function checkPerMinuteLimit(
  state: UserRateLimitState,
  config: RateLimitConfig,
  now: number
): boolean {
  const oneMinuteAgo = now - 60_000;

  // Filter timestamps to only those within the last minute
  state.messageTimestamps = state.messageTimestamps.filter((ts) => ts > oneMinuteAgo);

  return state.messageTimestamps.length < config.maxPerMinute;
}

/**
 * Check burst rate limit
 *
 * Detects rapid message patterns that may indicate spam or abuse.
 * Tracks messages within burstWindow and triggers throttle if exceeded.
 *
 * @param state - User's rate limit state
 * @param config - Rate limit configuration
 * @param now - Current timestamp
 * @returns true if under burst limit, false if burst detected
 */
function checkBurstLimit(state: UserRateLimitState, config: RateLimitConfig, now: number): boolean {
  // Reset burst tracking if window expired
  if (state.burstStart && now - state.burstStart > config.burstWindow) {
    state.burstStart = undefined;
    state.burstCount = 0;
  }

  // Initialize burst window
  if (!state.burstStart) {
    state.burstStart = now;
    state.burstCount = 1;
    return true;
  }

  // Increment burst count
  state.burstCount++;

  // Check if burst limit exceeded
  if (state.burstCount > config.maxBurst) {
    // Trigger throttle
    state.throttleUntil = now + config.throttleDuration;
    logger.warn('[RATE_LIMIT] Burst detected, throttling user', {
      burstCount: state.burstCount,
      burstWindow: config.burstWindow,
      throttleDuration: config.throttleDuration,
    });
    return false;
  }

  return true;
}

/**
 * Record a message for rate limit tracking
 *
 * @param state - User's rate limit state
 * @param now - Current timestamp
 */
function recordMessage(state: UserRateLimitState, now: number): void {
  state.messageTimestamps.push(now);
}

/**
 * Get or create rate limit state for a user
 *
 * @param userId - Telegram user ID
 * @returns User's rate limit state
 */
function getOrCreateState(userId: number): UserRateLimitState {
  let state = rateLimitState.get(userId);
  if (!state) {
    state = {
      messageTimestamps: [],
      throttleUntil: 0,
      burstCount: 0,
    };
    rateLimitState.set(userId, state);
  }
  return state;
}

/**
 * Check if user is exempt from rate limiting
 *
 * Admin users are exempt to allow for testing and bulk operations.
 *
 * @param username - User's username (without @)
 * @param adminUsername - Admin username from env
 * @returns true if exempt, false otherwise
 */
function isExempt(username?: string, adminUsername?: string): boolean {
  if (!adminUsername) return false;
  return username?.toLowerCase() === adminUsername.toLowerCase();
}

/**
 * Error codes for rate limiting
 */
export const RateLimitErrorCodes = {
  RATE_001: 'User is throttled due to burst activity',
  RATE_002: 'User exceeded per-minute rate limit',
} as const;

/**
 * Create rate limiting middleware for Telegram webhook
 *
 * This middleware checks if the user is within rate limits before allowing
 * the message to proceed to the agent.
 *
 * Behavior:
 * - If user is admin (username matches adminUsername), skip rate limiting
 * - If user is throttled, set `rateLimited: true` and `skipProcessing: true`
 * - If user exceeds per-minute limit, set `rateLimited: true` and `skipProcessing: true`
 * - If user exceeds burst limit, trigger throttle and set `rateLimited: true`
 *
 * @param config - Rate limit configuration (uses defaults if not provided)
 * @returns Hono middleware handler
 *
 * @example
 * ```typescript
 * import { createRateLimitMiddleware } from './rate-limit.js';
 *
 * app.use('/webhook', createRateLimitMiddleware({
 *   maxPerMinute: 30,
 *   maxBurst: 10,
 * }));
 * ```
 */
export function createRateLimitMiddleware(
  config: Partial<RateLimitConfig> = {}
): MiddlewareHandler<{
  Bindings: Env;
  Variables: AuthVariables & { rateLimited: boolean; rateLimitReason?: string };
}> {
  const effectiveConfig: RateLimitConfig = {
    ...DEFAULT_RATE_LIMIT,
    ...config,
  };

  return async (c, next) => {
    // Initialize rate limited flag
    c.set('rateLimited', false);

    // Check if processing should already be skipped
    const skipProcessing = c.get('skipProcessing');
    if (skipProcessing) {
      logger.debug('[RATE_LIMIT] Skipping - skipProcessing already set');
      return next();
    }

    // Get webhook context from parser middleware
    const webhookContext = c.get('webhookContext');
    if (!webhookContext) {
      logger.warn('[RATE_LIMIT] No webhookContext found');
      return next();
    }

    // Check admin exemption
    const adminUsername = c.env.TELEGRAM_ADMIN;
    if (isExempt(webhookContext.username, adminUsername)) {
      logger.debug('[RATE_LIMIT] User exempt from rate limiting (admin)', {
        userId: webhookContext.userId,
        username: webhookContext.username,
      });
      return next();
    }

    // Get or create user state
    const state = getOrCreateState(webhookContext.userId);
    const now = Date.now();

    // Check throttle status
    const throttleRemaining = checkThrottle(state, now);
    if (throttleRemaining > 0) {
      const secondsRemaining = Math.ceil(throttleRemaining / 1000);
      logger.info('[RATE_LIMIT] User is throttled', {
        userId: webhookContext.userId,
        username: webhookContext.username,
        secondsRemaining,
      });
      c.set('rateLimited', true);
      c.set('rateLimitReason', `Please wait ${secondsRemaining} seconds before trying again.`);
      c.set('skipProcessing', true);
      return next();
    }

    // Check per-minute limit
    if (!checkPerMinuteLimit(state, effectiveConfig, now)) {
      logger.info('[RATE_LIMIT] User exceeded per-minute limit', {
        userId: webhookContext.userId,
        username: webhookContext.username,
        messageCount: state.messageTimestamps.length,
        maxPerMinute: effectiveConfig.maxPerMinute,
        code: 'RATE_002',
      });
      c.set('rateLimited', true);
      c.set('rateLimitReason', 'Too many messages. Please slow down.');
      c.set('skipProcessing', true);
      return next();
    }

    // Check burst limit
    if (!checkBurstLimit(state, effectiveConfig, now)) {
      logger.info('[RATE_LIMIT] User exceeded burst limit', {
        userId: webhookContext.userId,
        username: webhookContext.username,
        burstCount: state.burstCount,
        maxBurst: effectiveConfig.maxBurst,
        code: 'RATE_001',
      });
      c.set('rateLimited', true);
      c.set(
        'rateLimitReason',
        `You're sending messages too fast. Please wait ${Math.ceil(effectiveConfig.throttleDuration / 1000)} seconds.`
      );
      c.set('skipProcessing', true);
      return next();
    }

    // All checks passed - record the message
    recordMessage(state, now);

    logger.debug('[RATE_LIMIT] Message allowed', {
      userId: webhookContext.userId,
      messageCount: state.messageTimestamps.length,
      burstCount: state.burstCount,
    });

    return next();
  };
}

/**
 * Get current rate limit state for a user (for testing/debugging)
 *
 * @param userId - Telegram user ID
 * @returns User's rate limit state or undefined if not tracked
 */
export function getUserRateLimitState(userId: number): UserRateLimitState | undefined {
  return rateLimitState.get(userId);
}

/**
 * Reset rate limit state for a user (admin/testing only)
 *
 * @param userId - Telegram user ID
 */
export function resetUserRateLimitState(userId: number): void {
  rateLimitState.delete(userId);
  logger.info('[RATE_LIMIT] Reset rate limit state', { userId });
}

/**
 * Get global rate limit statistics (for monitoring)
 *
 * @returns Statistics about current rate limiting state
 */
export function getRateLimitStats(): {
  totalUsers: number;
  throttledUsers: number;
  activeUsers: number;
} {
  const now = Date.now();
  let throttledUsers = 0;
  let activeUsers = 0;

  for (const state of rateLimitState.values()) {
    if (state.throttleUntil > now) {
      throttledUsers++;
    }
    if (state.messageTimestamps.length > 0) {
      activeUsers++;
    }
  }

  return {
    totalUsers: rateLimitState.size,
    throttledUsers,
    activeUsers,
  };
}
