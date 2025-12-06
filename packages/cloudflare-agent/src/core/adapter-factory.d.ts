/**
 * Adapter Factory
 *
 * Creates the appropriate adapter implementations based on available environment bindings.
 * This enables dependency injection for cleaner testing and flexibility.
 *
 * Adapters created:
 * - Observability: D1ObservabilityAdapter (if DB available) or NoOpObservabilityAdapter
 * - StateReporting: StateDOReporter (if StateDO available) or NoOpStateReporter
 * - MessagePersistence: D1MessagePersistence (if DB available) or MemoryMessagePersistence
 */
import type { AdapterBundle } from './types.js';
/**
 * Create adapter instances based on environment configuration
 *
 * Performs feature detection on the environment to determine which
 * adapter implementations are available:
 * - Checks for 'OBSERVABILITY_DB' binding for D1 support
 * - Checks for 'StateDO' binding for Durable Object support
 *
 * Falls back to no-op or in-memory implementations if production
 * bindings are unavailable (e.g., in tests or local development).
 *
 * @param env - Environment with optional bindings
 * @returns AdapterBundle with all three adapters configured
 *
 * @example
 * ```typescript
 * // Production setup with all bindings
 * const adapters = createAdapterFactory(env);
 * // → D1ObservabilityAdapter, StateDOReporter, D1MessagePersistence
 *
 * // Test setup (missing bindings)
 * const adapters = createAdapterFactory({});
 * // → NoOpObservabilityAdapter, NoOpStateReporter, MemoryMessagePersistence
 * ```
 */
export declare function createAdapterFactory<TEnv extends Record<string, any>>(
  env: TEnv
): AdapterBundle;
/**
 * Create a custom adapter bundle for testing
 *
 * Useful for creating mock or stubbed adapters in test scenarios.
 *
 * @param overrides - Partial adapter bundle to override defaults
 * @param env - Environment for creating default adapters
 * @returns Complete AdapterBundle with overrides applied
 *
 * @example
 * ```typescript
 * const adapters = createAdapterFactoryWithOverrides({
 *   observability: mockObservabilityAdapter,
 * }, env);
 * ```
 */
export declare function createAdapterFactoryWithOverrides<TEnv extends Record<string, any>>(
  overrides: Partial<AdapterBundle>,
  env: TEnv
): AdapterBundle;
//# sourceMappingURL=adapter-factory.d.ts.map
