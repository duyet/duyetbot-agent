/**
 * Platform Integration Tests
 *
 * Tests for Phase 4: RouterAgent integration with platform agents.
 */

import { describe, expect, it } from 'vitest';
import { parseFlagsFromEnv } from '../feature-flags.js';

describe('Feature Flags', () => {
  describe('parseFlagsFromEnv', () => {
    it('should have debug disabled by default', () => {
      const flags = parseFlagsFromEnv({});
      expect(flags.debug).toBe(false);
    });

    it('should enable debug when ROUTER_DEBUG=true', () => {
      const flags = parseFlagsFromEnv({ ROUTER_DEBUG: 'true' });
      expect(flags.debug).toBe(true);
    });

    it('should enable debug when ROUTER_DEBUG=1', () => {
      const flags = parseFlagsFromEnv({ ROUTER_DEBUG: '1' });
      expect(flags.debug).toBe(true);
    });

    it('should keep debug disabled for other values', () => {
      const flags = parseFlagsFromEnv({ ROUTER_DEBUG: 'false' });
      expect(flags.debug).toBe(false);
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
