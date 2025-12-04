/**
 * Agent Provider for Telegram Bot
 *
 * Implements AgentProvider interface combining:
 * - LLM chat operations via OpenRouter SDK via Cloudflare AI Gateway
 * - Transport operations via Telegram Bot API
 *
 * Supports xAI Grok native tools (web_search, x_search).
 */

import type {
  AgentProvider,
  ChatOptions,
  LLMProvider,
  LLMResponse,
  Message,
  MessageRef,
  ProviderExecutionContext,
} from '@duyetbot/chat-agent';
import { logger } from '@duyetbot/hono-middleware';
import {
  createOpenRouterProvider,
  type OpenRouterProviderEnv,
  type OpenRouterProviderOptions,
} from '@duyetbot/providers';
import { prepareMessageWithDebug } from './debug-footer.js';
import { splitMessage, type TelegramContext } from './transport.js';

/**
 * Environment for Telegram bot provider
 * Extends OpenRouterProviderEnv with Telegram-specific bindings
 */
export interface TelegramEnv extends OpenRouterProviderEnv {
  /** Telegram bot token */
  TELEGRAM_BOT_TOKEN: string;
  /** Parse mode for message formatting (HTML or MarkdownV2) */
  TELEGRAM_PARSE_MODE?: 'HTML' | 'MarkdownV2';
  /** Admin username for debug info */
  TELEGRAM_ADMIN?: string;
}

/**
 * Telegram-specific metadata for provider context
 */
interface TelegramMetadata {
  token: string;
  parseMode?: 'HTML' | 'MarkdownV2';
  adminUsername?: string;
  isAdmin: boolean;
}

/**
 * Create an LLM provider for Telegram bot (legacy function)
 *
 * @deprecated Use createTelegramProvider instead for full AgentProvider
 *
 * @example
 * ```typescript
 * const provider = createProvider(env);
 * const response = await provider.chat([
 *   { role: 'user', content: 'Hello!' }
 * ]);
 * ```
 */
export function createProvider(
  env: OpenRouterProviderEnv,
  options?: Partial<OpenRouterProviderOptions>
): LLMProvider {
  logger.info('Telegram bot creating LLM provider', {
    gateway: env.AI_GATEWAY_NAME,
    model: env.MODEL || 'x-ai/grok-4.1-fast',
  });

  return createOpenRouterProvider(env as OpenRouterProviderEnv, {
    maxTokens: 512,
    requestTimeout: 25000,
    enableWebSearch: true, // Enable native web search for xAI models
    logger,
    ...options,
  });
}

/**
 * Send a message via Telegram Bot API
 *
 * Handles long messages by chunking and falls back to plain text if parsing fails.
 *
 * @param token - Bot token
 * @param chatId - Chat to send to
 * @param text - Message text
 * @param parseMode - Parse mode for formatting
 * @returns Message ID of sent message
 * @internal
 */
async function sendTelegramMessage(
  token: string,
  chatId: number,
  text: string,
  parseMode: 'HTML' | 'MarkdownV2' | undefined = 'HTML'
): Promise<number> {
  const chunks = splitMessage(text);
  let lastMessageId = 0;

  for (const chunk of chunks) {
    const payload: Record<string, unknown> = { chat_id: chatId, text: chunk };
    if (parseMode) {
      payload.parse_mode = parseMode;
    }
    logger.debug('[TELEGRAM_PROVIDER] Sending message', payload);

    let response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    // Fallback to plain text if parsing fails (400 error)
    if (response.status === 400 && parseMode) {
      await response.text();

      const withoutParseMode = {
        chat_id: chatId,
        text: chunk,
      };
      logger.warn(
        `[TELEGRAM_PROVIDER] ${parseMode} parse failed, retrying without parse_mode`,
        withoutParseMode
      );

      response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(withoutParseMode),
      });
    }

    if (!response.ok) {
      const error = await response.text();
      logger.error('[TELEGRAM_PROVIDER] Send message failed', {
        status: response.status,
        error,
        chatId,
      });
      throw new Error(`Telegram API error: ${response.status}`);
    }

    const result = await response.json<{ result: { message_id: number } }>();
    lastMessageId = result.result.message_id;
    logger.debug('[TELEGRAM_PROVIDER] Message sent', {
      chatId,
      messageId: lastMessageId,
    });
  }

  return lastMessageId;
}

