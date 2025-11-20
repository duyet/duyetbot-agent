/**
 * Chat Implementation
 *
 * Simple readline-based chat interface
 */

import * as readline from 'node:readline';
import type { LLMMessage } from '@duyetbot/types';
import { FileSessionManager } from './sessions.js';
import type { LocalSession } from './sessions.js';

export interface ChatOptions {
  sessionId?: string;
  mode: 'local' | 'cloud';
  sessionsDir: string;
  mcpServerUrl?: string;
}

export interface ChatContext {
  session: LocalSession;
  sessionManager: FileSessionManager;
  rl: readline.Interface;
}

/**
 * Start interactive chat session
 */
export async function startChat(options: ChatOptions): Promise<void> {
  const sessionManager = new FileSessionManager(options.sessionsDir);

  // Get or create session
  let session: LocalSession;
  if (options.sessionId) {
    const existing = await sessionManager.getSession(options.sessionId);
    if (!existing) {
      console.error(`Session not found: ${options.sessionId}`);
      process.exit(1);
    }
    session = existing;
  } else {
    session = await sessionManager.createSession({
      title: `Chat ${new Date().toISOString()}`,
    });
  }

  console.log(`\nChat session: ${session.id}`);
  console.log(`Mode: ${options.mode}`);
  console.log('Type "exit" to quit, "history" to show messages\n');

  // Create readline interface
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const context: ChatContext = {
    session,
    sessionManager,
    rl,
  };

  // Start chat loop
  await chatLoop(context, options);
}

/**
 * Main chat loop
 */
async function chatLoop(context: ChatContext, options: ChatOptions): Promise<void> {
  const { rl, session, sessionManager } = context;

  const prompt = (): void => {
    rl.question('You: ', async (input) => {
      const trimmed = input.trim();

      if (!trimmed) {
        prompt();
        return;
      }

      // Handle special commands
      if (trimmed.toLowerCase() === 'exit') {
        console.log('\nGoodbye!');
        rl.close();
        return;
      }

      if (trimmed.toLowerCase() === 'history') {
        showHistory(session.messages);
        prompt();
        return;
      }

      if (trimmed.toLowerCase() === 'clear') {
        session.messages = [];
        await sessionManager.updateSession(session.id, { messages: [] });
        console.log('History cleared\n');
        prompt();
        return;
      }

      // Add user message
      const userMessage: LLMMessage = { role: 'user', content: trimmed };
      session.messages.push(userMessage);

      // Generate response (placeholder - would call LLM)
      const response = await generateResponse(session.messages, options);

      // Add assistant message
      const assistantMessage: LLMMessage = { role: 'assistant', content: response };
      session.messages.push(assistantMessage);

      // Save session
      await sessionManager.updateSession(session.id, {
        messages: session.messages,
      });

      console.log(`\nAssistant: ${response}\n`);
      prompt();
    });
  };

  prompt();
}

/**
 * Show message history
 */
function showHistory(messages: LLMMessage[]): void {
  console.log('\n--- History ---');
  if (messages.length === 0) {
    console.log('(no messages)');
  } else {
    for (const msg of messages) {
      const role = msg.role === 'user' ? 'You' : 'Assistant';
      console.log(`${role}: ${msg.content}`);
    }
  }
  console.log('---------------\n');
}

/**
 * Generate response (placeholder)
 */
async function generateResponse(messages: LLMMessage[], _options: ChatOptions): Promise<string> {
  // TODO: Integrate with actual LLM provider
  // For now, return echo response
  const lastMessage = messages[messages.length - 1];
  if (!lastMessage) {
    return 'No message to respond to';
  }

  // Simulate some processing time
  await new Promise((resolve) => setTimeout(resolve, 100));

  // Echo response for now
  return `[Echo] ${lastMessage.content}`;
}

/**
 * Run a single prompt (non-interactive)
 */
export async function runPrompt(prompt: string, options: ChatOptions): Promise<string> {
  const sessionManager = new FileSessionManager(options.sessionsDir);

  // Create temporary session
  const session = await sessionManager.createSession({
    title: `Prompt ${new Date().toISOString()}`,
  });

  // Add user message
  const userMessage: LLMMessage = { role: 'user', content: prompt };
  session.messages.push(userMessage);

  // Generate response
  const response = await generateResponse(session.messages, options);

  // Add assistant message and save
  const assistantMessage: LLMMessage = { role: 'assistant', content: response };
  session.messages.push(assistantMessage);

  await sessionManager.updateSession(session.id, {
    messages: session.messages,
    state: 'completed',
  });

  return response;
}
