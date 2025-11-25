/**
 * Context Engineering Module
 *
 * Tools for managing agent context: monitoring, compaction, and pruning
 */

// Compaction
export {
  compactContext,
  createAIGatewaySummarizer,
  createContextManager,
  createDefaultSummarizer,
} from './compaction.js';
// Monitoring
export {
  estimateMessageTokens,
  estimateTokens,
  estimateToolTokens,
  getContextStatus,
  monitorContext,
  needsCompaction,
} from './monitor.js';
// Pruning
export {
  applyPruning,
  deduplicateSystemMessages,
  pruneToolResults,
  truncateToolResults,
} from './pruning.js';
// Types
export type {
  CompactedContext,
  ContextBreakdown,
  ContextConfig,
  ContextMetrics,
  PersistFn,
  SummarizerFn,
} from './types.js';
export { createContextConfig, DEFAULT_CONTEXT_CONFIG } from './types.js';
