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
      /** Type of chat: private, group, supergroup, or channel */
      type?: 'private' | 'group' | 'supergroup' | 'channel';
      /** Title of the chat (for groups, supergroups, and channels) */
      title?: string;
    };
    /** Message text content */
    text?: string;
    /** Original message being replied to (for quoted messages) */
    reply_to_message?: {
      /** Unique message identifier of the quoted message */
      message_id: number;
      /** Sender of the quoted message */
      from?: {
        /** Unique user identifier */
        id: number;
        /** True if this user is a bot */
        is_bot?: boolean;
        /** Username without @ prefix */
        username?: string;
        /** User's first name */
        first_name: string;
      };
      /** Text content of the quoted message */
      text?: string;
      /** Unix timestamp when the quoted message was sent */
      date: number;
    };
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
  /** Message ID of the current message (for reply threading) */
  messageId: number;
  /** Message ID of the quoted message (when replying to a message) */
  replyToMessageId?: number;
  /** Text content of the quoted message */
  quotedText?: string;
  /** Username of the quoted message sender */
  quotedUsername?: string;
  /** Chat type: private, group, supergroup, or channel */
  chatType: 'private' | 'group' | 'supergroup' | 'channel';
  /** Title of the chat (for groups, supergroups, and channels) */
  chatTitle?: string;
  /** Whether this message is from a group or supergroup */
  isGroupChat: boolean;
  /** Whether the bot was mentioned in this message */
  hasBotMention: boolean;
  /** Whether this message is a reply to any message */
  isReply: boolean;
  /** Whether this message is a reply to the bot's message */
  isReplyToBot: boolean;
  /** Extracted task text (message with @mention removed, if present) */
  task?: string;
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
  /** Bot username for mention detection (without @, default: 'duyetbot') */
  BOT_USERNAME?: string;
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
