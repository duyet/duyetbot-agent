/**
 * Tests for debug footer functionality
 *
 * Note: We import TelegramContext type inline to avoid pulling in
 * cloudflare: protocol dependencies from the transport module.
 */

import type { DebugContext } from '@duyetbot/chat-agent';
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

    it('returns null when routingFlow is empty', () => {
      const ctx = createMockContext({
        isAdmin: true,
        debugContext: {
          routingFlow: [],
        },
      });
      expect(formatDebugFooter(ctx)).toBeNull();
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
      expect(footer).toContain('🔍');
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
      expect(footer).toContain('⚠️ get_latest_posts: timeout');
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

    it('escapes HTML in message when adding debug footer', () => {
      const ctx = createMockContext({
        isAdmin: true,
        debugContext: {
          routingFlow: [{ agent: 'simple-agent', durationMs: 500 }],
          totalDurationMs: 500,
        },
      });
      const result = prepareMessageWithDebug('Hello <b>world</b>', ctx);
      expect(result.text).toContain('Hello &lt;b&gt;world&lt;/b&gt;');
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

    it('escapes HTML special chars even for non-admin users', () => {
      const ctx = createMockContext({
        isAdmin: false,
      });
      const result = prepareMessageWithDebug('Use <code> & "quotes"', ctx);
      expect(result.text).toBe('Use &lt;code&gt; &amp; &quot;quotes&quot;');
      expect(result.parseMode).toBe('HTML');
    });
  });
});
