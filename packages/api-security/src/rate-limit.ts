/**
 * Per-API-Key Rate Limiting
 *
 * D1-based rate limiting for API keys with configurable limits,
 * burst detection, and priority queuing.
 */

import type { D1Database } from '@cloudflare/workers-types';
import type { PerKeyRateLimitConfig, RateLimitState } from './types.js';

/**
 * Default rate limit configuration
 */
export const DEFAULT_RATE_LIMIT_CONFIG: PerKeyRateLimitConfig = {
  requestsPerMinute: 60,
  maxBurst: 10,
  burstWindow: 10_000, // 10 seconds
  throttleDuration: 60_000, // 1 minute
  priority: 0,
};

/**
 * D1 schema for rate limiting
 */
export const RATE_LIMIT_SCHEMA = `
-- Rate limit state table for API keys
CREATE TABLE IF NOT EXISTS api_rate_limits (
  key_id TEXT PRIMARY KEY,
  request_timestamps TEXT NOT NULL DEFAULT '[]', -- JSON array of timestamps
  throttle_until INTEGER NOT NULL DEFAULT 0,
  burst_start INTEGER,
  burst_count INTEGER NOT NULL DEFAULT 0,
  last_updated INTEGER NOT NULL,
  INDEX idx_throttle (throttle_until)
);

-- Index for cleanup
CREATE INDEX IF NOT EXISTS idx_rate_limit_updated ON api_rate_limits(last_updated);
`;

/**
 * Get rate limit state from D1
 *
 * @param db - D1 database binding
 * @param keyId - API key identifier
 * @returns Rate limit state or null
 */
export async function getRateLimitState(
  db: D1Database,
  keyId: string
): Promise<RateLimitState | null> {
  const result = await db
    .prepare(
      `
      SELECT request_timestamps, throttle_until, burst_start, burst_count
      FROM api_rate_limits
      WHERE key_id = ?
    `
    )
    .bind(keyId)
    .first<{
      request_timestamps: string;
      throttle_until: number;
      burst_start: number | null;
      burst_count: number;
    }>();

  if (!result) {
    return null;
  }

  return {
    keyId,
    requestTimestamps: JSON.parse(result.request_timestamps) as number[],
    throttleUntil: result.throttle_until,
    burstStart: result.burst_start ?? undefined,
    burstCount: result.burst_count,
  };
}

/**
 * Save rate limit state to D1
 *
 * @param db - D1 database binding
 * @param state - Rate limit state
 */
export async function saveRateLimitState(db: D1Database, state: RateLimitState): Promise<void> {
  const now = Date.now();
  await db
    .prepare(
      `
      INSERT INTO api_rate_limits (
        key_id, request_timestamps, throttle_until, burst_start, burst_count, last_updated
      )
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(key_id) DO UPDATE SET
        request_timestamps = excluded.request_timestamps,
        throttle_until = excluded.throttle_until,
        burst_start = excluded.burst_start,
        burst_count = excluded.burst_count,
        last_updated = excluded.last_updated
    `
    )
    .bind(
      state.keyId,
      JSON.stringify(state.requestTimestamps),
      state.throttleUntil,
      state.burstStart ?? null,
      state.burstCount,
      now
    )
    .run();
}

/**
 * Check rate limit for API key
 *
 * @param db - D1 database binding
 * @param keyId - API key identifier
 * @param config - Rate limit configuration
 * @returns Object indicating if request is allowed
 */
export async function checkRateLimit(
  db: D1Database,
  keyId: string,
  config: Partial<PerKeyRateLimitConfig> = {}
): Promise<
  | { allowed: true; remaining: number }
  | { allowed: false; retryAfter: number; reason: 'throttled' | 'rate_limited' | 'burst_detected' }
> {
  const effectiveConfig = { ...DEFAULT_RATE_LIMIT_CONFIG, ...config };
  const now = Date.now();

  // Get or create state
  let state = await getRateLimitState(db, keyId);
  if (!state) {
    state = {
      keyId,
      requestTimestamps: [],
      throttleUntil: 0,
      burstCount: 0,
    };
  }

  // Check throttle status
  if (state.throttleUntil > now) {
    return {
      allowed: false,
      retryAfter: state.throttleUntil - now,
      reason: 'throttled',
    };
  }

  // Clean old timestamps (older than 1 minute)
  const oneMinuteAgo = now - 60_000;
  state.requestTimestamps = state.requestTimestamps.filter((ts) => ts > oneMinuteAgo);

  // Check per-minute limit
  if (state.requestTimestamps.length >= effectiveConfig.requestsPerMinute) {
    return {
      allowed: false,
      retryAfter: 60_000, // Retry after 1 minute
      reason: 'rate_limited',
    };
  }

  // Check burst limit
  if (state.burstStart && now - state.burstStart > effectiveConfig.burstWindow) {
    // Reset burst tracking
    state.burstStart = undefined;
    state.burstCount = 0;
  }

  if (state.burstStart) {
    state.burstCount++;
  } else {
    state.burstStart = now;
    state.burstCount = 1;
  }

  if (state.burstCount > effectiveConfig.maxBurst) {
    // Trigger throttle
    state.throttleUntil = now + effectiveConfig.throttleDuration;
    await saveRateLimitState(db, state);
    return {
      allowed: false,
      retryAfter: effectiveConfig.throttleDuration,
      reason: 'burst_detected',
    };
  }

  // Record this request
  state.requestTimestamps.push(now);
  await saveRateLimitState(db, state);

  return {
    allowed: true,
    remaining: effectiveConfig.requestsPerMinute - state.requestTimestamps.length,
  };
}

/**
 * Reset rate limit for API key (admin/testing only)
 *
 * @param db - D1 database binding
 * @param keyId - API key identifier
 */
export async function resetRateLimit(db: D1Database, keyId: string): Promise<void> {
  await db.prepare('DELETE FROM api_rate_limits WHERE key_id = ?').bind(keyId).run();
}

/**
 * Get rate limit statistics for monitoring
 *
 * @param db - D1 database binding
 * @returns Statistics about current rate limiting
 */
export async function getRateLimitStats(db: D1Database): Promise<{
  totalKeys: number;
  throttledKeys: number;
  activeKeys: number;
}> {
  const now = Date.now();

  const totalResult = await db
    .prepare('SELECT COUNT(*) as count FROM api_rate_limits')
    .first<{ count: number }>();
  const throttledResult = await db
    .prepare('SELECT COUNT(*) as count FROM api_rate_limits WHERE throttle_until > ?')
    .bind(now)
    .first<{ count: number }>();
  const activeResult = await db
    .prepare(
      'SELECT COUNT(*) as count FROM api_rate_limits WHERE json_array_length(request_timestamps) > 0'
    )
    .first<{ count: number }>();

  return {
    totalKeys: totalResult?.count ?? 0,
    throttledKeys: throttledResult?.count ?? 0,
    activeKeys: activeResult?.count ?? 0,
  };
}

/**
 * Clean up stale rate limit entries
 *
 * Removes entries older than 1 hour with no recent activity.
 *
 * @param db - D1 database binding
 * @returns Number of entries cleaned up
 */
export async function cleanupStaleRateLimits(db: D1Database): Promise<number> {
  const oneHourAgo = Date.now() - 60 * 60 * 1000;
  const result = await db
    .prepare(
      `
      DELETE FROM api_rate_limits
      WHERE last_updated < ?
        AND json_array_length(request_timestamps) = 0
        AND throttle_until = 0
    `
    )
    .bind(oneHourAgo)
    .run();

  return result.meta.changes ?? 0;
}
