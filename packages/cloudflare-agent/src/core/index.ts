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
// Re-export batch types for users of batchQueue
export type { IStateReporter } from '../adapters/state-reporting/index.js';

export { createAdapterFactory, createAdapterFactoryWithOverrides } from './adapter-factory.js';

// Re-export types for public API
export type { AdapterBundle } from './types.js';
