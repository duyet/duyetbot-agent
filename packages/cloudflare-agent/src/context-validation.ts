/**
 * Context Validation & Type Safety
 *
 * Ensures all required context is passed through call chains without missing fields.
 * Provides runtime validation with strong TypeScript typing.
 *
 * @example
 * ```typescript
 * // Type-safe context creation
 * const ctx = TelegramContextValidator.create({
 *   token: env.BOT_TOKEN,
 *   chatId: 123456,
 *   // ... required fields
 * });  // Throws if any required field missing
 *
 * // Type guards for conditional logic
 * if (isAdminContext(ctx)) {
 *   // ctx is now narrowed to AdminTelegramContext
 * }
 * ```
 */

import type { DebugContext } from './types.js';

/**
 * Full Telegram context with all required fields
 * (Cannot be created without all fields)
 */
export interface TelegramContextFull {
  /** Bot token for API calls */
  token: string;
  /** Chat ID to send messages to */
  chatId: number;
  /** User ID */
  userId: number;
  /** Whether current user is an admin */
  isAdmin: boolean;
  /** Username (optional) */
  username?: string;
  /** Admin username for detailed errors */
  adminUsername?: string;
  /** Message text */
  text: string;
  /** Start time for duration tracking */
  startTime: number;
  /** Request ID for trace correlation */
  requestId?: string;
  /** Debug context for admin users (routing flow, timing, classification) */
  debugContext?: DebugContext;
  /** Parse mode for message formatting */
  parseMode?: 'HTML' | 'MarkdownV2';
  /** Message ID of the user's message */
  messageId: number;
  /** Message ID of the quoted message (when user replied) */
  replyToMessageId?: number;
  /** Whether this is a group or supergroup chat */
  isGroupChat: boolean;
}

/**
 * Admin Telegram context - narrows isAdmin to true and requires debugContext
 * Used for operations that should only be available to admins
 */
export interface AdminTelegramContext extends TelegramContextFull {
  isAdmin: true;
  debugContext: DebugContext;
}

/**
 * Validate context has all required fields
 *
 * @throws Error if any required field is missing or invalid
 * @example
 * ```typescript
 * assertContextComplete(ctx);  // Throws or narrows type
 * // Now ctx is TelegramContextFull
 * ```
 */
export function assertContextComplete(ctx: any): asserts ctx is TelegramContextFull {
  const requiredFields = [
    'token',
    'chatId',
    'userId',
    'isAdmin',
    'text',
    'startTime',
    'messageId',
    'isGroupChat',
  ] as const;

  const missingFields: string[] = [];

  for (const field of requiredFields) {
    if (!(field in ctx) || ctx[field] === undefined) {
      missingFields.push(field);
    }
  }

  if (missingFields.length > 0) {
    throw new Error(`[VALIDATION] Context missing required fields: ${missingFields.join(', ')}`);
  }

  // Validate field types
  if (typeof ctx.token !== 'string') {
    throw new Error('[VALIDATION] token must be string');
  }
  if (typeof ctx.chatId !== 'number') {
    throw new Error('[VALIDATION] chatId must be number');
  }
  if (typeof ctx.userId !== 'number') {
    throw new Error('[VALIDATION] userId must be number');
  }
  if (typeof ctx.isAdmin !== 'boolean') {
    throw new Error('[VALIDATION] isAdmin must be boolean');
  }
}

/**
 * Validate admin context has all required fields
 *
 * @throws Error if not admin or debugContext missing
 */
export function assertAdminContext(ctx: any): asserts ctx is AdminTelegramContext {
  assertContextComplete(ctx);

  if (ctx.isAdmin !== true) {
    throw new Error('[VALIDATION] Admin context requires isAdmin=true');
  }

  if (!ctx.debugContext) {
    throw new Error('[VALIDATION] Admin context requires debugContext');
  }
}

/**
 * Type guard to check if context is admin context
 * Use in conditionals for type narrowing
 *
 * @example
 * ```typescript
 * if (isAdminContext(ctx)) {
 *   // ctx is now AdminTelegramContext
 *   const footer = formatDebugFooter(ctx.debugContext);
 * }
 * ```
 */
export function isAdminContext(ctx: TelegramContextFull): ctx is AdminTelegramContext {
  return ctx.isAdmin === true && ctx.debugContext !== undefined;
}

/**
 * Type guard to check if context has messaging fields
 */
export function hasMessagingFields(ctx: any): ctx is TelegramContextFull {
  return (
    typeof ctx.token === 'string' &&
    typeof ctx.chatId === 'number' &&
    typeof ctx.userId === 'number'
  );
}

/**
 * Builder pattern for creating context with validation
 *
 * @example
 * ```typescript
 * const ctx = new TelegramContextBuilder()
 *   .setToken(env.BOT_TOKEN)
 *   .setChatId(123456)
 *   .setUserId(789)
 *   .setIsAdmin(true)
 *   .setText("hello")
 *   .setStartTime(Date.now())
 *   .setMessageId(100)
 *   .setIsGroupChat(false)
 *   .build();  // Throws if any required field missing
 * ```
 */
export class TelegramContextBuilder {
  private data: Record<string, unknown> = {};

  /** Set bot token */
  setToken(token: string): this {
    if (!token) {
      throw new Error('[BUILDER] token cannot be empty');
    }
    this.data.token = token;
    return this;
  }

