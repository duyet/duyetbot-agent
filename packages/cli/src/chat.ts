/**
 * Chat Implementation
 *
 * SDK-based chat interface with streaming support
 */

import * as readline from 'node:readline';
import {
  type QueryOptions,
  createDefaultOptions,
  createQueryController,
  query,
} from '@duyetbot/core';
import type { LLMMessage } from '@duyetbot/types';
import { FileSessionManager } from './sessions.js';
import type { LocalSession } from './sessions.js';

export interface ChatOptions {
  sessionId?: string;
  mode: 'local' | 'cloud';
  sessionsDir: string;
  mcpServerUrl?: string;
  model?: string;
  systemPrompt?: string;
}

export interface ChatContext {
  session: LocalSession;
  sessionManager: FileSessionManager;
  rl: readline.Interface;
  queryOptions: QueryOptions;
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
  console.log(`Model: ${options.model || 'sonnet'}`);
  console.log('Type "exit" to quit, "history" to show messages\n');

  // Create query options
  const queryOpts: Parameters<typeof createDefaultOptions>[0] = {
    model: options.model || 'sonnet',
    sessionId: session.id,
  };
  if (options.systemPrompt) {
    queryOpts.systemPrompt = options.systemPrompt;
  }
  const queryOptions = createDefaultOptions(queryOpts);

  // Create readline interface
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const context: ChatContext = {
    session,
    sessionManager,
    rl,
    queryOptions,
  };

  // Start chat loop
  await chatLoop(context, options);
}

/**
 * Main chat loop
 */
async function chatLoop(context: ChatContext, _options: ChatOptions): Promise<void> {
  const { rl, session, sessionManager, queryOptions } = context;

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

      // Generate response using SDK streaming
      const response = await generateSDKResponse(trimmed, queryOptions);

      // Add assistant message
      const assistantMessage: LLMMessage = { role: 'assistant', content: response };
      session.messages.push(assistantMessage);

      // Save session
      await sessionManager.updateSession(session.id, {
        messages: session.messages,
      });

      console.log('\n');
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
 * Generate response using SDK streaming
 */
async function generateSDKResponse(input: string, options: QueryOptions): Promise<string> {
  const controller = createQueryController();
  let fullResponse = '';
  let isFirstChunk = true;

  // Handle Ctrl+C to interrupt
  const sigintHandler = () => {
    controller.interrupt();
  };
  process.on('SIGINT', sigintHandler);

  try {
    process.stdout.write('\nAssistant: ');

    for await (const message of query(input, options, controller)) {
      switch (message.type) {
        case 'assistant':
          if (message.content) {
            if (isFirstChunk) {
              isFirstChunk = false;
            }
            process.stdout.write(message.content);
            fullResponse = message.content;
          }
          break;

        case 'tool_use':
          process.stdout.write(`\n[Using tool: ${message.toolName}]`);
          break;

        case 'tool_result':
          if (message.isError) {
            process.stdout.write(`\n[Tool error: ${message.content}]`);
          } else {
            process.stdout.write('\n[Tool result received]');
          }
          break;

        case 'result':
          // Final result - use this as the complete response
          if (message.content) {
            fullResponse = message.content;
          }
          if (message.duration) {
            const seconds = (message.duration / 1000).toFixed(1);
            process.stdout.write(`\n[${seconds}s, ${message.totalTokens || 0} tokens]`);
          }
          break;

        case 'system':
          // System messages (errors)
          if (message.content?.startsWith('Error:')) {
            console.error(`\n${message.content}`);
          }
          break;
      }
    }

    return fullResponse;
  } finally {
    process.removeListener('SIGINT', sigintHandler);
  }
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

  // Create query options
  const queryOpts: Parameters<typeof createDefaultOptions>[0] = {
    model: options.model || 'sonnet',
    sessionId: session.id,
  };
  if (options.systemPrompt) {
    queryOpts.systemPrompt = options.systemPrompt;
  }
  const queryOptions = createDefaultOptions(queryOpts);

  // Add user message
  const userMessage: LLMMessage = { role: 'user', content: prompt };
  session.messages.push(userMessage);

  // Generate response using SDK
  let response = '';
  for await (const message of query(prompt, queryOptions)) {
    if (message.type === 'result' && message.content) {
      response = message.content;
    }
  }

  // Add assistant message and save
  const assistantMessage: LLMMessage = { role: 'assistant', content: response };
  session.messages.push(assistantMessage);

  await sessionManager.updateSession(session.id, {
    messages: session.messages,
    state: 'completed',
  });

  return response;
}

/**
 * Stream a single prompt to stdout
 */
export async function streamPrompt(prompt: string, options: ChatOptions): Promise<void> {
  const queryOpts: Parameters<typeof createDefaultOptions>[0] = {
    model: options.model || 'sonnet',
  };
  if (options.systemPrompt) {
    queryOpts.systemPrompt = options.systemPrompt;
  }
  const queryOptions = createDefaultOptions(queryOpts);

  const controller = createQueryController();

  // Handle Ctrl+C to interrupt
  const sigintHandler = () => {
    controller.interrupt();
  };
  process.on('SIGINT', sigintHandler);

  try {
    for await (const message of query(prompt, queryOptions, controller)) {
      if (message.type === 'assistant' && message.content) {
        process.stdout.write(message.content);
      }
    }
    console.log('');
  } finally {
    process.removeListener('SIGINT', sigintHandler);
  }
}