/**
 * Edit an existing message via Telegram Bot API
 *
 * Falls back to plain text if parsing fails.
 *
 * @param token - Bot token
 * @param chatId - Chat containing the message
 * @param messageId - Message to edit
 * @param text - New message text
 * @param parseMode - Parse mode for formatting
 * @internal
 */
async function editTelegramMessage(
  token: string,
  chatId: number,
  messageId: number,
  text: string,
  parseMode: 'HTML' | 'MarkdownV2' | undefined = 'HTML'
): Promise<void> {
  const MAX_MESSAGE_LENGTH = 4096;
  const truncatedText =
    text.length > MAX_MESSAGE_LENGTH
      ? `${text.slice(0, MAX_MESSAGE_LENGTH - 20)}...\n\n[truncated]`
      : text;

  const payload: Record<string, unknown> = {
    chat_id: chatId,
    message_id: messageId,
    text: truncatedText,
  };
  if (parseMode) {
    payload.parse_mode = parseMode;
  }

  logger.debug('[TELEGRAM_PROVIDER] Editing message', payload);

  let response = await fetch(`https://api.telegram.org/bot${token}/editMessageText`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  // Fallback to plain text if parsing fails
  if (response.status === 400 && parseMode) {
    await response.text();

    const withoutParseMode = {
      chat_id: chatId,
      message_id: messageId,
      text: truncatedText,
    };
    logger.warn(
      `[TELEGRAM_PROVIDER] ${parseMode} parse failed in edit, retrying without parse_mode`,
      withoutParseMode
    );

    response = await fetch(`https://api.telegram.org/bot${token}/editMessageText`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(withoutParseMode),
    });
  }

  if (response?.ok) {
    logger.info('[TELEGRAM_PROVIDER] Message edited successfully', {
      chatId,
      messageId,
    });
  } else {
    const error = await response.text();
    logger.error('[TELEGRAM_PROVIDER] Edit message failed', {
      status: response.status,
      error,
      chatId,
      messageId,
    });
  }
}

/**
 * Send typing indicator via Telegram Bot API
 *
 * @param token - Bot token
 * @param chatId - Chat to send indicator to
 * @internal
 */
async function sendTypingIndicator(token: string, chatId: number): Promise<void> {
  logger.debug('[TELEGRAM_PROVIDER] Sending typing indicator', { chatId });

  const response = await fetch(`https://api.telegram.org/bot${token}/sendChatAction`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      action: 'typing',
    }),
  });

  await response.text();
}

/**
 * TelegramProvider implements AgentProvider interface
 *
 * Combines LLM chat operations with Telegram transport layer.
 * Provides unified interface for agent execution on Telegram platform.
 *
 * @example
 * ```typescript
 * const provider = createTelegramProvider(env);
 *
 * // Chat with LLM
 * const response = await provider.chat(
 *   [{ role: 'user', content: 'Hello!' }],
 *   { model: 'claude-3-5-sonnet-20241022' }
 * );
 *
 * // Send message to user
 * const ref = await provider.send(ctx, response.content);
 *
 * // Edit message
 * await provider.edit(ctx, ref, 'Updated response');
 *
 * // Show typing indicator
 * await provider.typing(ctx);
 * ```
 */
export class TelegramProvider implements AgentProvider {
  private llmProvider: LLMProvider;
  private env: TelegramEnv;

  /**
   * Create a new TelegramProvider instance
   *
   * @param env - Telegram environment with LLM and platform config
   * @param options - Optional LLM provider options
   */
  constructor(env: TelegramEnv, options?: Partial<OpenRouterProviderOptions>) {
    this.env = env;
    this.llmProvider = createOpenRouterProvider(env, {
      maxTokens: 512,
      requestTimeout: 25000,
      enableWebSearch: true,
      logger,
      ...options,
    });

    logger.info('[TELEGRAM_PROVIDER] Initialized', {
      gateway: env.AI_GATEWAY_NAME,
      model: env.MODEL || 'x-ai/grok-4.1-fast',
      parseMode: env.TELEGRAM_PARSE_MODE,
    });
  }

