/**
 * /chat command - Chat with agent
 */

import type { Context } from 'telegraf';
import type { TelegramSessionManager } from '../session-manager.js';
import { createTelegramSessionId } from '../session-manager.js';
import type { AgentMessage, TelegramBotConfig } from '../types.js';

/**
 * Agent executor interface
 */
export interface AgentExecutor {
  execute(
    sessionId: string,
    messages: AgentMessage[],
    userMessage: string,
    config: {
      model?: string;
      systemPrompt?: string;
      apiKey?: string;
    }
  ): Promise<string>;
}

/**
 * Simple agent executor (placeholder for SDK integration)
 */
export function createSimpleExecutor(): AgentExecutor {
  return {
    async execute(
      _sessionId: string,
      _messages: AgentMessage[],
      userMessage: string,
      _config
    ): Promise<string> {
      // This is a placeholder - in production, use SDK
      return `I received your message: "${userMessage}"\n\nNote: Full agent integration pending. This is a test response.`;
    },
  };
}

export async function handleChat(
  ctx: Context,
  text: string,
  sessionManager: TelegramSessionManager,
  executor: AgentExecutor,
  config: TelegramBotConfig
): Promise<void> {
  const user = ctx.from;
  if (!user) {
    await ctx.reply('Unable to identify user.');
    return;
  }

  // Check if user is allowed
  if (config.allowedUsers && config.allowedUsers.length > 0) {
    if (!config.allowedUsers.includes(user.id)) {
      await ctx.reply('Sorry, you are not authorized to use this bot.');
      return;
    }
  }

  // Get message (remove /chat prefix if present)
  const message = text.replace(/^\/chat\s*/, '').trim();
  if (!message) {
    await ctx.reply('Please provide a message. Usage: /chat <your message>');
    return;
  }

  // Get session and history
  const session = await sessionManager.getSession(user.id, {
    username: user.username,
    firstName: user.first_name,
    lastName: user.last_name,
  });
  const sessionId = createTelegramSessionId(user.id);
  const history = await sessionManager.getMessages(sessionId);

  // Send typing indicator
  await ctx.sendChatAction('typing');

  try {
    // Execute agent
    const response = await executor.execute(sessionId, history, message, {
      model: config.model,
      systemPrompt: config.systemPrompt || buildDefaultPrompt(user.first_name),
      apiKey: config.anthropicApiKey,
    });

    // Save messages
    const newMessages: AgentMessage[] = [
      { role: 'user', content: message },
      { role: 'assistant', content: response },
    ];
    await sessionManager.saveMessages(sessionId, newMessages);

    // Reply (split if too long)
    if (response.length > 4000) {
      const chunks = splitMessage(response, 4000);
      for (const chunk of chunks) {
        await ctx.reply(chunk, { parse_mode: 'Markdown' });
      }
    } else {
      await ctx.reply(response, { parse_mode: 'Markdown' });
    }
  } catch (error) {
    console.error('Chat error:', error);
    await ctx.reply('Sorry, I encountered an error processing your message. Please try again.');
  }
}

function buildDefaultPrompt(firstName?: string): string {
  const name = firstName ? ` for ${firstName}` : '';
  return `You are duyetbot, a helpful AI assistant${name}. You help with programming questions, code reviews, research, and general tasks. Be concise but thorough. Use markdown formatting for code blocks and lists.`;
}

function splitMessage(text: string, maxLength: number): string[] {
  const chunks: string[] = [];
  let current = '';

  const lines = text.split('\n');
  for (const line of lines) {
    if (current.length + line.length + 1 > maxLength) {
      if (current) chunks.push(current);
      current = line;
    } else {
      current = current ? `${current}\n${line}` : line;
    }
  }

  if (current) chunks.push(current);
  return chunks;
}
