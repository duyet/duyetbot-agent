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

export const MemoryFlagsSchema = z.object({
  mem0Enabled: z.boolean().default(false),
  mem0Strategy: z.enum(['primary-first', 'parallel', 'mem0-for-search']).default('parallel'),
  mem0McpEnabled: z.boolean().default(false),
});

export type MemoryFlags = z.infer<typeof MemoryFlagsSchema>;

export interface FeatureFlagEnv {
  ROUTER_DEBUG?: string;
  MEM0_ENABLED?: string;
  MEM0_STRATEGY?: string;
  MEM0_MCP_ENABLED?: string;
}

/**
 * Parse feature flags from environment variables.
 */
export function parseFlagsFromEnv(env: FeatureFlagEnv): RoutingFlags {
  return {
    debug: env.ROUTER_DEBUG === 'true' || env.ROUTER_DEBUG === '1',
  };
}

/**
 * Parse mem0 feature flags from environment variables.
 */
export function parseMem0Flags(env: Record<string, string | undefined>): MemoryFlags {
  return MemoryFlagsSchema.parse({
    mem0Enabled: env.MEM0_ENABLED === 'true',
    mem0Strategy: env.MEM0_STRATEGY || 'parallel',
    mem0McpEnabled: env.MEM0_MCP_ENABLED === 'true',
  });
}