  /**
   * Send a message to the LLM and get a response
   *
   * @param messages - Conversation history
   * @param options - Chat configuration options
   * @returns LLM response with content and optional tool calls
   */
  async chat(messages: Message[], options?: ChatOptions): Promise<LLMResponse> {
    return this.llmProvider.chat(messages, options?.tools, options);
  }

  /**
   * Send a message through Telegram transport
   *
   * @param ctx - Provider execution context with chat metadata
   * @param content - Message content to send
   * @returns Message reference for future edits
   */
  async send(ctx: ProviderExecutionContext, content: string): Promise<MessageRef> {
    const metadata = this.extractMetadata(ctx);
    const { text: finalText, parseMode } = prepareMessageWithDebug(content, {
      isAdmin: metadata.isAdmin,
      adminUsername: metadata.adminUsername,
    } as TelegramContext);

    const messageId = await sendTelegramMessage(
      metadata.token,
      ctx.chatId as number,
      finalText,
      parseMode
    );

    return messageId;
  }

  /**
   * Edit a previously sent message
   *
   * @param ctx - Provider execution context with chat metadata
   * @param ref - Reference to the message to edit
   * @param content - New message content
   */
  async edit(ctx: ProviderExecutionContext, ref: MessageRef, content: string): Promise<void> {
    const metadata = this.extractMetadata(ctx);
    const { text: finalText, parseMode } = prepareMessageWithDebug(content, {
      isAdmin: metadata.isAdmin,
      adminUsername: metadata.adminUsername,
    } as TelegramContext);

    await editTelegramMessage(
      metadata.token,
      ctx.chatId as number,
      ref as number,
      finalText,
      parseMode
    );
  }

  /**
   * Send typing indicator to show agent is processing
   *
   * @param ctx - Provider execution context with chat metadata
   */
  async typing(ctx: ProviderExecutionContext): Promise<void> {
    const metadata = this.extractMetadata(ctx);
    await sendTypingIndicator(metadata.token, ctx.chatId as number);
  }

  /**
   * Create a ProviderExecutionContext from ParsedInput
   *
   * @param input - Parsed input with message and metadata
   * @returns ProviderExecutionContext ready for use
   */
  createContext(input: {
    text: string;
    userId: string | number;
    chatId: string | number;
    username?: string;
    metadata?: Record<string, unknown>;
  }): ProviderExecutionContext {
    return {
      text: input.text,
      userId: input.userId,
      chatId: input.chatId,
      username: input.username,
      metadata: input.metadata,
      createdAt: Date.now(),
    };
  }

  /**
   * Extract Telegram-specific metadata from context
   *
   * @param ctx - Provider execution context
   * @returns Telegram metadata for transport operations
   * @internal
   */
  private extractMetadata(ctx: ProviderExecutionContext): TelegramMetadata {
    const _metadata = (ctx.metadata || {}) as Record<string, unknown>;
    const username = ctx.username;

    const isAdmin =
      username && this.env.TELEGRAM_ADMIN
        ? username === this.env.TELEGRAM_ADMIN ||
          username === `@${this.env.TELEGRAM_ADMIN}` ||
          `@${username}` === this.env.TELEGRAM_ADMIN
        : false;

    return {
      token: this.env.TELEGRAM_BOT_TOKEN,
      parseMode: this.env.TELEGRAM_PARSE_MODE,
      adminUsername: this.env.TELEGRAM_ADMIN,
      isAdmin,
    };
  }
}

/**
 * Create a TelegramProvider instance
 *
 * Factory function for creating an AgentProvider for Telegram platform.
 *
 * @param env - Telegram environment with LLM and platform config
 * @param options - Optional LLM provider options
 * @returns AgentProvider ready for use with CloudflareAgent
 *
 * @example
 * ```typescript
 * const provider = createTelegramProvider(env);
 *
 * const agent = createCloudflareChatAgent({
 *   createProvider: (env) => createTelegramProvider(env),
 *   systemPrompt: 'You are a helpful assistant.',
 *   transport: telegramTransport,
 * });
 * ```
 */
export function createTelegramProvider(
  env: TelegramEnv,
  options?: Partial<OpenRouterProviderOptions>
): AgentProvider {
  return new TelegramProvider(env, options);
}

// Re-export for backwards compatibility
export { createProvider as createAIGatewayProvider };
export type ProviderEnv = OpenRouterProviderEnv;
