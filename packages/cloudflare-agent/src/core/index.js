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
// Re-export batch module classes
export { BatchQueue, ContextBuilder, StuckDetector } from '../batch/index.js';
export { createAdapterFactory, createAdapterFactoryWithOverrides } from './adapter-factory.js';
export { createCloudflareChatAgent } from './cloudflare-agent.js';
