/**
 * Context module - Unified Pipeline Context (UPC)
 *
 * Provides GlobalContext and SpanContext for managing execution state
 * across all agents in the pipeline. Supports both sequential and parallel
 * agent execution patterns.
 */

// Batch context helpers (for message pipeline transformations)
export type {
  AdminContext,
  AdminContextSources,
  BuildContextOptions,
  BuildResponseTargetOptions,
  ExtractedMetadata,
  ResponseTarget,
} from './batch-context-helpers.js';
export {
  buildContextFromBatch,
  buildResponseTarget,
  extractAdminContext,
  extractMessageMetadata,
} from './batch-context-helpers.js';
// Global Context (main interface and factory)
export type {
  AgentSpan,
  GlobalContext,
  Platform,
  QueryClassification,
  RoutingDecisionRecord,
  TokenUsageRecord,
  ToolCallRecord,
} from './global-context.js';
export {
  createGlobalContext,
  createSpanId,
  deserializeContext,
  serializeContext,
} from './global-context.js';
// Helpers for sequential agent execution
export {
  addError,
  addWarning,
  enterAgent,
  exitAgent,
  recordTokenUsage,
  recordToolCall,
  setMetadata,
  setTiming,
} from './helpers.js';
// Span Context (for parallel agent execution)
export type { SpanContext } from './span-context.js';
export {
  addErrorSpan,
  addWarningSpan,
  completeSpan,
  createSpanContext,
  recordTokenUsageSpan,
  recordToolCallSpan,
  setMetadataSpan,
} from './span-context.js';
// Webhook adapters
export type {
  GitHubEnv,
  GitHubWebhookContext,
  TelegramEnv,
  TelegramUpdate,
  WebhookInput,
} from './webhook-adapters.js';
export { githubToWebhookInput, telegramToWebhookInput } from './webhook-adapters.js';
