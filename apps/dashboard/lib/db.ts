/**
 * Database Connection Helper
 * Provides initialized storage classes bound to D1 database
 */

import {
  AnalyticsMessageStorage,
  AgentStepStorage,
  AggregateStorage,
  ConversationStorage,
  CostConfigStorage,
} from '@duyetbot/analytics';

export interface Env {
  DB: D1Database;
}

export function getDB(env: Env) {
  return {
    messages: new AnalyticsMessageStorage(env.DB),
    steps: new AgentStepStorage(env.DB),
    aggregates: new AggregateStorage(env.DB),
    conversations: new ConversationStorage(env.DB),
    costs: new CostConfigStorage(env.DB),
  };
}

export type DB = ReturnType<typeof getDB>;
