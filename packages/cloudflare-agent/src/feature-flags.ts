/**
 * Feature Flags Configuration
 *
 * Simple configuration for routing system.
 * Note: Routing is always enabled - only debug mode is configurable.
 */

import { z } from 'zod';

export const RoutingFlagsSchema = z.object({
  debug: z.boolean().default(false),
});

export type RoutingFlags = z.infer<typeof RoutingFlagsSchema>;

export interface FeatureFlagEnv {
  ROUTER_DEBUG?: string;
}

/**
 * Parse feature flags from environment variables.
 */
export function parseFlagsFromEnv(env: FeatureFlagEnv): RoutingFlags {
  return {
    debug: env.ROUTER_DEBUG === 'true' || env.ROUTER_DEBUG === '1',
  };
}