  /** Set chat ID */
  setChatId(chatId: number): this {
    if (typeof chatId !== 'number' || chatId <= 0) {
      throw new Error('[BUILDER] chatId must be positive number');
    }
    this.data.chatId = chatId;
    return this;
  }

  /** Set user ID */
  setUserId(userId: number): this {
    if (typeof userId !== 'number' || userId <= 0) {
      throw new Error('[BUILDER] userId must be positive number');
    }
    this.data.userId = userId;
    return this;
  }

  /** Set admin status */
  setIsAdmin(isAdmin: boolean): this {
    if (typeof isAdmin !== 'boolean') {
      throw new Error('[BUILDER] isAdmin must be boolean');
    }
    this.data.isAdmin = isAdmin;
    return this;
  }

  /** Set username */
  setUsername(username: string | undefined): this {
    this.data.username = username;
    return this;
  }

  /** Set admin username */
  setAdminUsername(adminUsername: string | undefined): this {
    this.data.adminUsername = adminUsername;
    return this;
  }

  /** Set message text */
  setText(text: string): this {
    if (!text) {
      throw new Error('[BUILDER] text cannot be empty');
    }
    this.data.text = text;
    return this;
  }

  /** Set start time */
  setStartTime(startTime: number): this {
    if (typeof startTime !== 'number' || startTime <= 0) {
      throw new Error('[BUILDER] startTime must be positive number');
    }
    this.data.startTime = startTime;
    return this;
  }

  /** Set request ID for tracing */
  setRequestId(requestId: string | undefined): this {
    this.data.requestId = requestId;
    return this;
  }

  /** Set debug context */
  setDebugContext(debugContext: DebugContext | undefined): this {
    this.data.debugContext = debugContext;
    return this;
  }

  /** Set parse mode */
  setParseMode(parseMode: 'HTML' | 'MarkdownV2' | undefined): this {
    this.data.parseMode = parseMode;
    return this;
  }

  /** Set message ID */
  setMessageId(messageId: number): this {
    if (typeof messageId !== 'number' || messageId <= 0) {
      throw new Error('[BUILDER] messageId must be positive number');
    }
    this.data.messageId = messageId;
    return this;
  }

  /** Set reply-to message ID */
  setReplyToMessageId(replyToMessageId: number | undefined): this {
    if (
      replyToMessageId !== undefined &&
      (typeof replyToMessageId !== 'number' || replyToMessageId <= 0)
    ) {
      throw new Error('[BUILDER] replyToMessageId must be positive number or undefined');
    }
    this.data.replyToMessageId = replyToMessageId;
    return this;
  }

  /** Set if group chat */
  setIsGroupChat(isGroupChat: boolean): this {
    if (typeof isGroupChat !== 'boolean') {
      throw new Error('[BUILDER] isGroupChat must be boolean');
    }
    this.data.isGroupChat = isGroupChat;
    return this;
  }

  /**
   * Build context with validation
   *
   * @throws Error if any required field missing or invalid
   * @returns Complete TelegramContextFull
   */
  build(): TelegramContextFull {
    const required = [
      'token',
      'chatId',
      'userId',
      'isAdmin',
      'text',
      'startTime',
      'messageId',
      'isGroupChat',
    ] as const;

    const missingFields: string[] = [];
    for (const field of required) {
      if (!(field in this.data) || this.data[field] === undefined) {
        missingFields.push(field);
      }
    }

    if (missingFields.length > 0) {
      throw new Error(
        `[BUILDER] Cannot build context - missing required fields: ${missingFields.join(', ')}`
      );
    }

    return this.data as unknown as TelegramContextFull;
  }
}

/**
 * Validate and update context fields immutably
 *
 * @throws Error if update would create incomplete context
 * @example
 * ```typescript
 * const updated = updateContextSafe(ctx, { debugContext: newDebugContext });
 * // Or: returns error string instead of throwing
 * const result = updateContextSafe(ctx, updates, true);
 * if (result instanceof Error) {
 *   logger.error(result.message);
 * }
 * ```
 */
export function updateContextSafe(
  ctx: TelegramContextFull,
  updates: Partial<TelegramContextFull>,
  returnError = false
): TelegramContextFull | Error {
  const updated = { ...ctx, ...updates };

  try {
    assertContextComplete(updated);
    return updated;
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    if (returnError) {
      return error;
    }
    throw error;
  }
}

/**
 * Validate context in middleware
 *
 * @example
 * ```typescript
 * export function contextValidationMiddleware() {
 *   return async (ctx: any, next: () => Promise<void>) => {
 *     try {
 *       assertContextComplete(ctx);
 *       await next();
 *     } catch (err) {
 *       logger.error('[VALIDATION]', err);
 *       throw err;
 *     }
 *   };
 * }
 * ```
 */
export function validateContextMiddleware() {
  return async (ctx: any, next: () => Promise<void>) => {
    try {
      assertContextComplete(ctx);

      // Optional: warn if admin flags are inconsistent
      if (ctx.isAdmin && !ctx.adminUsername) {
        console.warn('[CTX] Admin flag set but adminUsername missing');
      }

      if (ctx.isAdmin && !ctx.debugContext) {
        console.warn('[CTX] Admin user but debugContext missing');
      }

      await next();
    } catch (err) {
      console.error('[CTX_VALIDATION]', err);
      throw err;
    }
  };
}
