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
export type {
  IObservabilityAdapter,
  ObservabilityEventData,
} from '../adapters/observability/index.js';
export type { IStateReporter } from '../adapters/state-reporting/index.js';
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
export { BatchQueue, ContextBuilder, StuckDetector } from '../batch/index.js';
export { createAdapterFactory, createAdapterFactoryWithOverrides } from './adapter-factory.js';
export { createCloudflareChatAgent } from './cloudflare-agent.js';
export type {
  AdapterBundle,
  CloudflareAgentConfig,
  CloudflareAgentState,
  CloudflareChatAgentClass,
  CloudflareChatAgentMethods,
  MCPServerConnection,
  RouterConfig,
} from './types.js';
//# sourceMappingURL=index.d.ts.map
