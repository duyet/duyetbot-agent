/**
 * Shared types for Telegram webhook middlewares
 *
 * These types define the structure of Telegram updates, webhook context,
 * environment bindings, and middleware variables used across the parser
 * and authorization middlewares.
 */

/**
 * Telegram update payload structure
 *
 * Represents the incoming webhook payload from Telegram.
 * Only includes fields relevant to message processing.
 *
 * @see https://core.telegram.org/bots/api#update
 */
export interface TelegramUpdate {
  message?: {
    /** Unique message identifier */
    message_id: number;
    /** Sender information (optional for channel posts) */
    from?: {
      /** Unique user identifier */
      id: number;
      /** Username without @ prefix */
      username?: string;
      /** User's first name */
      first_name: string;
    };
    /** Chat where message was sent */
    chat: {
      /** Unique chat identifier */
      id: number;
    };
    /** Message text content */
    text?: string;
  };
}

/**
 * Parsed webhook context available to downstream handlers
 *
 * Contains extracted and validated data from the Telegram update,
 * ready for use by message handlers and agents.
 */
export interface WebhookContext {
  /** Telegram user ID of the sender */
  userId: number;
  /** Chat ID where message was received */
  chatId: number;
  /** Message text content */
  text: string;
  /** Username of the sender (without @ prefix) */
  username?: string;
  /** Timestamp when processing started (for latency tracking) */
  startTime: number;
}

/**
 * Environment bindings for Telegram bot worker
 *
 * Defines the required and optional environment variables
 * available in the Cloudflare Worker context.
 */
export interface Env {
  /** Comma-separated list of allowed Telegram user IDs */
  TELEGRAM_ALLOWED_USERS?: string;
  /** Telegram Bot API token */
  TELEGRAM_BOT_TOKEN: string;
}

/**
 * Variables set by the parser middleware
 *
 * These variables are available to downstream middlewares and handlers
 * after the parser middleware has processed the request.
 */
export type ParserVariables = {
  /** Parsed webhook context, undefined if parsing failed */
  webhookContext: WebhookContext | undefined;
  /** Whether to skip further processing (invalid request) */
  skipProcessing: boolean;
};

/**
 * Variables set by the authorization middleware
 *
 * Extends ParserVariables with authorization-specific state.
 * These variables are available after both parser and auth middlewares.
 */
export type AuthVariables = ParserVariables & {
  /** Whether the user failed authorization check */
  unauthorized: boolean;
};
