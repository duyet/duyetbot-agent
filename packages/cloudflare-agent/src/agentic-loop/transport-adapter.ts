/**
 * Transport Adapter for AgenticLoop Progress
 *
 * Bridges the AgenticLoop progress callbacks to the Transport layer,
 * enabling real-time status updates to Telegram/GitHub users.
 *
 * Creates the three callbacks needed by AgenticLoopConfig:
 * - onProgress: Reports thinking/tool/responding states
 * - onToolStart: Detailed tool start with arguments
 * - onToolEnd: Detailed tool completion with results
 *
 * Also handles heartbeat reporting to keep Durable Objects alive
 * during long-running agentic loops.
 *
 * @example
 * ```typescript
 * const adapter = createTransportAdapter(
 *   (text) => transport.edit(ctx, messageRef, text),
 *   () => ctx.reportHeartbeat()
 * );
 *
 * const loop = new AgenticLoop({
 *   tools: coreTools,
 *   maxIterations: 50,
 *   ...adapter.callbacks
 * });
 * ```
 */

import { createProgressTracker, formatThinkingMessage, type ProgressTracker } from './progress.js';
import type { AgenticLoopConfig, ProgressUpdate, ToolResult } from './types.js';

/**
 * Configuration for the transport adapter
 */
export interface TransportAdapterConfig {
  /** Function to edit/update the progress message (e.g., transport.edit) */
  editMessage: (text: string) => Promise<void>;
  /** Function to report heartbeat to keep DO alive (optional) */
  reportHeartbeat?: () => Promise<void>;
  /** Maximum updates to display (default: 5) */
  maxDisplayedUpdates?: number;
  /** Whether to call heartbeat on every progress update (default: true) */
  heartbeatOnProgress?: boolean;
  /** Whether to send typing indicator (optional) */
  sendTyping?: () => Promise<void>;
}

/**
 * Transport adapter result containing callbacks and tracker
 */
export interface TransportAdapter {
  /** Callbacks to pass to AgenticLoopConfig */
  callbacks: Pick<AgenticLoopConfig, 'onProgress' | 'onToolStart' | 'onToolEnd'>;
  /** The underlying progress tracker for direct access */
  tracker: ProgressTracker;
}

/**
 * Create a transport adapter for AgenticLoop
 *
 * Bridges progress callbacks to the transport layer for real-time updates.
 *
 * @param config - Adapter configuration
 * @returns Callbacks for AgenticLoopConfig and the tracker instance
 *
 * @example
 * ```typescript
 * const adapter = createTransportAdapter({
 *   editMessage: (text) => transport.edit(ctx, ref, text),
 *   reportHeartbeat: () => doHeartbeat(),
 * });
 *
 * const loop = new AgenticLoop({
 *   ...adapter.callbacks,
 *   tools: myTools,
 * });
 * ```
 */
export function createTransportAdapter(config: TransportAdapterConfig): TransportAdapter {
  const {
    editMessage,
    reportHeartbeat,
    maxDisplayedUpdates = 5,
    heartbeatOnProgress = true,
    sendTyping,
  } = config;

  // Create progress tracker connected to transport
  const tracker = createProgressTracker(editMessage, { maxDisplayedUpdates });

  // Create onProgress callback
  const onProgress: AgenticLoopConfig['onProgress'] = async (update: ProgressUpdate) => {
    // Map progress update type to tracker method
    switch (update.type) {
      case 'thinking':
        await tracker.thinking(update.iteration + 1); // Convert to 1-indexed
        break;
      case 'tool_start':
        if (update.toolName) {
          await tracker.toolStart(update.toolName, update.iteration + 1);
        }
        break;
      case 'tool_complete':
        if (update.toolName) {
          await tracker.toolComplete(
            update.toolName,
            { success: true, output: '', durationMs: update.durationMs ?? 0 },
            update.iteration + 1
          );
        }
        break;
      case 'tool_error':
        if (update.toolName) {
          await tracker.toolComplete(
            update.toolName,
            {
              success: false,
              output: '',
              error: update.message.includes('failed:')
                ? (update.message.split('failed:')[1]?.trim() ?? 'Unknown error')
                : 'Unknown error',
              durationMs: update.durationMs ?? 0,
            },
            update.iteration + 1
          );
        }
        break;
      case 'responding':
        await tracker.responding(update.iteration + 1);
        break;
    }

    // Report heartbeat to keep DO alive
    if (heartbeatOnProgress && reportHeartbeat) {
      try {
        await reportHeartbeat();
      } catch {
        // Ignore heartbeat errors - don't crash the loop
      }
    }

    // Send typing indicator if available
    if (sendTyping) {
      try {
        await sendTyping();
      } catch {
        // Ignore typing errors
      }
    }
  };

  // Create onToolStart callback (more detailed than onProgress)
  const onToolStart: AgenticLoopConfig['onToolStart'] = async (
    _toolName: string,
    _args: Record<string, unknown>
  ) => {
    // The progress callback already handles basic tool_start
    // This callback is for additional detailed logging/metrics if needed
    // Currently just a pass-through for future extension
  };

  // Create onToolEnd callback (more detailed than onProgress)
  const onToolEnd: AgenticLoopConfig['onToolEnd'] = async (
    _toolName: string,
    _result: ToolResult
  ) => {
    // The progress callback already handles tool_complete/tool_error
    // This callback is for additional detailed logging/metrics if needed
    // Currently just a pass-through for future extension
  };

  return {
    callbacks: {
      onProgress,
      onToolStart,
      onToolEnd,
    },
    tracker,
  };
}

/**
 * Create a simple progress callback that just updates a message
 *
 * For cases where only basic progress display is needed without
 * the full tracker infrastructure.
 *
 * @param editMessage - Function to edit the progress message
 * @returns onProgress callback for AgenticLoopConfig
 *
 * @example
 * ```typescript
 * const loop = new AgenticLoop({
 *   onProgress: createSimpleProgressCallback(
 *     (text) => transport.edit(ctx, ref, text)
 *   ),
 *   tools: myTools,
 * });
 * ```
 */
export function createSimpleProgressCallback(
  editMessage: (text: string) => Promise<void>
): AgenticLoopConfig['onProgress'] {
  return async (update: ProgressUpdate) => {
    await editMessage(update.message);
  };
}

/**
 * Format a progress update for display
 *
 * Converts a ProgressUpdate to a human-readable string.
 * Uses the centralized formatThinkingMessage for thinking updates.
 *
 * @param update - The progress update to format
 * @returns Formatted string
 */
export function formatProgressUpdate(update: ProgressUpdate): string {
  switch (update.type) {
    case 'thinking':
      // Use the message if it already contains actual content, otherwise use rotator
      // Check if message starts with ⏺ (already formatted) or contains actual text
      if (update.message && !update.message.includes('Thinking...')) {
        return update.message.startsWith('⏺')
          ? update.message
          : formatThinkingMessage(update.message);
      }
      return formatThinkingMessage();
    case 'tool_start':
      return `🔧 Running ${update.toolName}...`;
    case 'tool_complete':
      return `✅ ${update.toolName} completed${update.durationMs ? ` (${update.durationMs}ms)` : ''}`;
    case 'tool_error':
      return `❌ ${update.toolName} failed`;
    case 'responding':
      return `📝 Generating response...`;
    default:
      return update.message;
  }
}
