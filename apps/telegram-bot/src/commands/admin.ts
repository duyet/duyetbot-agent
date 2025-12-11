/**
 * Slash command handlers for Telegram bot
 *
 * Handles slash commands at webhook level BEFORE they reach the batch queue.
 * This ensures immediate response for builtin commands without LLM processing.
 *
 * Commands handled here:
 * - /start - Welcome message (static)
 * - /help - Help message (static)
 * - /status - System status (admin only, static)
 * - /debug - Debug info (admin only, via agent RPC)
 * - /clear - Clear history (admin only, via agent RPC)
 *
 * Unknown commands return undefined to flow through to batch queue → LLM.
 */

import { logger } from '@duyetbot/hono-middleware';
import { getTelegramHelpMessage, getTelegramWelcomeMessage } from '@duyetbot/prompts';
import type { TelegramContext } from '../transport.js';

/**
 * CloudflareChatAgent stub type for RPC calls
 * The actual type is complex, we only need the methods we call
 */
interface AgentStub {
  handleBuiltinCommand(
    command: string,
    options: { isAdmin: boolean; username?: string; parseMode?: 'HTML' | 'MarkdownV2' }
  ): Promise<string | null>;
}

/**
 * Handle /start command - shows welcome message
 */
export function handleStartCommand(): string {
  return getTelegramWelcomeMessage();
}

/**
 * Handle /help command - shows help message
 */
export function handleHelpCommand(): string {
  return getTelegramHelpMessage();
}

/**
 * Handle /status command - shows system status (admin only)
 */
export async function handleStatusCommand(ctx: TelegramContext): Promise<string> {
  if (!ctx.isAdmin) {
    return '🔒 Admin command - access denied';
  }

  const status = {
    status: 'operational',
    timestamp: new Date().toISOString(),
    context: {
      chatId: ctx.chatId,
      userId: ctx.userId,
      requestId: ctx.requestId,
    },
  };

  return `📊 System Status:\n\n${JSON.stringify(status, null, 2)}`;
}

/**
 * Handle /debug command via agent RPC (admin only)
 * Returns full agent state: tools, MCP servers, messages, configuration
 */
export async function handleDebugCommand(ctx: TelegramContext, agent: AgentStub): Promise<string> {
  if (!ctx.isAdmin) {
    return '🔒 Admin command - access denied';
  }

  try {
    const result = await agent.handleBuiltinCommand('/debug', {
      isAdmin: true,
      username: ctx.username,
      parseMode: ctx.parseMode,
    });
    return result ?? '⚠️ Debug info unavailable';
  } catch (err) {
    logger.error('[ADMIN_CMD] Debug command RPC failed', {
      error: err instanceof Error ? err.message : String(err),
    });
    return `⚠️ Debug command failed: ${err instanceof Error ? err.message : 'Unknown error'}`;
  }
}

/**
 * Handle /clear command via agent RPC (admin only)
 * Clears conversation history in the agent's Durable Object state
 */
export async function handleClearCommand(ctx: TelegramContext, agent: AgentStub): Promise<string> {
  if (!ctx.isAdmin) {
    return '🔒 Admin command - access denied';
  }

  try {
    const result = await agent.handleBuiltinCommand('/clear', {
      isAdmin: true,
      username: ctx.username,
      parseMode: ctx.parseMode,
    });
    return result ?? '✅ Conversation cleared';
  } catch (err) {
    logger.error('[ADMIN_CMD] Clear command RPC failed', {
      error: err instanceof Error ? err.message : String(err),
    });
    return `⚠️ Clear command failed: ${err instanceof Error ? err.message : 'Unknown error'}`;
  }
}

/**
 * Route slash commands to their handlers
 *
 * @param command - The command string (e.g., "/debug")
 * @param ctx - Telegram context with admin information
 * @param agent - Agent stub for RPC calls (optional, needed for /debug and /clear)
 * @returns Response string or undefined if command not recognized
 */
export async function handleSlashCommand(
  command: string,
  ctx: TelegramContext,
  agent?: AgentStub
): Promise<string | undefined> {
  // Extract command name (ignore args)
  const cmd = command.split(/[\s\n]/)[0]?.toLowerCase();

  logger.info('[SLASH_CMD] Processing slash command', {
    command: cmd,
    userId: ctx.userId,
    isAdmin: ctx.isAdmin,
    hasAgent: !!agent,
  });

  switch (cmd) {
    // Public commands (no agent needed)
    case '/start':
      return handleStartCommand();
    case '/help':
      return handleHelpCommand();

    // Admin commands (static, no agent needed)
    case '/status':
      return handleStatusCommand(ctx);

    // Admin commands (need agent RPC)
    case '/debug':
      if (!agent) {
        logger.warn('[SLASH_CMD] /debug called without agent stub');
        return '⚠️ Debug command unavailable (no agent connection)';
      }
      return handleDebugCommand(ctx, agent);

    case '/clear':
      if (!agent) {
        logger.warn('[SLASH_CMD] /clear called without agent stub');
        return '⚠️ Clear command unavailable (no agent connection)';
      }
      return handleClearCommand(ctx, agent);

    // Unknown command - let it flow to batch queue → LLM
    default:
      return undefined;
  }
}

/**
 * Legacy function for backward compatibility
 * @deprecated Use handleSlashCommand instead
 */
export async function handleAdminCommand(
  command: string,
  ctx: TelegramContext,
  agent?: AgentStub
): Promise<string | undefined> {
  return handleSlashCommand(command, ctx, agent);
}
