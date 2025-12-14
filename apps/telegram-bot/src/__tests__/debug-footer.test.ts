/**
 * Tests for debug footer functionality
 *
 * Note: We import TelegramContext type inline to avoid pulling in
 * cloudflare: protocol dependencies from the transport module.
 */

import type { DebugContext } from '@duyetbot/cloudflare-agent';
import { describe, expect, it } from 'vitest';
import { escapeHtml, formatDebugFooter, prepareMessageWithDebug } from '../debug-footer.js';

/**
 * Minimal TelegramContext type for testing
 * (avoids importing from transport.ts which may have cloudflare deps)
 */
interface TelegramContext {
  token: string;
  chatId: number;
  userId: number;
  text: string;
  startTime: number;
  isAdmin: boolean;
  messageId: number;
  isGroupChat: boolean;
  debugContext?: DebugContext;
  parseMode?: 'HTML' | 'MarkdownV2';
}

/**
 * Create a mock TelegramContext for testing
 */
function createMockContext(overrides: Partial<TelegramContext> = {}): TelegramContext {
  return {
    token: 'test-token',
    chatId: 123456,
    userId: 789,
    text: 'test message',
    startTime: Date.now(),
    isAdmin: false,
    messageId: 123,
    isGroupChat: false,
    ...overrides,
  };
}

