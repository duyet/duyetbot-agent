/**
 * Telegram-specific types for inline keyboards and callback queries
 *
 * These types support the Telegram Bot API inline keyboard feature:
 * - InlineKeyboardButton: A button in the inline keyboard
 * - InlineKeyboardMarkup: The complete keyboard structure
 * - CallbackQuery: Data received when user presses a button
 *
 * @see https://core.telegram.org/bots/api#inlinekeyboardbutton
 * @see https://core.telegram.org/bots/api#callbackquery
 */

/**
 * A single button in an inline keyboard.
 * Must have exactly one optional field set (callback_data or url).
 */
export interface InlineKeyboardButton {
  /** Label text on the button */
  text: string;
  /**
   * Data to be sent in a callback query when button is pressed.
   * Must be 1-64 bytes.
   */
  callback_data?: string;
  /** HTTP/HTTPS URL to open when button is pressed */
  url?: string;
}

/** A row of buttons in an inline keyboard */
export type InlineKeyboardRow = InlineKeyboardButton[];

/**
 * Inline keyboard markup for Telegram messages.
 * Contains rows of buttons that appear below the message.
 */
export interface InlineKeyboardMarkup {
  /** Array of button rows */
  inline_keyboard: InlineKeyboardRow[];
}

/**
 * Callback query from Telegram when user presses an inline button.
 * Received via webhook when user interacts with inline keyboard.
 */
export interface CallbackQuery {
  /** Unique identifier for this query */
  id: string;
  /** User who pressed the button */
  from: {
    id: number;
    username?: string;
  };
  /** Message with the callback button (if available) */
  message?: {
    message_id: number;
    chat: { id: number };
    text?: string;
  };
  /** Data associated with the callback button (1-64 bytes) */
  data?: string;
}

/**
 * Options for sending messages with inline keyboards
 */
export interface SendMessageOptions {
  /** Inline keyboard to attach to the message */
  keyboard?: InlineKeyboardMarkup;
  /** Parse mode for text formatting */
  parseMode?: 'HTML' | 'MarkdownV2' | 'Markdown';
  /** Message ID to reply to */
  replyToMessageId?: number;
}
