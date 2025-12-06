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

import { logger } from '@duyetbot/hono-middleware';
import type { D1Database } from '@duyetbot/observability';
import {
  D1MessagePersistence,
  type IMessagePersistence,
  MemoryMessagePersistence,
} from '../adapters/message-persistence/index.js';
import {
  D1ObservabilityAdapter,
  type IObservabilityAdapter,
  NoOpObservabilityAdapter,
} from '../adapters/observability/index.js';
import { type IStateReporter, NoOpStateReporter } from '../adapters/state-reporting/index.js';
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
export function createAdapterFactory<TEnv extends Record<string, any>>(env: TEnv): AdapterBundle {
  // Detect available bindings
  const hasObservabilityDB = 'OBSERVABILITY_DB' in env && env.OBSERVABILITY_DB;

  logger.debug('[AdapterFactory] Creating adapters', {
    hasObservabilityDB,
  });

  // Create observability adapter
  const observability: IObservabilityAdapter = hasObservabilityDB
    ? new D1ObservabilityAdapter(env.OBSERVABILITY_DB as D1Database)
    : new NoOpObservabilityAdapter();

  // State reporting adapter - requires a stub, not a namespace
  // The factory provides NoOp by default; consumers create StateDOReporter
  // when they have access to a specific stub via getStateDOStub()
  const stateReporter: IStateReporter = new NoOpStateReporter();

  // Create message persistence adapter
  const messagePersistence: IMessagePersistence = hasObservabilityDB
    ? new D1MessagePersistence(env.OBSERVABILITY_DB as D1Database)
    : new MemoryMessagePersistence();

  return {
    observability,
    stateReporter,
    messagePersistence,
  };
}

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
export function createAdapterFactoryWithOverrides<TEnv extends Record<string, any>>(
  overrides: Partial<AdapterBundle>,
  env: TEnv
): AdapterBundle {
  const defaults = createAdapterFactory(env);

  return {
    observability: overrides.observability ?? defaults.observability,
    stateReporter: overrides.stateReporter ?? defaults.stateReporter,
    messagePersistence: overrides.messagePersistence ?? defaults.messagePersistence,
  };
}
