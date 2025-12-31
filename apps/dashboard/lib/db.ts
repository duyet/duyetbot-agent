/**
 * Database Connection Helper
 * Provides initialized storage classes bound to D1 database
 * Uses getCloudflareContext() for proper binding access in OpenNext
 */

import {
  AgentStepStorage,
  AggregateStorage,
  AnalyticsMessageStorage,
  ConversationStorage,
  CostConfigStorage,
} from '@duyetbot/analytics';
import { getCloudflareContext } from '@opennextjs/cloudflare';

// Env interface matching wrangler.toml bindings
export interface Env {
  DB: D1Database;
}

/**
 * Get database instance from explicit env (for API routes)
 */
export function getDB(env: Env) {
  return {
    messages: new AnalyticsMessageStorage(env.DB),
    steps: new AgentStepStorage(env.DB),
    aggregates: new AggregateStorage(env.DB),
    conversations: new ConversationStorage(env.DB),
    costs: new CostConfigStorage(env.DB),
  };
}

/**
 * Get database instance using Cloudflare context
 * Use this in Server Components and API routes
 * Uses async mode to support both static and dynamic routes
 */
export async function getDBFromContext() {
  const ctx = await getCloudflareContext<{ DB: D1Database }>({ async: true });
  if (!ctx.env?.DB) {
    throw new Error('Database binding not available. Ensure D1 is configured in wrangler.toml');
  }
  return {
    messages: new AnalyticsMessageStorage(ctx.env.DB),
    steps: new AgentStepStorage(ctx.env.DB),
    aggregates: new AggregateStorage(ctx.env.DB),
    conversations: new ConversationStorage(ctx.env.DB),
    costs: new CostConfigStorage(ctx.env.DB),
  };
}

export type DB = ReturnType<typeof getDB>;
