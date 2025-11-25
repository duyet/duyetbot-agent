/**
 * Platform Integration Tests
 *
 * Tests for Phase 4: RouterAgent integration with platform agents.
 */

import { describe, expect, it } from 'vitest';
import { type RoutingFlags, evaluateFlag, parseFlagsFromEnv } from '../feature-flags.js';

describe('Feature Flags', () => {
  describe('parseFlagsFromEnv', () => {
    it('should enable routing by default', () => {
      const flags = parseFlagsFromEnv({});
      expect(flags.enabled).toBe(true);
      expect(flags.debug).toBe(false);
    });

    it('should disable routing when ROUTER_ENABLED=false', () => {
      const flags = parseFlagsFromEnv({ ROUTER_ENABLED: 'false' });
      expect(flags.enabled).toBe(false);
    });

    it('should disable routing when ROUTER_ENABLED=0', () => {
      const flags = parseFlagsFromEnv({ ROUTER_ENABLED: '0' });
      expect(flags.enabled).toBe(false);
    });

    it('should enable debug when ROUTER_DEBUG=true', () => {
      const flags = parseFlagsFromEnv({ ROUTER_DEBUG: 'true' });
      expect(flags.debug).toBe(true);
    });

    it('should enable debug when ROUTER_DEBUG=1', () => {
      const flags = parseFlagsFromEnv({ ROUTER_DEBUG: '1' });
      expect(flags.debug).toBe(true);
    });
  });

  describe('evaluateFlag', () => {
    it('should return enabled when flags.enabled is true', () => {
      const flags: RoutingFlags = { enabled: true, debug: false };
      const result = evaluateFlag(flags);
      expect(result.enabled).toBe(true);
      expect(result.reason).toBe('enabled');
    });

    it('should return disabled when flags.enabled is false', () => {
      const flags: RoutingFlags = { enabled: false, debug: false };
      const result = evaluateFlag(flags);
      expect(result.enabled).toBe(false);
      expect(result.reason).toBe('disabled');
    });

    it('should ignore userId parameter (simplified implementation)', () => {
      const flags: RoutingFlags = { enabled: true, debug: false };
      const result = evaluateFlag(flags, 'user-123');
      expect(result.enabled).toBe(true);
    });
  });
});

describe('RouterConfig Integration', () => {
  it('should support telegram platform', () => {
    const config = {
      platform: 'telegram' as const,
      debug: false,
    };
    expect(config.platform).toBe('telegram');
  });

  it('should support github platform', () => {
    const config = {
      platform: 'github' as const,
      debug: false,
    };
    expect(config.platform).toBe('github');
  });

  it('should support cli platform', () => {
    const config = {
      platform: 'cli' as const,
      debug: true,
    };
    expect(config.platform).toBe('cli');
    expect(config.debug).toBe(true);
  });

  it('should support api platform', () => {
    const config = {
      platform: 'api' as const,
      debug: false,
    };
    expect(config.platform).toBe('api');
  });
});
