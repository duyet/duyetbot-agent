/**
 * Tests for XML history embedding format utilities
 */

import { describe, expect, it } from 'vitest';
import { formatHistoryAsXML, formatWithEmbeddedHistory } from '../format.js';
import type { Message } from '../types.js';

describe('formatHistoryAsXML', () => {
  it('returns empty string for empty history', () => {
    const result = formatHistoryAsXML([]);
    expect(result).toBe('');
  });

  it('formats simple conversation history', () => {
    const history: Message[] = [
      { role: 'user', content: 'Hello' },
      { role: 'assistant', content: 'Hi there!' },
    ];

    const result = formatHistoryAsXML(history);

    expect(result).toContain('<conversation_history>');
    expect(result).toContain('</conversation_history>');
    expect(result).toContain('<message role="user">Hello</message>');
    expect(result).toContain('<message role="assistant">Hi there!</message>');
  });

  it('filters out system and tool messages', () => {
    const history: Message[] = [
      { role: 'system', content: 'System prompt' },
      { role: 'user', content: 'Hello' },
      { role: 'tool', content: 'Tool result', toolCallId: '123', name: 'test' },
      { role: 'assistant', content: 'Response' },
    ];

    const result = formatHistoryAsXML(history);

    expect(result).not.toContain('System prompt');
    expect(result).not.toContain('Tool result');
    expect(result).toContain('<message role="user">Hello</message>');
    expect(result).toContain('<message role="assistant">Response</message>');
  });

  it('escapes XML special characters', () => {
    const history: Message[] = [
      {
        role: 'user',
        content: 'Test <script>alert("xss")</script> & "quotes"',
      },
    ];

    const result = formatHistoryAsXML(history);

    expect(result).toContain('&lt;script&gt;');
    expect(result).toContain('&amp;');
    expect(result).toContain('&quot;quotes&quot;');
    expect(result).not.toContain('<script>');
  });

  it('handles multiple exchanges', () => {
    const history: Message[] = [
      { role: 'user', content: 'First question' },
      { role: 'assistant', content: 'First answer' },
      { role: 'user', content: 'Second question' },
      { role: 'assistant', content: 'Second answer' },
    ];

    const result = formatHistoryAsXML(history);
    const messageMatches = result.match(/<message role=/g);

    expect(messageMatches).toHaveLength(4);
  });

  it('preserves message order', () => {
    const history: Message[] = [
      { role: 'user', content: 'AAA' },
      { role: 'assistant', content: 'BBB' },
      { role: 'user', content: 'CCC' },
    ];

    const result = formatHistoryAsXML(history);
    const aaaIndex = result.indexOf('AAA');
    const bbbIndex = result.indexOf('BBB');
    const cccIndex = result.indexOf('CCC');

    expect(aaaIndex).toBeLessThan(bbbIndex);
    expect(bbbIndex).toBeLessThan(cccIndex);
  });
});

describe('formatWithEmbeddedHistory', () => {
  it('returns system and user messages without history', () => {
    const result = formatWithEmbeddedHistory([], 'You are helpful', 'Hello');

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ role: 'system', content: 'You are helpful' });
    expect(result[1]).toEqual({ role: 'user', content: 'Hello' });
  });

  it('embeds history in user message with XML tags', () => {
    const history: Message[] = [
      { role: 'user', content: 'Previous' },
      { role: 'assistant', content: 'Response' },
    ];

    const result = formatWithEmbeddedHistory(history, 'System prompt', 'New message');

    expect(result).toHaveLength(2);
    expect(result[0]!.role).toBe('system');
    expect(result[1]!.role).toBe('user');
    expect(result[1]!.content).toContain('<conversation_history>');
    expect(result[1]!.content).toContain('Previous');
    expect(result[1]!.content).toContain('Response');
    expect(result[1]!.content).toContain('<current_message>');
    expect(result[1]!.content).toContain('New message');
    expect(result[1]!.content).toContain('</current_message>');
  });

  it('wraps current message in XML tags when history exists', () => {
    const history: Message[] = [{ role: 'user', content: 'Hi' }];

    const result = formatWithEmbeddedHistory(history, 'System', 'Current');

    expect(result[1]!.content).toContain('<current_message>');
    expect(result[1]!.content).toContain('Current');
    expect(result[1]!.content).toContain('</current_message>');
  });

  it('does not wrap message when no history', () => {
    const result = formatWithEmbeddedHistory([], 'System', 'Current');

    expect(result[1]!.content).toBe('Current');
    expect(result[1]!.content).not.toContain('<current_message>');
  });

  it('preserves system prompt exactly', () => {
    const systemPrompt = 'You are a helpful assistant.\nBe concise.';
    const result = formatWithEmbeddedHistory([], systemPrompt, 'Hi');

    expect(result[0]!.content).toBe(systemPrompt);
  });

  it('handles complex history with special characters', () => {
    const history: Message[] = [
      { role: 'user', content: 'Code: <div>test</div>' },
      { role: 'assistant', content: 'Use &amp; for ampersand' },
    ];

    const result = formatWithEmbeddedHistory(history, 'System', 'Follow up');

    // Should contain escaped versions
    expect(result[1]!.content).toContain('&lt;div&gt;');
    expect(result[1]!.content).toContain('&amp;amp;');
  });

  it('returns only 2 messages regardless of history size', () => {
    const history: Message[] = Array(10)
      .fill(null)
      .map((_, i) => ({
        role: i % 2 === 0 ? 'user' : 'assistant',
        content: `Message ${i}`,
      })) as Message[];

    const result = formatWithEmbeddedHistory(history, 'System', 'Current');

    // Should always return exactly 2 messages (system + user with embedded history)
    expect(result).toHaveLength(2);
    expect(result[0]!.role).toBe('system');
    expect(result[1]!.role).toBe('user');
  });
});
