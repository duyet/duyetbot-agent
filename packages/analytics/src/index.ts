/**
 * Analytics Package
 *
 * Provides analytics collection and observability for duyetbot-agent.
 * Captures all messages and agent steps in append-only fashion.
 */

export { AnalyticsCollector } from './collector/index.js';
export type {
  AnalyticsMessage,
  AnalyticsAgentStep,
  MessageCreateInput,
  StepCreateInput,
  StepCompletion,
  PeriodType,
  AggregateType,
  MessageQueryFilter,
  StepQueryFilter,
  PendingStep,
} from './types.js';

// Storage classes
export * from './storage/index.js';
