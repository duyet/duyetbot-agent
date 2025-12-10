/**
 * Webhook Adapters
 *
 * Converts platform-specific webhook data to a unified WebhookInput format.
 * This is the bridge between webhook entry points and the GlobalContext system.
 *
 * Adapters are used at the webhook entry point (Telegram bot, GitHub bot) to convert
 * raw webhook payloads into a normalized format that can create GlobalContext.
 */

/**
 * Unified webhook input format
 *
 * Common interface for webhook data across all platforms.
 * Created at webhook entry point, used to initialize GlobalContext.
 */
export interface WebhookInput {
  /** Platform identifier */
  platform: 'telegram' | 'github' | 'api';

  /** User identifier */
  userId: string | number;

  /** Chat/conversation identifier */
  chatId: string | number;

  /** Message text content */
  text: string;

  /** Username (platform-specific) */
  username?: string;

  /** Whether user is an admin */
  isAdmin?: boolean;

  /** Admin username for reference */
  adminUsername?: string;

  /** Original message reference (for replies) */
  messageId: string | number;

  /** Message this is replying to */
  replyToMessageId?: string | number;

  /** Event ID for observability correlation */
  eventId?: string;

  /** Request ID for deduplication */
  requestId?: string;

  /** Platform-specific configuration */
  platformConfig: {
    /** Parse mode for formatting (Telegram) */
    parseMode?: string;
    /** Bot token (Telegram) */
    token?: string;
    /** GitHub token */
    githubToken?: string;
    /** Other platform-specific config */
    [key: string]: unknown;
  };
}

/**
 * Telegram Update type (minimal definition for type safety)
 */
export interface TelegramUpdate {
  update_id: number;
  message?: {
    message_id: number;
    from?: {
      id: number;
      username?: string;
      is_bot?: boolean;
    };
    chat: {
      id: number;
      type: string;
    };
    text?: string;
    reply_to_message?: {
      message_id: number;
      from?: {
        username?: string;
      };
      text?: string;
    };
  };
  edited_message?: {
    message_id: number;
    from?: {
      id: number;
      username?: string;
    };
    chat: {
      id: number;
    };
    text?: string;
  };
  callback_query?: {
    id: string;
    from: {
      id: number;
      username?: string;
    };
    message?: {
      message_id: number;
      chat: {
        id: number;
      };
      text?: string;
    };
    data?: string;
  };
}

/**
 * Telegram environment with bot token
 */
export interface TelegramEnv {
  TELEGRAM_BOT_TOKEN: string;
  TELEGRAM_ADMIN?: string;
  TELEGRAM_PARSE_MODE?: string;
}

/**
 * GitHub Webhook Context (parsed from middleware)
 */
export interface GitHubWebhookContext {
  event: string;
  action?: string;
  owner: string;
  repo: string;
  sender: {
    id: number;
    login: string;
  };
  issue?: {
    number: number;
    title: string;
    body?: string;
    state: string;
    labels?: Array<{ name: string }>;
  };
  comment?: {
    id: number;
    body: string;
  };
  isPullRequest: boolean;
  task: string; // Extracted bot mention and task
  requestId: string;
}

/**
 * GitHub environment
 */
export interface GitHubEnv {
  GITHUB_TOKEN: string;
  GITHUB_ADMIN?: string;
}

/**
 * Convert Telegram webhook update to WebhookInput
 *
 * Extracts message data from various Telegram update types:
 * - message: Regular message from user
 * - edited_message: Edited message
 * - callback_query: Inline button callback
 *
 * @param update - Telegram Update object from webhook
 * @param env - Environment with bot token and admin config
 * @param webhookCtx - Pre-parsed webhook context from middleware
 * @returns WebhookInput for GlobalContext creation
 *
 * @example
 * ```typescript
 * const input = telegramToWebhookInput(update, env, webhookCtx);
 * const context = createGlobalContext(input);
 * ```
 */
export function telegramToWebhookInput(
  _update: TelegramUpdate,
  env: TelegramEnv,
  webhookCtx: {
    userId: number;
    chatId: number;
    text: string;
    username?: string;
    messageId: number;
    replyToMessageId?: number;
    quotedText?: string;
    quotedUsername?: string;
  }
): WebhookInput {
  return {
    platform: 'telegram',
    userId: webhookCtx.userId,
    chatId: webhookCtx.chatId,
    text: webhookCtx.text,
    username: webhookCtx.username,
    messageId: webhookCtx.messageId,
    replyToMessageId: webhookCtx.replyToMessageId,
    isAdmin:
      webhookCtx.username !== undefined && env.TELEGRAM_ADMIN !== undefined
        ? normalizeUsername(webhookCtx.username) === normalizeUsername(env.TELEGRAM_ADMIN)
        : false,
    adminUsername: env.TELEGRAM_ADMIN,
    requestId: crypto.randomUUID().slice(0, 8),
    platformConfig: {
      token: env.TELEGRAM_BOT_TOKEN,
      parseMode: env.TELEGRAM_PARSE_MODE ?? 'MarkdownV2',
      quotedText: webhookCtx.quotedText,
      quotedUsername: webhookCtx.quotedUsername,
    },
  };
}

/**
 * Convert GitHub webhook context to WebhookInput
 *
 * Extracts relevant data from GitHub webhook payload parsed by middleware.
 * Includes issue/PR metadata and comment information.
 *
 * @param webhookCtx - GitHub webhook context from middleware
 * @param env - Environment with GitHub token and admin config
 * @param eventId - Observability event ID for correlation
 * @returns WebhookInput for GlobalContext creation
 *
 * @example
 * ```typescript
 * const input = githubToWebhookInput(webhookCtx, env, eventId);
 * const context = createGlobalContext(input);
 * ```
 */
export function githubToWebhookInput(
  webhookCtx: GitHubWebhookContext,
  env: GitHubEnv,
  eventId?: string
): WebhookInput {
  return {
    platform: 'github',
    userId: webhookCtx.sender.id,
    chatId: `${webhookCtx.owner}/${webhookCtx.repo}#${webhookCtx.issue?.number ?? 'unknown'}`,
    text: webhookCtx.task,
    username: webhookCtx.sender.login,
    messageId: webhookCtx.comment?.id ?? webhookCtx.issue?.number ?? 0,
    isAdmin:
      webhookCtx.sender.login !== undefined && env.GITHUB_ADMIN !== undefined
        ? normalizeUsername(webhookCtx.sender.login) === normalizeUsername(env.GITHUB_ADMIN)
        : false,
    adminUsername: env.GITHUB_ADMIN,
    requestId: webhookCtx.requestId,
    eventId,
    platformConfig: {
      githubToken: env.GITHUB_TOKEN,
      owner: webhookCtx.owner,
      repo: webhookCtx.repo,
      issueNumber: webhookCtx.issue?.number,
      isPullRequest: webhookCtx.isPullRequest,
      commentId: webhookCtx.comment?.id,
    },
  };
}

/**
 * Normalize username by removing leading @ if present
 *
 * Handles both '@username' and 'username' formats for consistent comparison.
 *
 * @param username - Username to normalize
 * @returns Normalized username without @ prefix
 */
function normalizeUsername(username: string): string {
  return username.startsWith('@') ? username.slice(1) : username;
}
