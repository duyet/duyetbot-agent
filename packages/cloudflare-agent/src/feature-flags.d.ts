/**
 * Feature Flags Configuration
 *
 * Simple configuration for routing system.
 * Note: Routing is always enabled - only debug mode is configurable.
 */
import { z } from 'zod';
export declare const RoutingFlagsSchema: z.ZodObject<
  {
    debug: z.ZodDefault<z.ZodBoolean>;
  },
  'strip',
  z.ZodTypeAny,
  {
    debug: boolean;
  },
  {
    debug?: boolean | undefined;
  }
>;
export type RoutingFlags = z.infer<typeof RoutingFlagsSchema>;
export interface FeatureFlagEnv {
  ROUTER_DEBUG?: string;
}
/**
 * Parse feature flags from environment variables.
 */
export declare function parseFlagsFromEnv(env: FeatureFlagEnv): RoutingFlags;
//# sourceMappingURL=feature-flags.d.ts.map
