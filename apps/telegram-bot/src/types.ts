/**
 * Telegram Bot Types
 */

export interface BotConfig {
  /** Telegram bot token from BotFather */
  botToken: string;
  /** MCP memory server URL */
  mcpServerUrl?: string;
  /** MCP authentication token */
  mcpAuthToken?: string;
  /** LLM model to use (default: 'sonnet') */
  model?: string;
  /** Allowed user IDs (empty = all users allowed) */
  allowedUsers?: number[];
  /** Webhook URL for production */
  webhookUrl?: string;
  /** Webhook secret path */
  webhookSecretPath?: string;
}

export interface TelegramUser {
  id: number;
  username?: string | undefined;
  firstName: string;
  lastName?: string | undefined;
}

export interface ChatSession {
  sessionId: string;
  userId: number;
  chatId: number;
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
  createdAt: number;
  updatedAt: number;
}

export interface CommandContext {
  user: TelegramUser;
  chatId: number;
  messageId: number;
  text: string;
  args: string[];
}

export type CommandHandler = (ctx: CommandContext) => Promise<string>;
