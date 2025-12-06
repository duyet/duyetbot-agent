/**
 * Transport Manager
 *
 * Wraps platform-specific transport operations and provides higher-level
 * utilities for message handling, thinking message rotation, and typing indicators.
 *
 * Serves as an abstraction layer between agents and platform-specific transports,
 * enabling consistent behavior across Telegram, GitHub, and other platforms.
 */
import type { ThinkingRotator } from '../format.js';
import type { MessageRef, ParsedInput, Transport } from './types.js';
/**
 * Configuration for TransportManager
 */
export interface TransportManagerConfig {
  /** Custom thinking messages to rotate through */
  thinkingMessages?: string[];
  /** Rotation interval in milliseconds (default: 5000) */
  thinkingRotationInterval?: number;
}
/**
 * TransportManager wraps platform-specific transport operations
 * and provides higher-level utilities for message handling.
 *
 * @template TContext - Platform-specific context type
 *
 * @example
 * ```typescript
 * const manager = new TransportManager(telegramTransport);
 *
 * // Send a message
 * const msgRef = await manager.send(ctx, 'Hello!');
 *
 * // Start thinking rotation
 * const rotator = manager.startThinkingRotation(ctx, msgRef, () => {
 *   // Called on each rotation (for heartbeat, monitoring, etc)
 * });
 *
 * // ... do work ...
 *
 * // Stop rotation and wait for pending callbacks
 * rotator.stop();
 * await rotator.waitForPending();
 *
 * // Edit message with final response
 * await manager.edit(ctx, msgRef, 'Done!');
 * ```
 */
export declare class TransportManager<TContext> {
  private transport;
  private config;
  /**
   * Create a new TransportManager
   * @param transport - Platform-specific transport to wrap
   * @param config - Optional configuration
   */
  constructor(transport: Transport<TContext>, config?: TransportManagerConfig);
  /**
   * Send a message via transport
   * @param ctx - Platform-specific context
   * @param text - Message text to send
   * @returns Reference to the sent message (for editing/deletion)
   */
  send(ctx: TContext, text: string): Promise<MessageRef>;
  /**
   * Edit an existing message
   * @param ctx - Platform-specific context
   * @param ref - Reference to the message to edit
   * @param text - New message text
   * @throws Error if transport doesn't support editing
   */
  edit(ctx: TContext, ref: MessageRef, text: string): Promise<void>;
  /**
   * Delete a message
   * @param ctx - Platform-specific context
   * @param ref - Reference to the message to delete
   * @throws Error if transport doesn't support deletion
   */
  delete(ctx: TContext, ref: MessageRef): Promise<void>;
  /**
   * Send typing indicator to show the bot is processing
   * @param ctx - Platform-specific context
   * @throws Error if transport doesn't support typing indicators
   */
  typing(ctx: TContext): Promise<void>;
  /**
   * Add a reaction/emoji to a message
   * @param ctx - Platform-specific context
   * @param ref - Reference to the message to react to
   * @param emoji - Emoji or reaction identifier
   * @throws Error if transport doesn't support reactions
   */
  react(ctx: TContext, ref: MessageRef, emoji: string): Promise<void>;
  /**
   * Parse context to get standard input format
   * @param ctx - Platform-specific context
   * @returns Parsed input with text, userId, chatId, etc.
   */
  parseContext(ctx: TContext): ParsedInput;
  /**
   * Start thinking message rotation
   *
   * This is useful for long-running operations to show the user
   * that the bot is still working. The rotator will automatically
   * edit the message with different thinking messages at regular intervals.
   *
   * @param ctx - Platform-specific context
   * @param messageRef - Reference to the thinking message to rotate
   * @param onHeartbeat - Optional callback called on each rotation
   * @returns ThinkingRotator instance (call stop() to end rotation)
   *
   * @example
   * ```typescript
   * // Start thinking message
   * const thinkingMsg = await manager.send(ctx, 'Thinking...');
   *
   * // Start rotation with heartbeat callback
   * const rotator = manager.startThinkingRotation(ctx, thinkingMsg, () => {
   *   console.log('Heartbeat: still working...');
   * });
   *
   * // Do long-running work
   * await doLongWork();
   *
   * // Stop rotation before sending final response
   * rotator.stop();
   * await rotator.waitForPending();
   *
   * // Now safe to edit
   * await manager.edit(ctx, thinkingMsg, 'Done!');
   * ```
   */
  startThinkingRotation(
    ctx: TContext,
    messageRef: MessageRef,
    onHeartbeat?: () => void
  ): ThinkingRotator;
  /**
   * Send initial thinking message and start rotation
   *
   * This is a convenience method that combines sending a thinking message
   * and starting rotation in one call.
   *
   * @param ctx - Platform-specific context
   * @param onHeartbeat - Optional callback called on each rotation
   * @returns ThinkingRotator (call stop() to end rotation)
   *
   * @example
   * ```typescript
   * const rotator = await manager.startThinking(ctx, () => {
   *   console.log('Still processing...');
   * });
   *
   * // Do work
   * await doWork();
   *
   * // Stop and get final message
   * rotator.stop();
   * await rotator.waitForPending();
   * ```
   */
  startThinking(
    ctx: TContext,
    onHeartbeat?: () => void
  ): Promise<{
    rotator: ThinkingRotator;
    messageRef: MessageRef;
  }>;
  /**
   * Check if transport supports message editing
   * @returns True if edit() calls will succeed
   */
  canEdit(): boolean;
  /**
   * Check if transport supports message deletion
   * @returns True if delete() calls will succeed
   */
  canDelete(): boolean;
  /**
   * Check if transport supports typing indicators
   * @returns True if typing() calls will succeed
   */
  canTyping(): boolean;
  /**
   * Check if transport supports reactions
   * @returns True if react() calls will succeed
   */
  canReact(): boolean;
  /**
   * Get underlying transport (for backward compatibility)
   * @returns The wrapped transport instance
   */
  getTransport(): Transport<TContext>;
}
//# sourceMappingURL=transport-manager.d.ts.map
