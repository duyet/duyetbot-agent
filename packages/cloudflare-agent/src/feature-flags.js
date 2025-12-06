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
/**
 * Parse feature flags from environment variables.
 */
export function parseFlagsFromEnv(env) {
  return {
    debug: env.ROUTER_DEBUG === 'true' || env.ROUTER_DEBUG === '1',
  };
}
