/**
 * Transport Layer Types
 *
 * Core interfaces for platform-specific message transport.
 * Each platform (Telegram, GitHub, etc.) implements Transport<TContext>
 * to provide consistent message sending/receiving abstraction.
 */
/**
 * Message reference returned by transport.send()
 * Platform-specific (e.g., number for Telegram message_id, string for GitHub PR comment id)
 */
export type MessageRef = string | number;
/**
 * Parsed input extracted from platform context
 */
export interface ParsedInput {
  /** The message text */
  text: string;
  /** User identifier */
  userId: string | number;
  /** Chat/conversation identifier */
  chatId: string | number;
  /** Username (platform-specific: Telegram @username, GitHub login) */
  username?: string;
  /** Original message reference (for replies) */
  messageRef?: MessageRef;
  /** Message this is replying to */
  replyTo?: MessageRef;
  /** Additional platform-specific metadata */
  metadata?: Record<string, unknown>;
}
/**
 * Transport interface for platform-specific message operations
 *
 * Defines the contract that each platform (Telegram, GitHub, etc.)
 * must implement to enable agent communication.
 *
 * @template TContext - Platform-specific context type (e.g., TelegramContext, GitHubContext)
 *
 * @example
 * ```typescript
 * const telegramTransport: Transport<TelegramContext> = {
 *   send: async (ctx, text) => {
 *     const result = await ctx.bot.api.sendMessage(ctx.chatId, text);
 *     return result.message_id;
 *   },
 *   edit: async (ctx, ref, text) => {
 *     await ctx.bot.api.editMessageText(ctx.chatId, ref, text);
 *   },
 *   typing: async (ctx) => {
 *     await ctx.bot.api.sendChatAction(ctx.chatId, 'typing');
 *   },
 *   parseContext: (ctx) => ({
 *     text: ctx.message.text,
 *     userId: ctx.message.from.id,
 *     chatId: ctx.message.chat.id,
 *   }),
 * };
 * ```
 */
export interface Transport<TContext> {
  /**
   * Send a message and return reference for future edits
   * @param ctx - Platform-specific context
   * @param text - Message text to send
   * @returns Reference to the sent message (for edit/delete/react operations)
   */
  send: (ctx: TContext, text: string) => Promise<MessageRef>;
  /**
   * Edit an existing message (useful for streaming updates and progress)
   * @param ctx - Platform-specific context
   * @param ref - Reference to the message to edit
   * @param text - New message text
   */
  edit?: (ctx: TContext, ref: MessageRef, text: string) => Promise<void>;
  /**
   * Delete a message
   * @param ctx - Platform-specific context
   * @param ref - Reference to the message to delete
   */
  delete?: (ctx: TContext, ref: MessageRef) => Promise<void>;
  /**
   * Send typing indicator to show the bot is processing
   * Platforms without support can omit this method
   * @param ctx - Platform-specific context
   */
  typing?: (ctx: TContext) => Promise<void>;
  /**
   * Add reaction to a message (emoji or reaction identifier)
   * @param ctx - Platform-specific context
   * @param ref - Reference to the message to react to
   * @param emoji - Emoji or reaction identifier
   */
  react?: (ctx: TContext, ref: MessageRef, emoji: string) => Promise<void>;
  /**
   * Extract input data from platform context
   * Converts platform-specific context to generic ParsedInput
   * @param ctx - Platform-specific context
   * @returns Parsed input with text, userId, chatId, etc.
   */
  parseContext: (ctx: TContext) => ParsedInput;
}
/**
 * Lifecycle hooks for agent handle() method
 *
 * @template TContext - Platform-specific context type
 */
export interface TransportHooks<TContext> {
  /**
   * Called before processing the message
   * Use for logging, rate limiting, metrics, etc.
   */
  beforeHandle?: (ctx: TContext) => Promise<void>;
  /**
   * Called after successfully sending the response
   * Use for analytics, logging, cleanup, etc.
   */
  afterHandle?: (ctx: TContext, response: string) => Promise<void>;
  /**
   * Called when an error occurs during handling
   * Use for error reporting and logging.
   * @param ctx - Platform-specific context
   * @param error - The error that occurred
   * @param messageRef - Reference to the thinking message (if available)
   */
  onError?: (ctx: TContext, error: Error, messageRef?: MessageRef) => Promise<void>;
}
//# sourceMappingURL=types.d.ts.map
