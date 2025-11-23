/**
 * Telegram Bot using Hono + Cloudflare Agents SDK
 *
 * Simple webhook handler with stateful agent sessions via Durable Objects.
 */

import { createBaseApp, createTelegramWebhookAuth, logger } from '@duyetbot/hono-middleware';
import { getAgentByName } from 'agents';
import type { Context, ExecutionContext } from 'hono';
import { type Env, TelegramAgent } from './agent.js';

// Re-export agent for Durable Object binding
export { TelegramAgent };

interface TelegramUpdate {
  message?: {
    message_id: number;
    from?: {
      id: number;
      username?: string;
      first_name: string;
    };
    chat: {
      id: number;
    };
    text?: string;
  };
}

interface WebhookContext {
  userId: number;
  chatId: number;
  startTime: number;
  username?: string;
}

// Error codes for debugging
const ErrorCodes = {
  AUTH_001: 'User not authorized',
  AGENT_001: 'Failed to get agent by name',
  AGENT_002: 'Agent initialization failed',
  CMD_001: 'Command execution failed',
  CHAT_001: 'Agent chat execution failed',
  MSG_001: 'Send message failed',
  MSG_002: 'Edit message failed',
} as const;

const app = createBaseApp<Env>({
  name: 'telegram-bot',
  version: '1.0.0',
  logger: true,
  health: true,
  ignorePaths: ['/cdn-cgi/'],
});

