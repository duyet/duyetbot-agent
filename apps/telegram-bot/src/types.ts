/**
 * Telegram Bot Type Definitions
 */

import type { Context } from 'telegraf';

/**
 * Bot configuration
 */
export interface TelegramBotConfig {
  /** Telegram bot token */
  botToken: string;
  /** MCP memory server URL */
  mcpServerUrl?: string;
  /** MCP auth token */
  mcpAuthToken?: string;
  /** Allowed Telegram user IDs (empty = allow all) */
  allowedUsers?: number[];
  /** Default model for agent */
  model?: 'haiku' | 'sonnet' | 'opus';
  /** System prompt for agent */
  systemPrompt?: string;
  /** Anthropic API key */
  anthropicApiKey?: string;
  /** Webhook URL for receiving updates */
  webhookUrl?: string;
  /** Webhook secret for verification */
  webhookSecret?: string;
}

/**
 * Session data stored for each user
 */
export interface TelegramSessionData {
  userId: number;
  username?: string;
  firstName?: string;
  lastName?: string;
  sessionId: string;
  createdAt: number;
  updatedAt: number;
  messageCount: number;
}

/**
 * Chat context with session
 */
export interface ChatContext extends Context {
  session?: TelegramSessionData;
}

/**
 * Message for agent
 */
export interface AgentMessage {
  role: 'user' | 'assistant';
  content: string;
}

/**
 * Notification types
 */
export type NotificationType =
  | 'pr_merged'
  | 'pr_review_requested'
  | 'issue_assigned'
  | 'issue_mentioned'
  | 'ci_failed'
  | 'ci_passed'
  | 'deployment_completed';

/**
 * Notification payload
 */
export interface NotificationPayload {
  type: NotificationType;
  title: string;
  body: string;
  url?: string;
  repository?: string;
  metadata?: Record<string, unknown>;
}

/**
 * User subscription preferences
 */
export interface UserSubscription {
  userId: number;
  chatId: number;
  notifications: NotificationType[];
  repositories?: string[];
  enabled: boolean;
}

/**
 * Command handler result
 */
export interface CommandResult {
  success: boolean;
  message?: string;
  error?: string;
}

/**
 * Health check response
 */
export interface HealthResponse {
  status: 'ok' | 'error';
  bot: string;
  uptime: number;
  version: string;
}
