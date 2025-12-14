import { describe, expect, it } from 'vitest';
import type { Message } from '../../types.js';
import { buildInitialMessages, buildToolIterationMessages } from '../context-builder.js';

describe('ContextBuilder', () => {
  it('should build initial messages with empty history', () => {
    const messages = buildInitialMessages(
      {
        systemPrompt: 'You are helpful',
        messages: [],
      },
      'Hello'
    );

    expect(messages).toHaveLength(2);
    expect(messages[0]?.role).toBe('system');
    expect(messages[0]?.content).toBe('You are helpful');
    expect(messages[1]?.role).toBe('user');
    expect(messages[1]?.content).toBe('Hello');
  });

  it('should build initial messages with conversation history', () => {
    const history: Message[] = [
      { role: 'user', content: 'Previous question' },
      { role: 'assistant', content: 'Previous answer' },
    ];

    const messages = buildInitialMessages(
      {
        systemPrompt: 'You are helpful',
        messages: history,
      },
      'Current question'
    );

    expect(messages).toHaveLength(2);
    expect(messages[0]?.role).toBe('system');
    expect(messages[1]?.role).toBe('user');
    // History should be embedded in user message as XML
    expect(messages[1]?.content).toContain('<conversation_history>');
    expect(messages[1]?.content).toContain('Previous question');
    expect(messages[1]?.content).toContain('Previous answer');
    expect(messages[1]?.content).toContain('Current question');
  });

  it('should include quoted context in user message', () => {
    const messages = buildInitialMessages(
      {
        systemPrompt: 'You are helpful',
        messages: [],
      },
      'What about this?',
      {
        text: 'Original message',
        username: 'john',
      }
    );

    expect(messages[1]?.content).toContain('<quoted_message');
    expect(messages[1]?.content).toContain('john');
    expect(messages[1]?.content).toContain('Original message');
    expect(messages[1]?.content).toContain('What about this?');
  });

  it('should build tool iteration messages', () => {
    const initialMessages = [
      { role: 'system' as const, content: 'You are helpful' },
      { role: 'user' as const, content: 'Question' },
    ];

    const toolConversation = [
      { role: 'assistant' as const, content: 'Let me check' },
      { role: 'user' as const, content: '[Tool Result]: Data' },
    ];

    const messages = buildToolIterationMessages(initialMessages, toolConversation);

    expect(messages).toHaveLength(4);
    expect(messages[0]?.content).toBe('You are helpful');
    expect(messages[1]?.content).toBe('Question');
    expect(messages[2]?.content).toBe('Let me check');
    expect(messages[3]?.content).toBe('[Tool Result]: Data');
  });
});
