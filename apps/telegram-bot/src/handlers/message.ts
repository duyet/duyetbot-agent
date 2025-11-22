/**
 * Message Handler
 *
 * Handles user messages using Claude Agent SDK
 */

import { createDefaultOptions, query, toSDKTools } from '@duyetbot/core';
import { getAllBuiltinTools } from '@duyetbot/tools';
import { TelegramSessionManager } from '../session-manager.js';
import type { BotConfig, TelegramUser } from '../types.js';

// Convert tools once at startup
const builtinSDKTools = toSDKTools(getAllBuiltinTools());

/**
 * System prompt for Telegram bot
 */
const SYSTEM_PROMPT = `You are @duyetbot, a helpful AI assistant on Telegram.

You help users with:
- Answering questions clearly and concisely
- Writing, explaining, and debugging code
- Research and analysis
- Task planning and organization

Guidelines:
- Keep responses concise for mobile reading
- Use markdown formatting when helpful
- Be friendly and helpful
- If you need to run code or commands, explain what you're doing

Current conversation is via Telegram chat.`;

/**
 * Handle incoming message
 */
export async function handleMessage(
  text: string,
  user: TelegramUser,
  chatId: number,
  config: BotConfig,
  sessionManager: TelegramSessionManager
): Promise<string> {
  // Get or create session
  const session = await sessionManager.getSession(user, chatId);

  // Add user message to session
  await sessionManager.appendMessage(session.sessionId, 'user', text);

  // Create query options
  const queryOptions = createDefaultOptions({
    model: config.model || 'sonnet',
    sessionId: session.sessionId,
    systemPrompt: SYSTEM_PROMPT,
    tools: builtinSDKTools,
  });

  // Execute query and collect response
  let response = '';
  try {
    for await (const message of query(text, queryOptions)) {
      switch (message.type) {
        case 'assistant':
          if (message.content) {
            response = message.content;
          }
          break;
        case 'result':
          if (message.content) {
            response = message.content;
          }
          break;
      }
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    response = `Sorry, I encountered an error: ${errorMessage}

Please try again or use /clear to start a new conversation.`;
  }

  // Save assistant response to session
  await sessionManager.appendMessage(session.sessionId, 'assistant', response);

  return response;
}

/**
 * Check if user is allowed
 */
export function isUserAllowed(userId: number, allowedUsers?: number[]): boolean {
  if (!allowedUsers || allowedUsers.length === 0) {
    return true; // All users allowed
  }
  return allowedUsers.includes(userId);
}
