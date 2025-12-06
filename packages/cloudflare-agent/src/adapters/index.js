/**
 * Adapter Interface Layer
 *
 * Provides Dependency Injection abstraction for external service integrations:
 * - Observability: Event tracking and metrics
 * - State Reporting: Cross-session batch coordination
 * - Message Persistence: Message storage and retrieval
 *
 * Each adapter has two implementations:
 * - Production: Real service integration (D1, Durable Objects)
 * - Test/Fallback: No-op or in-memory implementations
 *
 * Usage:
 * ```typescript
 * // Production setup
 * const observability = new D1ObservabilityAdapter(db);
 * const stateReporter = new StateDOReporter(stateDOStub);
 * const persistence = new D1MessagePersistence(db);
 *
 * // Test setup
 * const observability = new NoOpObservabilityAdapter();
 * const stateReporter = new NoOpStateReporter();
 * const persistence = new MemoryMessagePersistence();
 * ```
 */
export { D1MessagePersistence, MemoryMessagePersistence } from './message-persistence/index.js';
export { D1ObservabilityAdapter, NoOpObservabilityAdapter } from './observability/index.js';
export { NoOpStateReporter, StateDOReporter } from './state-reporting/index.js';
