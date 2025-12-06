/**
 * Observability Adapter Types
 *
 * Provides interface definitions for observability event tracking using Dependency Injection.
 */
import type { AgentStep, Classification } from '@duyetbot/observability';
/**
 * Data structure for observability events
 */
export interface ObservabilityEventData {
  /** Unique event ID for tracking */
  eventId: string;
  /** Current event status */
  status?: 'pending' | 'processing' | 'success' | 'error';
  /** Timestamp when event completed */
  completedAt?: number;
  /** Total duration in milliseconds */
  durationMs?: number;
  /** Response text from agent */
  responseText?: string;
  /** Error type if failed */
  errorType?: string;
  /** Error message if failed */
  errorMessage?: string;
  /** Router classification result */
  classification?: Classification;
  /** Agent execution steps */
  agents?: AgentStep[];
  /** Token usage statistics */
  tokenUsage?: {
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
    cachedTokens?: number;
    reasoningTokens?: number;
  };
  /** Model name used for processing */
  model?: string;
}
/**
 * Interface for observability event persistence
 *
 * Implementations should use fire-and-forget pattern (async operations that don't block main flow).
 * Errors should be logged but not thrown.
 */
export interface IObservabilityAdapter {
  /**
   * Upsert an observability event
   *
   * Uses UPSERT semantics - creates new event if not exists, updates if exists.
   * This is a fire-and-forget operation and should never throw.
   *
   * @param data - Event data to upsert
   */
  upsertEvent(data: ObservabilityEventData): void;
}
//# sourceMappingURL=types.d.ts.map
