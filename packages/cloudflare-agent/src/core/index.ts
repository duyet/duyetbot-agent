/**
 * Core CloudflareAgent Module
 *
 * Exports the refactored CloudflareAgent orchestrator and supporting types.
 * This is the public API for creating CloudflareChatAgent instances.
 *
 * Phase 5 Refactoring Architecture:
 * ┌──────────────────────────────────────────┐
 * │  createCloudflareChatAgent()              │
 * │  (Slim orchestrator ~400 LOC)             │
 * ├──────────────────────────────────────────┤
 * │ Delegates to:                            │
 * │ - BatchQueue (message queuing)            │
 * │ - BatchProcessor (batch execution)        │
 * │ - TransportManager (platform messaging)   │
 * │ - ContextBuilder (context reconstruction) │
 * │ - StuckDetector (hung batch recovery)     │
 * │ - AdapterBundle (observability, state)    │
 * └──────────────────────────────────────────┘
 */

export type { IMessagePersistence, SessionId } from '../adapters/message-persistence/index.js';
// Re-export adapter interfaces for custom implementations
export type {
  IObservabilityAdapter,
  ObservabilityEventData,
} from '../adapters/observability/index.js';
export type { IStateReporter } from '../adapters/state-reporting/index.js';
// Re-export batch types for users of batchQueue
export type {
  BatchConfig,
  BatchState,
  BatchStatus,
  EnhancedBatchState,
  MessageStage,
  PendingMessage,
  QueueResult,
  ReceiveMessageResult,
  RetryConfig,
} from '../batch/index.js';
// Re-export batch module classes
export { BatchQueue, ContextBuilder, StuckDetector } from '../batch/index.js';
export { createAdapterFactory, createAdapterFactoryWithOverrides } from './adapter-factory.js';
export { createCloudflareChatAgent } from './cloudflare-agent.js';
// Re-export types for public API
export type {
  AdapterBundle,
  CloudflareAgentConfig,
  CloudflareAgentState,
  CloudflareChatAgentClass,
  CloudflareChatAgentMethods,
  MCPServerConnection,
  RouterConfig,
} from './types.js';
