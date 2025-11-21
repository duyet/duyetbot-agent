/**
 * Telegram Bot Commands
 */

import type { TelegramSessionManager } from '../session-manager.js';

export interface CommandResult {
  text: string;
  parseMode?: 'Markdown' | 'HTML';
}

/**
 * /start command - Welcome message
 */
export function startCommand(): CommandResult {
  return {
    text: `Welcome to @duyetbot!

I'm your AI assistant. I can help you with:
- Answering questions
- Writing and explaining code
- Research and analysis
- Task planning

*Commands:*
/chat - Start a conversation
/clear - Clear conversation history
/status - Show bot status
/help - Show this help message

Just send me a message to start chatting!`,
    parseMode: 'Markdown',
  };
}

/**
 * /help command - Show available commands
 */
export function helpCommand(): CommandResult {
  return {
    text: `*Available Commands:*

/start - Welcome message
/chat <message> - Send a message
/clear - Clear conversation history
/status - Show bot status
/sessions - List your sessions
/help - Show this help

*Tips:*
- Just send a message directly to chat
- Use /clear to start fresh
- Conversations are saved automatically`,
    parseMode: 'Markdown',
  };
}

/**
 * /status command - Show bot status
 */
export function statusCommand(sessionManager: TelegramSessionManager): CommandResult {
  const sessionCount = sessionManager.getSessionCount();
  const uptime = process.uptime();
  const hours = Math.floor(uptime / 3600);
  const minutes = Math.floor((uptime % 3600) / 60);

  return {
    text: `*Bot Status*

Status: Online
Active Sessions: ${sessionCount}
Uptime: ${hours}h ${minutes}m
Model: Claude Sonnet

Memory: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`,
    parseMode: 'Markdown',
  };
}

/**
 * /clear command - Clear session history
 */
export async function clearCommand(
  sessionId: string,
  sessionManager: TelegramSessionManager
): Promise<CommandResult> {
  await sessionManager.clearSession(sessionId);
  return {
    text: 'Conversation history cleared. Start fresh!',
  };
}

/**
 * /sessions command - List user sessions
 */
export function sessionsCommand(sessionId: string): CommandResult {
  return {
    text: `*Your Current Session*

Session ID: \`${sessionId}\`

Use /clear to start a new conversation.`,
    parseMode: 'Markdown',
  };
}
