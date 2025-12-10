/**
 * Serialization helpers for GlobalContext storage
 *
 * Provides functions to serialize and deserialize GlobalContext for
 * storage in Cloudflare Durable Object state and alarms.
 *
 * The full context is preserved during serialization to avoid data loss
 * when storing pending messages in batch state.
 */

import type { GlobalContext } from './global-context.js';

/**
 * Serialize a GlobalContext to JSON string for storage
 *
 * Uses JSON.stringify() to convert the entire context object to a string
 * suitable for storage in Cloudflare Durable Object state or alarms.
 *
 * The context can be fully restored from the serialized form with
 * deserializeContext().
 *
 * @param ctx - The GlobalContext to serialize
 * @returns JSON string representation of the context
 *
 * @example
 * ```typescript
 * const ctx = createGlobalContext(input);
 * const serialized = serializeContext(ctx);
 * // Store in DO state
 * this.state.put('pending_context', serialized);
 * ```
 */
export function serializeContext(ctx: GlobalContext): string {
  return JSON.stringify(ctx);
}

/**
 * Deserialize a GlobalContext from JSON string
 *
 * Parses JSON string back to GlobalContext and restores readonly semantics
 * by freezing immutable fields (platformConfig).
 *
 * @param json - JSON string from serializeContext()
 * @returns Deserialized GlobalContext with readonly semantics restored
 *
 * @example
 * ```typescript
 * const serialized = this.state.get('pending_context');
 * const ctx = deserializeContext(serialized);
 * // Continue processing with restored context
 * ```
 */
export function deserializeContext(json: string): GlobalContext {
  const parsed = JSON.parse(json) as GlobalContext;

  // Restore readonly semantics by freezing immutable fields
  // Cast to mutable type to restore readonly property after parse
  const mutable = parsed as Mutable<GlobalContext>;
  mutable.platformConfig = Object.freeze(mutable.platformConfig);

  return parsed;
}

// Helper type for mutable variant
type Mutable<T> = {
  -readonly [P in keyof T]: T[P];
};
