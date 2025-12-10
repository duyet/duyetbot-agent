/**
 * Admin Notifier
 *
 * Utility for sending failure and alert notifications to admin users.
 * Used when batches get stuck, fail after max retries, or other critical events occur.
 */

import { logger } from '@duyetbot/hono-middleware';
import type { MessageRef, Transport } from '../transport.js';

/**
 * Details about a stuck batch for notification
 */
export interface StuckBatchDetails {
  /** Batch ID that was stuck */
  batchId: string | null;
  /** Reason why batch was considered stuck */
  reason: string;
  /** Number of messages that may have been affected */
  messagesAffected: number;
  /** How long the batch was stuck (ms) */
  stuckDurationMs?: number;
}

/**
 * Details about a batch failure for notification
 */
export interface BatchFailureDetails {
  /** Batch ID that failed */
  batchId: string | null;
  /** Error message from the failure */
  error: string;
  /** Number of retry attempts made */
  retryCount: number;
  /** Maximum retries allowed */
  maxRetries: number;
  /** Number of messages that failed */
  messagesAffected: number;
}

/**
 * Configuration for AdminNotifier
 */
export interface AdminNotifierConfig {
  /** Whether notifications are enabled (default: true) */
  enabled?: boolean;
  /** Prefix for notification messages */
  prefix?: string;
}

/**
 * Default configuration for AdminNotifier
 */
export const DEFAULT_ADMIN_NOTIFIER_CONFIG: Required<AdminNotifierConfig> = {
  enabled: true,
  prefix: '⚠️ [System Alert]',
};

/**
 * Formats a stuck batch notification message
 */
export function formatStuckBatchMessage(details: StuckBatchDetails): string {
  const lines = [
    '⚠️ *Stuck Batch Recovered*',
    '',
    `• Batch ID: \`${details.batchId || 'unknown'}\``,
    `• Reason: ${details.reason}`,
    `• Messages affected: ${details.messagesAffected}`,
  ];

  if (details.stuckDurationMs !== undefined) {
    const seconds = Math.round(details.stuckDurationMs / 1000);
    lines.push(`• Stuck for: ${seconds}s`);
  }

  lines.push('', '_The batch has been recovered and messages will be reprocessed._');

  return lines.join('\n');
}

/**
 * Formats a batch failure notification message
 */
export function formatBatchFailureMessage(details: BatchFailureDetails): string {
  const lines = [
    '🚨 *Batch Processing Failed*',
    '',
    `• Batch ID: \`${details.batchId || 'unknown'}\``,
    `• Error: ${details.error}`,
    `• Retries: ${details.retryCount}/${details.maxRetries}`,
    `• Messages affected: ${details.messagesAffected}`,
    '',
    '_Messages have been dropped after max retries. Check logs for details._',
  ];

  return lines.join('\n');
}

/**
 * AdminNotifier class for sending failure alerts to admin
 *
 * @template TContext - Platform-specific context type
 *
 * @example
 * ```typescript
 * const notifier = new AdminNotifier(transport);
 *
 * // Notify about stuck batch
 * await notifier.notifyStuckBatch(ctx, {
 *   batchId: 'batch-123',
 *   reason: 'No heartbeat for 30s',
 *   messagesAffected: 3,
 * });
 *
 * // Notify about failure
 * await notifier.notifyBatchFailure(ctx, {
 *   batchId: 'batch-123',
 *   error: 'LLM API timeout',
 *   retryCount: 6,
 *   maxRetries: 6,
 *   messagesAffected: 2,
 * });
 * ```
 */
export class AdminNotifier<TContext> {
  private readonly config: Required<AdminNotifierConfig>;

  constructor(
    private readonly transport: Transport<TContext>,
    config: AdminNotifierConfig = {}
  ) {
    this.config = { ...DEFAULT_ADMIN_NOTIFIER_CONFIG, ...config };
  }

  /**
   * Notify admin about a stuck batch that was recovered
   *
   * @param ctx - Platform context with admin chat info
   * @param details - Details about the stuck batch
   * @returns Message reference if sent successfully, undefined otherwise
   */
  async notifyStuckBatch(
    ctx: TContext,
    details: StuckBatchDetails
  ): Promise<MessageRef | undefined> {
    if (!this.config.enabled) {
      logger.debug('[AdminNotifier] Notifications disabled, skipping stuck batch alert');
      return undefined;
    }

    try {
      const message = formatStuckBatchMessage(details);
      const ref = await this.transport.send(ctx, message);

      logger.info('[AdminNotifier] Sent stuck batch notification', {
        batchId: details.batchId,
        messageRef: ref,
      });

      return ref;
    } catch (error) {
      logger.error('[AdminNotifier] Failed to send stuck batch notification', {
        batchId: details.batchId,
        error: error instanceof Error ? error.message : String(error),
      });
      return undefined;
    }
  }

  /**
   * Notify admin about a batch that failed after max retries
   *
   * @param ctx - Platform context with admin chat info
   * @param details - Details about the failure
   * @returns Message reference if sent successfully, undefined otherwise
   */
  async notifyBatchFailure(
    ctx: TContext,
    details: BatchFailureDetails
  ): Promise<MessageRef | undefined> {
    if (!this.config.enabled) {
      logger.debug('[AdminNotifier] Notifications disabled, skipping batch failure alert');
      return undefined;
    }

    try {
      const message = formatBatchFailureMessage(details);
      const ref = await this.transport.send(ctx, message);

      logger.info('[AdminNotifier] Sent batch failure notification', {
        batchId: details.batchId,
        retryCount: details.retryCount,
        messageRef: ref,
      });

      return ref;
    } catch (error) {
      logger.error('[AdminNotifier] Failed to send batch failure notification', {
        batchId: details.batchId,
        error: error instanceof Error ? error.message : String(error),
      });
      return undefined;
    }
  }
}