// Parse webhook request with error handling
async function parseWebhookRequest(c: Context<{ Bindings: Env }>): Promise<{
  update: TelegramUpdate;
  message: NonNullable<TelegramUpdate['message']>;
} | null> {
  let update: TelegramUpdate;
  try {
    update = await c.req.json<TelegramUpdate>();
    logger.debug('[PARSE] Webhook payload received', {
      hasMessage: !!update.message,
    });
  } catch (error) {
    logger.error('[PARSE] Invalid JSON payload', {
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }

  const message = update.message;
  if (!message?.text || !message.from) {
    logger.debug('[PARSE] Skipping message without text or from', {
      hasText: !!message?.text,
      hasFrom: !!message?.from,
    });
    return null;
  }

  return { update, message };
}

// Check user authorization
async function checkAuthorization(env: Env, ctx: WebhookContext): Promise<boolean> {
  if (!env.TELEGRAM_ALLOWED_USERS) {
    logger.debug('[AUTH] No allowed users configured, allowing all');
    return true;
  }

  const allowed = env.TELEGRAM_ALLOWED_USERS.split(',')
    .map((id) => Number.parseInt(id.trim(), 10))
    .filter((id) => !Number.isNaN(id));

  if (allowed.length === 0) {
    logger.debug('[AUTH] Empty allowed list, allowing all');
    return true;
  }

  if (!allowed.includes(ctx.userId)) {
    logger.warn(`[AUTH] ${ErrorCodes.AUTH_001}`, {
      userId: ctx.userId,
      chatId: ctx.chatId,
      username: ctx.username,
      code: 'AUTH_001',
    });
    return false;
  }

  logger.debug('[AUTH] User authorized', { userId: ctx.userId });
  return true;
}

// Initialize agent for user
async function initializeAgent(env: Env, ctx: WebhookContext) {
  const agentId = `telegram:${ctx.userId}:${ctx.chatId}`;

  logger.info('[AGENT_INIT] Getting agent', { agentId });

  const agent = await getAgentByName(env.TelegramAgent, agentId).catch((error) => {
    logger.error(`[AGENT_INIT] ${ErrorCodes.AGENT_001}`, {
      agentId,
      error: error instanceof Error ? error.message : String(error),
      code: 'AGENT_001',
    });
    throw error;
  });

  try {
    await agent.init(ctx.userId, ctx.chatId);
    logger.debug('[AGENT_INIT] Agent initialized', { agentId });
  } catch (error) {
    logger.error(`[AGENT_INIT] ${ErrorCodes.AGENT_002}`, {
      agentId,
      error: error instanceof Error ? error.message : String(error),
      code: 'AGENT_002',
    });
    throw error;
  }

  return agent;
}

// Handle bot commands
async function handleCommand(
  agent: Awaited<ReturnType<typeof initializeAgent>>,
  text: string,
  ctx: WebhookContext
): Promise<string> {
  const command = text.split(' ')[0].toLowerCase();

  logger.info('[COMMAND] Executing command', {
    command,
    userId: ctx.userId,
    chatId: ctx.chatId,
  });

  try {
    if (command === '/start') {
      return await agent.getWelcome();
    }
    if (command === '/help') {
      return await agent.getHelp();
    }
    if (command === '/clear') {
      return await agent.clearHistory();
    }

    logger.warn('[COMMAND] Unknown command', { command });
    return `Unknown command: ${command}. Try /help for available commands.`;
  } catch (error) {
    logger.error(`[COMMAND] ${ErrorCodes.CMD_001}`, {
      command,
      userId: ctx.userId,
      error: error instanceof Error ? error.message : String(error),
      code: 'CMD_001',
    });
    throw error;
  }
}

// Process agent chat with waitUntil for async execution
async function processAgentChat(
  agent: Awaited<ReturnType<typeof initializeAgent>>,
  text: string,
  env: Env,
  ctx: WebhookContext,
  executionCtx: ExecutionContext,
  username?: string
): Promise<void> {
  // Send processing message immediately
  let processingMsgId: number;
  try {
    processingMsgId = await sendMessage(
      env.TELEGRAM_BOT_TOKEN,
      ctx.chatId,
      '🔄 Processing your message...'
    );
  } catch (error) {
    logger.error('[CHAT] Failed to send processing message', {
      userId: ctx.userId,
      chatId: ctx.chatId,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }

  // Process in background
  executionCtx.waitUntil(
    (async () => {
      logger.info('[CHAT] Agent execution started', {
        userId: ctx.userId,
        chatId: ctx.chatId,
        inputLength: text.length,
      });

      try {
        const agentResponse = await agent.chat(text);
        const durationMs = Date.now() - ctx.startTime;

        logger.info('[CHAT] Agent execution completed', {
          userId: ctx.userId,
          chatId: ctx.chatId,
          durationMs,
          responseLength: agentResponse.length,
        });

        await editMessage(env.TELEGRAM_BOT_TOKEN, ctx.chatId, processingMsgId, agentResponse);
      } catch (error) {
        const durationMs = Date.now() - ctx.startTime;
        const errorMessage = error instanceof Error ? error.message : String(error);
        const errorStack = error instanceof Error ? error.stack : undefined;

        logger.error(`[CHAT] ${ErrorCodes.CHAT_001}`, {
          userId: ctx.userId,
          chatId: ctx.chatId,
          durationMs,
          error: errorMessage,
          stack: errorStack,
          code: 'CHAT_001',
        });

        const userErrorMessage = formatErrorMessage(env, username, errorMessage);
        await editMessage(env.TELEGRAM_BOT_TOKEN, ctx.chatId, processingMsgId, userErrorMessage);
      }
    })()
  );
}

// Format error message based on admin status
function formatErrorMessage(env: Env, username: string | undefined, errorMessage: string): string {
  const isAdmin = env.TELEGRAM_ADMIN && username === env.TELEGRAM_ADMIN;
  return isAdmin
    ? `❌ Error: ${errorMessage}`
    : '❌ Sorry, an error occurred. Please try again later.';
}

// Handle webhook errors
async function handleWebhookError(
  error: unknown,
  env: Env,
  ctx: WebhookContext,
  c: Context<{ Bindings: Env }>
): Promise<Response> {
  const durationMs = Date.now() - ctx.startTime;
  const errorMessage = error instanceof Error ? error.message : String(error);
  const errorStack = error instanceof Error ? error.stack : undefined;

  logger.error('[WEBHOOK] Request failed', {
    userId: ctx.userId,
    chatId: ctx.chatId,
    durationMs,
    error: errorMessage,
    stack: errorStack,
  });

  const userErrorMessage = formatErrorMessage(env, ctx.username, errorMessage);

  try {
    await sendMessage(env.TELEGRAM_BOT_TOKEN, ctx.chatId, userErrorMessage);
  } catch {
    logger.error('[WEBHOOK] Failed to send error message to user', {
      userId: ctx.userId,
      chatId: ctx.chatId,
    });
  }

  return c.text('Error', 500);
}

// Telegram webhook handler
app.post('/webhook', createTelegramWebhookAuth<Env>(), async (c) => {
  const env = c.env;

  // Phase 1: Parse request
  const parsed = await parseWebhookRequest(c);
  if (!parsed) {
    return c.text('OK');
  }

  const { message } = parsed;
  const ctx: WebhookContext = {
    userId: message.from!.id,
    chatId: message.chat.id,
    startTime: Date.now(),
    username: message.from!.username,
  };

  logger.info('[WEBHOOK] Message received', {
    userId: ctx.userId,
    chatId: ctx.chatId,
    username: ctx.username,
    messageLength: message.text!.length,
    isCommand: message.text!.startsWith('/'),
  });

  try {
    // Phase 2: Authorization check
    const isAuthorized = await checkAuthorization(env, ctx);
    if (!isAuthorized) {
      await sendMessage(env.TELEGRAM_BOT_TOKEN, ctx.chatId, 'Sorry, you are not authorized.');
      return c.text('OK');
    }

    // Phase 3: Agent initialization
    const agent = await initializeAgent(env, ctx);

    // Phase 4: Handle message
    const text = message.text!;
    if (text.startsWith('/')) {
      const response = await handleCommand(agent, text, ctx);
      await sendMessage(env.TELEGRAM_BOT_TOKEN, ctx.chatId, response);
    } else {
      await processAgentChat(agent, text, env, ctx, c.executionCtx, ctx.username);
    }

    return c.text('OK');
  } catch (error) {
    return handleWebhookError(error, env, ctx, c);
  }
});

// Send message to Telegram
async function sendMessage(token: string, chatId: number, text: string): Promise<number> {
  logger.debug('[MSG] Sending message', { chatId, textLength: text.length });

  const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: 'Markdown',
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    logger.error(`[MSG] ${ErrorCodes.MSG_001}`, {
      status: response.status,
      error,
      chatId,
      code: 'MSG_001',
    });
    throw new Error(`Telegram API error: ${response.status}`);
  }

  const result = await response.json<{ result: { message_id: number } }>();
  logger.debug('[MSG] Message sent', {
    chatId,
    messageId: result.result.message_id,
  });
  return result.result.message_id;
}

// Edit existing message
async function editMessage(
  token: string,
  chatId: number,
  messageId: number,
  text: string
): Promise<void> {
  logger.debug('[MSG] Editing message', {
    chatId,
    messageId,
    textLength: text.length,
  });

  const response = await fetch(`https://api.telegram.org/bot${token}/editMessageText`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      message_id: messageId,
      text,
      parse_mode: 'Markdown',
    }),
  });

  if (response.ok) {
    logger.debug('[MSG] Message edited', { chatId, messageId });
  } else {
    const error = await response.text();
    logger.error(`[MSG] ${ErrorCodes.MSG_002}`, {
      status: response.status,
      error,
      chatId,
      messageId,
      code: 'MSG_002',
    });
    // Don't throw - message might have been deleted
  }
}

export default app;
