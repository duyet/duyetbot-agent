/**
 * Transport Manager
 *
 * Wraps platform-specific transport operations and provides higher-level
 * utilities for message handling, thinking message rotation, and typing indicators.
 *
 * Serves as an abstraction layer between agents and platform-specific transports,
 * enabling consistent behavior across Telegram, GitHub, and other platforms.
 */
import { createThinkingRotator, formatThinkingMessage } from '../format.js';
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
export class TransportManager {
  transport;
  config;
  /**
   * Create a new TransportManager
   * @param transport - Platform-specific transport to wrap
   * @param config - Optional configuration
   */
  constructor(transport, config = {}) {
    this.transport = transport;
    this.config = config;
  }
  /**
   * Send a message via transport
   * @param ctx - Platform-specific context
   * @param text - Message text to send
   * @returns Reference to the sent message (for editing/deletion)
   */
  async send(ctx, text) {
    return this.transport.send(ctx, text);
  }
  /**
   * Edit an existing message
   * @param ctx - Platform-specific context
   * @param ref - Reference to the message to edit
   * @param text - New message text
   * @throws Error if transport doesn't support editing
   */
  async edit(ctx, ref, text) {
    if (!this.transport.edit) {
      throw new Error('Transport does not support message editing');
    }
    await this.transport.edit(ctx, ref, text);
  }
  /**
   * Delete a message
   * @param ctx - Platform-specific context
   * @param ref - Reference to the message to delete
   * @throws Error if transport doesn't support deletion
   */
  async delete(ctx, ref) {
    if (!this.transport.delete) {
      throw new Error('Transport does not support message deletion');
    }
    await this.transport.delete(ctx, ref);
  }
  /**
   * Send typing indicator to show the bot is processing
   * @param ctx - Platform-specific context
   * @throws Error if transport doesn't support typing indicators
   */
  async typing(ctx) {
    if (!this.transport.typing) {
      throw new Error('Transport does not support typing indicators');
    }
    await this.transport.typing(ctx);
  }
  /**
   * Add a reaction/emoji to a message
   * @param ctx - Platform-specific context
   * @param ref - Reference to the message to react to
   * @param emoji - Emoji or reaction identifier
   * @throws Error if transport doesn't support reactions
   */
  async react(ctx, ref, emoji) {
    if (!this.transport.react) {
      throw new Error('Transport does not support reactions');
    }
    await this.transport.react(ctx, ref, emoji);
  }
  /**
   * Parse context to get standard input format
   * @param ctx - Platform-specific context
   * @returns Parsed input with text, userId, chatId, etc.
   */
  parseContext(ctx) {
    return this.transport.parseContext(ctx);
  }
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
  startThinkingRotation(ctx, messageRef, onHeartbeat) {
    const rotator = createThinkingRotator({
      ...(this.config.thinkingMessages && { messages: this.config.thinkingMessages }),
      ...(this.config.thinkingRotationInterval && {
        interval: this.config.thinkingRotationInterval,
      }),
    });
    rotator.start(async (message) => {
      try {
        // Only edit if transport supports it
        if (this.transport.edit) {
          await this.transport.edit(ctx, messageRef, message);
        }
      } catch (err) {
        // Log error but don't throw - allow heartbeat to continue
        console.error('[TransportManager] Failed to rotate thinking message:', err);
      }
      // Call heartbeat callback after rotation completes
      onHeartbeat?.();
    });
    return rotator;
  }
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
  async startThinking(ctx, onHeartbeat) {
    const initialMessage = formatThinkingMessage('markdown');
    const messageRef = await this.send(ctx, initialMessage);
    const rotator = this.startThinkingRotation(ctx, messageRef, onHeartbeat);
    return { rotator, messageRef };
  }
  /**
   * Check if transport supports message editing
   * @returns True if edit() calls will succeed
   */
  canEdit() {
    return typeof this.transport.edit === 'function';
  }
  /**
   * Check if transport supports message deletion
   * @returns True if delete() calls will succeed
   */
  canDelete() {
    return typeof this.transport.delete === 'function';
  }
  /**
   * Check if transport supports typing indicators
   * @returns True if typing() calls will succeed
   */
  canTyping() {
    return typeof this.transport.typing === 'function';
  }
  /**
   * Check if transport supports reactions
   * @returns True if react() calls will succeed
   */
  canReact() {
    return typeof this.transport.react === 'function';
  }
  /**
   * Get underlying transport (for backward compatibility)
   * @returns The wrapped transport instance
   */
  getTransport() {
    return this.transport;
  }
}
