/**
 * Feature Flags Configuration
 *
 * Simple configuration for routing system.
 */

import { z } from 'zod';

export const RoutingFlagsSchema = z.object({
  enabled: z.boolean().default(true),
  debug: z.boolean().default(false),
});

export type RoutingFlags = z.infer<typeof RoutingFlagsSchema>;

export interface FeatureFlagEnv {
  ROUTER_DEBUG?: string;
  ROUTER_ENABLED?: string;
}

/**
 * Parse feature flags from environment variables.
 */
export function parseFlagsFromEnv(env: FeatureFlagEnv): RoutingFlags {
  return {
    enabled: env.ROUTER_ENABLED !== 'false' && env.ROUTER_ENABLED !== '0',
    debug: env.ROUTER_DEBUG === 'true' || env.ROUTER_DEBUG === '1',
  };
}

/**
 * Evaluate if routing should be used.
 */
export function evaluateFlag(
  flags: RoutingFlags,
  _userId?: string
): { enabled: boolean; reason: string } {
  if (!flags.enabled) {
    return { enabled: false, reason: 'disabled' };
  }
  return { enabled: true, reason: 'enabled' };
}
