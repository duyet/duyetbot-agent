/**
 * Test fixtures for E2E tests
 *
 * Provides test data for Telegram webhook payloads and user scenarios
 */

/**
 * Test users for different authorization scenarios
 */
export const USERS = {
  /** Authorized admin user (matches TELEGRAM_ADMIN in wrangler.toml) */
  admin: {
    id: 12345,
    is_bot: false,
    first_name: 'Duyet',
    username: 'duyet',
  },
  /** Standard authorized user */
  authorized: {
    id: 67890,
    is_bot: false,
    first_name: 'TestUser',
    username: 'testuser',
  },
  /** Unauthorized user (not in TELEGRAM_ALLOWED_USERS) */
  unauthorized: {
    id: 99999,
    is_bot: false,
    first_name: 'Stranger',
    username: 'stranger',
  },
} as const;

/**
 * Test chat configurations
 */
export const CHATS = {
  /** Private chat with admin */
  private: {
    id: 12345,
    type: 'private' as const,
    first_name: 'Duyet',
    username: 'duyet',
  },
  /** Group chat */
  group: {
    id: -100123456789,
    type: 'group' as const,
    title: 'Test Group',
  },
} as const;

/**
 * Telegram message structure
 */
export interface TelegramMessage {
  message_id: number;
  from: (typeof USERS)[keyof typeof USERS];
  chat: (typeof CHATS)[keyof typeof CHATS];
  date: number;
  text: string;
}

/**
 * Telegram Update structure (webhook payload)
 */
export interface TelegramUpdate {
  update_id: number;
  message: TelegramMessage;
}

/**
 * Options for creating a test update
 */
export interface CreateUpdateOptions {
  /** Message text */
  text: string;
  /** User sending the message (defaults to admin) */
  user?: keyof typeof USERS;
  /** Chat type (defaults to private) */
  chat?: keyof typeof CHATS;
  /** Custom message ID */
  messageId?: number;
  /** Custom update ID */
  updateId?: number;
}

let updateCounter = 1000;
let messageCounter = 100;

/**
 * Create a Telegram webhook update payload
 *
 * @param options - Configuration for the update
 * @returns Telegram Update object
 *
 * @example
 * ```typescript
 * const update = createUpdate({ text: "Hello bot" });
 * const adminUpdate = createUpdate({ text: "/help", user: "admin" });
 * ```
 */
export function createUpdate(options: CreateUpdateOptions): TelegramUpdate {
  const {
    text,
    user = 'admin',
    chat = 'private',
    messageId = messageCounter++,
    updateId = updateCounter++,
  } = options;

  const selectedUser = USERS[user];
  const selectedChat = CHATS[chat];

  return {
    update_id: updateId,
    message: {
      message_id: messageId,
      from: selectedUser,
      chat: selectedChat,
      date: Math.floor(Date.now() / 1000),
      text,
    },
  };
}

/**
 * Reset fixture counters (call in beforeEach for deterministic tests)
 */
export function resetFixtureCounters(): void {
  updateCounter = 1000;
  messageCounter = 100;
}
