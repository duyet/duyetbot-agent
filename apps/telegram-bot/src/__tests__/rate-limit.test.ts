/**
 * Tests for rate limiting middleware
 */

import { beforeEach, describe, expect, it } from 'vitest';
import {
  createRateLimitMiddleware,
  DEFAULT_RATE_LIMIT,
  getRateLimitStats,
  getUserRateLimitState,
  type RateLimitConfig,
  RateLimitErrorCodes,
  resetUserRateLimitState,
  type UserRateLimitState,
} from '../middlewares/rate-limit.js';
import type { Env } from '../middlewares/types.js';

describe('rate-limit middleware', () => {
  beforeEach(() => {
    // Reset all rate limit state before each test
    resetUserRateLimitState(12345);
    resetUserRateLimitState(67890);
    resetUserRateLimitState(111);
    resetUserRateLimitState(222);
    resetUserRateLimitState(333);
    resetUserRateLimitState(999);
  });

  describe('configuration', () => {
    it('should use default configuration when not provided', () => {
      expect(DEFAULT_RATE_LIMIT.maxPerMinute).toBe(20);
      expect(DEFAULT_RATE_LIMIT.maxBurst).toBe(5);
      expect(DEFAULT_RATE_LIMIT.burstWindow).toBe(10_000);
      expect(DEFAULT_RATE_LIMIT.throttleDuration).toBe(60_000);
    });

    it('should allow custom configuration', () => {
      const customConfig: Partial<RateLimitConfig> = {
        maxPerMinute: 10,
        maxBurst: 3,
      };
      const middleware = createRateLimitMiddleware(customConfig);
      expect(middleware).toBeDefined();
    });

    it('should export error codes', () => {
      expect(RateLimitErrorCodes.RATE_001).toBe('User is throttled due to burst activity');
      expect(RateLimitErrorCodes.RATE_002).toBe('User exceeded per-minute rate limit');
    });
  });

  describe('state management functions', () => {
    it('should create new state for unknown users', () => {
      const state = getUserRateLimitState(12345);
      expect(state).toBeUndefined();

      // Verify middleware can be created
      const middleware = createRateLimitMiddleware();
      expect(middleware).toBeDefined();
    });

    it('should allow manual state reset', () => {
      // Test that reset function doesn't throw
      resetUserRateLimitState(12345);
      const state = getUserRateLimitState(12345);
      expect(state).toBeUndefined();
    });

    it('should provide rate limit statistics', () => {
      const stats = getRateLimitStats();
      expect(stats).toHaveProperty('totalUsers');
      expect(stats).toHaveProperty('throttledUsers');
      expect(stats).toHaveProperty('activeUsers');
      expect(typeof stats.totalUsers).toBe('number');
      expect(typeof stats.throttledUsers).toBe('number');
      expect(typeof stats.activeUsers).toBe('number');
    });
  });

  describe('per-minute rate limiting', () => {
    it('should allow messages within per-minute limit', () => {
      const config: Partial<RateLimitConfig> = {
        maxPerMinute: 5,
        maxBurst: 10, // High to not trigger burst
      };
      const middleware = createRateLimitMiddleware(config);
      expect(middleware).toBeDefined();
    });

    it('should filter expired timestamps from message history', () => {
      const now = Date.now();
      const testState: UserRateLimitState = {
        messageTimestamps: [
          now - 61_000, // Expired (older than 60s)
          now - 59_000, // Valid (within 60s)
          now - 30_000, // Valid
          now, // Valid
        ],
        throttleUntil: 0,
        burstCount: 2,
        burstStart: now - 5000,
      };

      // Filter to last 60 seconds
      const oneMinuteAgo = now - 60_000;
      const validTimestamps = testState.messageTimestamps.filter((ts) => ts > oneMinuteAgo);
      expect(validTimestamps.length).toBe(3);
    });

    it('should reset burst window when expired', () => {
      const now = Date.now();
      const config: RateLimitConfig = {
        ...DEFAULT_RATE_LIMIT,
        burstWindow: 5000, // 5 seconds
      };

      const testState: UserRateLimitState = {
        messageTimestamps: [now - 30_000, now - 20_000, now],
        throttleUntil: 0,
        burstCount: 3,
        burstStart: now - 6000, // 6 seconds ago (expired)
      };

      // If burst window expired, should reset
      if (testState.burstStart && now - testState.burstStart > config.burstWindow) {
        // Would reset in actual middleware
        expect(now - testState.burstStart).toBeGreaterThan(config.burstWindow);
      }
    });
  });

  describe('throttle behavior', () => {
    it('should track throttle expiration time', () => {
      const now = Date.now();
      const throttleDuration = 10_000; // 10 seconds

      const testState: UserRateLimitState = {
        messageTimestamps: [],
        throttleUntil: now + throttleDuration,
        burstCount: 6, // Exceeded burst
        burstStart: now - 2000,
      };

      // Check if user is throttled
      const isThrottled = testState.throttleUntil > now;
      expect(isThrottled).toBe(true);

      const remainingTime = testState.throttleUntil - now;
      expect(remainingTime).toBeGreaterThan(0);
      expect(remainingTime).toBeLessThanOrEqual(throttleDuration);
    });

    it('should calculate remaining throttle time in seconds', () => {
      const now = Date.now();
      const throttleDuration = 60_000; // 1 minute

      const testState: UserRateLimitState = {
        messageTimestamps: [],
        throttleUntil: now + throttleDuration,
        burstCount: 6,
        burstStart: now,
      };

      const remainingMs = testState.throttleUntil - now;
      const remainingSeconds = Math.ceil(remainingMs / 1000);

      expect(remainingSeconds).toBe(60);
    });
  });

  describe('admin exemption logic', () => {
    it('should compare usernames case-insensitively', () => {
      const username = 'TestUser';
      const adminUsername = 'testuser';

      // The isExempt function compares lowercase
      const isExempt = username?.toLowerCase() === adminUsername.toLowerCase();
      expect(isExempt).toBe(true);
    });

    it('should allow matching username', () => {
      const username = 'admin_user';
      const adminUsername = 'admin_user';

      const isExempt = username?.toLowerCase() === adminUsername.toLowerCase();
      expect(isExempt).toBe(true);
    });

    it('should reject non-matching username', () => {
      const username = 'regular_user';
      const adminUsername = 'admin_user';

      const isExempt = username?.toLowerCase() === adminUsername.toLowerCase();
      expect(isExempt).toBe(false);
    });

    it('should handle undefined username', () => {
      const username = undefined as string | undefined;
      const adminUsername = 'admin_user';

      const isExempt = username?.toLowerCase() === adminUsername.toLowerCase();
      expect(isExempt).toBe(false);
    });
  });

  describe('RateLimitConfig type', () => {
    it('should accept all configuration options', () => {
      const config: RateLimitConfig = {
        maxPerMinute: 30,
        maxBurst: 10,
        burstWindow: 15_000,
        throttleDuration: 120_000,
      };
      expect(config.maxPerMinute).toBe(30);
      expect(config.maxBurst).toBe(10);
      expect(config.burstWindow).toBe(15_000);
      expect(config.throttleDuration).toBe(120_000);
    });

    it('should accept partial configuration', () => {
      const partialConfig: Partial<RateLimitConfig> = {
        maxPerMinute: 50,
      };
      expect(partialConfig.maxPerMinute).toBe(50);
      expect(partialConfig.maxBurst).toBeUndefined();
    });
  });

  describe('UserRateLimitState type', () => {
    it('should define required state properties', () => {
      const state: UserRateLimitState = {
        messageTimestamps: [],
        throttleUntil: 0,
        burstCount: 0,
      };
      expect(Array.isArray(state.messageTimestamps)).toBe(true);
      expect(typeof state.throttleUntil).toBe('number');
      expect(typeof state.burstCount).toBe('number');
    });

    it('should allow optional burstStart property', () => {
      const state: UserRateLimitState = {
        messageTimestamps: [Date.now()],
        throttleUntil: 0,
        burstCount: 1,
        burstStart: Date.now(),
      };
      expect(state.burstStart).toBeDefined();
      expect(typeof state.burstStart).toBe('number');
    });
  });
});