describe('debug-footer', () => {
  describe('formatDebugFooter - Admin check wrapper', () => {
    it('returns null for non-admin users', () => {
      const ctx = createMockContext({
        isAdmin: false,
        debugContext: {
          routingFlow: [{ agent: 'simple-agent', durationMs: 100 }],
          totalDurationMs: 100,
        },
      });
      expect(formatDebugFooter(ctx)).toBeNull();
    });

    it('returns null when debugContext is missing', () => {
      const ctx = createMockContext({
        isAdmin: true,
      });
      expect(formatDebugFooter(ctx)).toBeNull();
    });

    it('returns null when routingFlow is empty and no metadata', () => {
      const ctx = createMockContext({
        isAdmin: true,
        debugContext: {
          routingFlow: [],
        },
      });
      expect(formatDebugFooter(ctx)).toBeNull();
    });

    it('returns minimal footer when routingFlow is empty but has metadata', () => {
      const ctx = createMockContext({
        isAdmin: true,
        debugContext: {
          routingFlow: [],
          totalDurationMs: 1500,
          metadata: {
            model: 'claude-3-5-sonnet-20241022',
          },
        },
      });
      const footer = formatDebugFooter(ctx);
      expect(footer).toContain('1.50s');
      expect(footer).toContain('model:sonnet-3.5');
      expect(footer).toContain('<blockquote expandable>');
    });

    it('delegates to shared implementation for admin users', () => {
      const ctx = createMockContext({
        isAdmin: true,
        debugContext: {
          routingFlow: [
            { agent: 'router-agent', durationMs: 100 },
            { agent: 'simple-agent', durationMs: 1130 },
          ],
          totalDurationMs: 1230,
        },
      });
      const footer = formatDebugFooter(ctx);
      expect(footer).toContain('<blockquote expandable>');
      expect(footer).toContain('[debug]');
      expect(footer).toContain('router-agent');
      expect(footer).toContain('simple-agent');
      expect(footer).toContain('</blockquote>');
    });

    it('includes error messages from debug context', () => {
      const ctx = createMockContext({
        isAdmin: true,
        debugContext: {
          routingFlow: [
            {
              agent: 'duyet-info-agent',
              toolChain: ['get_latest_posts'],
              durationMs: 2340,
            },
          ],
          metadata: {
            lastToolError: 'get_latest_posts: timeout',
          },
        },
      });
      const footer = formatDebugFooter(ctx);
      expect(footer).toContain('duyet-info-agent');
      expect(footer).toContain('[!] get_latest_posts: timeout');
    });

    it('escapes HTML in error messages', () => {
      const ctx = createMockContext({
        isAdmin: true,
        debugContext: {
          routingFlow: [{ agent: 'test-agent' }],
          metadata: {
            toolErrors: 1,
            lastToolError: 'tool: <timeout> & retry',
          },
        },
      });
      const footer = formatDebugFooter(ctx);
      expect(footer).toContain('&lt;timeout&gt;');
      expect(footer).toContain('&amp;');
      expect(footer).not.toContain('<timeout>');
    });
  });

  describe('escapeHtml', () => {
    it('escapes ampersand', () => {
      expect(escapeHtml('foo & bar')).toBe('foo &amp; bar');
    });

    it('escapes less than', () => {
      expect(escapeHtml('a < b')).toBe('a &lt; b');
    });

    it('escapes greater than', () => {
      expect(escapeHtml('a > b')).toBe('a &gt; b');
    });

    it('escapes double quotes', () => {
      expect(escapeHtml('say "hello"')).toBe('say &quot;hello&quot;');
    });

    it('escapes single quotes', () => {
      expect(escapeHtml("it's")).toBe('it&#39;s');
    });

    it('escapes multiple special characters', () => {
      expect(escapeHtml('<script>alert("xss")</script>')).toBe(
        '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;'
      );
    });

    it('leaves safe text unchanged', () => {
      expect(escapeHtml('Hello world!')).toBe('Hello world!');
    });
  });

  describe('prepareMessageWithDebug', () => {
    it('returns HTML mode with escaped text for non-admin users', () => {
      const ctx = createMockContext({
        isAdmin: false,
      });
      const result = prepareMessageWithDebug('Hello', ctx);
      expect(result.text).toBe('Hello');
      expect(result.parseMode).toBe('HTML');
    });

    it('returns HTML mode with debug footer for admin users', () => {
      const ctx = createMockContext({
        isAdmin: true,
        debugContext: {
          routingFlow: [{ agent: 'simple-agent', durationMs: 500 }],
          totalDurationMs: 500,
        },
      });
      const result = prepareMessageWithDebug('Hello', ctx);
      expect(result.text).toContain('Hello');
      expect(result.text).toContain('<blockquote expandable>');
      expect(result.parseMode).toBe('HTML');
    });

    it('preserves HTML tags in message (LLM produces formatted HTML)', () => {
      const ctx = createMockContext({
        isAdmin: true,
        debugContext: {
          routingFlow: [{ agent: 'simple-agent', durationMs: 500 }],
          totalDurationMs: 500,
        },
      });
      // LLM is instructed to produce HTML-formatted output, so tags should be preserved
      const result = prepareMessageWithDebug('Hello <b>world</b>', ctx);
      expect(result.text).toContain('Hello <b>world</b>');
      expect(result.parseMode).toBe('HTML');
    });

    it('returns HTML mode with escaped text for admin without debug context', () => {
      const ctx = createMockContext({
        isAdmin: true,
      });
      const result = prepareMessageWithDebug('Hello', ctx);
      expect(result.text).toBe('Hello');
      expect(result.parseMode).toBe('HTML');
    });

    it('preserves HTML formatting for all users (LLM produces formatted HTML)', () => {
      const ctx = createMockContext({
        isAdmin: false,
      });
      // LLM is instructed to produce HTML-formatted output, so tags should be preserved
      // The LLM handles entity escaping in plain text as per the prompt instructions
      const result = prepareMessageWithDebug('Use <code>command</code> &amp; "quotes"', ctx);
      expect(result.text).toBe('Use <code>command</code> &amp; "quotes"');
      expect(result.parseMode).toBe('HTML');
    });

    describe('MarkdownV2 mode', () => {
      it('returns MarkdownV2 mode when configured', () => {
        const ctx = createMockContext({
          isAdmin: false,
          parseMode: 'MarkdownV2',
        });
        const result = prepareMessageWithDebug('Hello world', ctx);
        expect(result.parseMode).toBe('MarkdownV2');
      });

      it('preserves MarkdownV2 formatting (LLM produces formatted output)', () => {
        const ctx = createMockContext({
          isAdmin: false,
          parseMode: 'MarkdownV2',
        });

        // LLM is instructed to produce MarkdownV2-formatted output
        // Text is NOT escaped - LLM handles formatting as per prompt instructions
        const patterns = [
          // Plain text with loading indicators
          { input: '🔄 Thinking...', expected: '🔄 Thinking...' },
          { input: '🔄 Loading...', expected: '🔄 Loading...' },
          { input: '🤔 Analyzing...', expected: '🤔 Analyzing...' },
          { input: '📊 Processing (50%)', expected: '📊 Processing (50%)' },
          { input: '✅ Done!', expected: '✅ Done!' },
          { input: '⚠️ Warning!', expected: '⚠️ Warning!' },
          { input: 'Hello world!', expected: 'Hello world!' },
          // MarkdownV2 formatting is preserved
          { input: '*bold* text', expected: '*bold* text' },
          { input: '_italic_ text', expected: '_italic_ text' },
          { input: '~strikethrough~', expected: '~strikethrough~' },
          // Links are preserved
          {
            input: '[link](https://example.com)',
            expected: '[link](https://example.com)',
          },
          // Code is preserved
          { input: '`code`', expected: '`code`' },
        ];

        for (const { input, expected } of patterns) {
          const result = prepareMessageWithDebug(input, ctx);
          expect(result.text).toBe(expected);
        }
      });

      it('preserves text as-is for MarkdownV2 (no escaping by transport)', () => {
        const ctx = createMockContext({
          isAdmin: false,
          parseMode: 'MarkdownV2',
        });

        // LLM produces properly formatted MarkdownV2, transport does not escape
        const response =
          'Here is a detailed explanation\\. The dots in this sentence are escaped by the LLM\\.';
        const result = prepareMessageWithDebug(response, ctx);
        // Text is passed through unchanged
        expect(result.text).toBe(response);
      });

      it('includes MarkdownV2 debug footer for admin users', () => {
        const ctx = createMockContext({
          isAdmin: true,
          parseMode: 'MarkdownV2',
          debugContext: {
            routingFlow: [{ agent: 'simple-agent', durationMs: 500 }],
            totalDurationMs: 500,
          },
        });
        const result = prepareMessageWithDebug('Hello', ctx);
        expect(result.text).toContain('Hello');
        // MarkdownV2 expandable blockquote syntax
        expect(result.text).toContain('**>');
        expect(result.text).toContain('||');
        expect(result.parseMode).toBe('MarkdownV2');
      });
    });
  });
});
