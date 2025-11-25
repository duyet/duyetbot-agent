/**
 * Tests for debug footer functionality
 */

import { describe, expect, it } from 'vitest';
import {
  escapeHtml,
  formatDebugFooter,
  isAdminUser,
  prepareMessageWithDebug,
} from '../debug-footer.js';
import type { TelegramContext } from '../transport.js';

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
    ...overrides,
  };
}

describe('debug-footer', () => {
  describe('isAdminUser', () => {
    it('returns false when adminUsername is not set', () => {
      const ctx = createMockContext({ username: 'testuser' });
      expect(isAdminUser(ctx)).toBe(false);
    });

    it('returns false when username does not match adminUsername', () => {
      const ctx = createMockContext({
        username: 'testuser',
        adminUsername: 'admin',
      });
      expect(isAdminUser(ctx)).toBe(false);
    });

    it('returns true when username matches adminUsername', () => {
      const ctx = createMockContext({
        username: 'admin',
        adminUsername: 'admin',
      });
      expect(isAdminUser(ctx)).toBe(true);
    });

    it('returns false when username is undefined', () => {
      const ctx = createMockContext({
        username: undefined,
        adminUsername: 'admin',
      });
      expect(isAdminUser(ctx)).toBe(false);
    });

    it('returns true when username has @ prefix and adminUsername does not', () => {
      const ctx = createMockContext({
        username: '@admin',
        adminUsername: 'admin',
      });
      expect(isAdminUser(ctx)).toBe(true);
    });

    it('returns true when adminUsername has @ prefix and username does not', () => {
      const ctx = createMockContext({
        username: 'admin',
        adminUsername: '@admin',
      });
      expect(isAdminUser(ctx)).toBe(true);
    });

    it('returns true when both have @ prefix', () => {
      const ctx = createMockContext({
        username: '@admin',
        adminUsername: '@admin',
      });
      expect(isAdminUser(ctx)).toBe(true);
    });
  });

  describe('formatDebugFooter', () => {
    it('returns null for non-admin users', () => {
      const ctx = createMockContext({
        username: 'testuser',
        adminUsername: 'admin',
        debugContext: {
          routingFlow: [{ agent: 'simple-agent', durationMs: 100 }],
          totalDurationMs: 100,
        },
      });
      expect(formatDebugFooter(ctx)).toBeNull();
    });

    it('returns null when debugContext is missing', () => {
      const ctx = createMockContext({
        username: 'admin',
        adminUsername: 'admin',
      });
      expect(formatDebugFooter(ctx)).toBeNull();
    });

    it('returns null when routingFlow is empty', () => {
      const ctx = createMockContext({
        username: 'admin',
        adminUsername: 'admin',
        debugContext: {
          routingFlow: [],
        },
      });
      expect(formatDebugFooter(ctx)).toBeNull();
    });

    it('formats simple routing flow correctly', () => {
      const ctx = createMockContext({
        username: 'admin',
        adminUsername: 'admin',
        debugContext: {
          routingFlow: [{ agent: 'simple-agent', durationMs: 1230 }],
          totalDurationMs: 1230,
        },
      });
      const footer = formatDebugFooter(ctx);
      expect(footer).toContain('<blockquote expandable>');
      expect(footer).toContain('🔍 simple-agent');
      expect(footer).toContain('1.23s');
      expect(footer).toContain('</blockquote>');
    });

    it('formats routing flow with tools', () => {
      const ctx = createMockContext({
        username: 'admin',
        adminUsername: 'admin',
        debugContext: {
          routingFlow: [
            {
              agent: 'orchestrator',
              tools: ['web_search', 'code_exec'],
              durationMs: 2500,
            },
          ],
          totalDurationMs: 2500,
        },
      });
      const footer = formatDebugFooter(ctx);
      expect(footer).toContain('orchestrator (web_search, code_exec)');
      expect(footer).toContain('2.50s');
    });

    it('formats multi-step routing flow', () => {
      const ctx = createMockContext({
        username: 'admin',
        adminUsername: 'admin',
        debugContext: {
          routingFlow: [
            { agent: 'router', durationMs: 100 },
            { agent: 'orchestrator', tools: ['plan'], durationMs: 500 },
            {
              agent: 'code-worker',
              tools: ['lint', 'format'],
              durationMs: 1000,
            },
          ],
          totalDurationMs: 1600,
        },
      });
      const footer = formatDebugFooter(ctx);
      expect(footer).toContain('router → orchestrator (plan) → code-worker (lint, format)');
      expect(footer).toContain('1.60s');
    });

    it('includes classification when available', () => {
      const ctx = createMockContext({
        username: 'admin',
        adminUsername: 'admin',
        debugContext: {
          routingFlow: [{ agent: 'simple-agent', durationMs: 500 }],
          totalDurationMs: 500,
          classification: {
            type: 'simple',
            category: 'general',
            complexity: 'low',
          },
        },
      });
      const footer = formatDebugFooter(ctx);
      expect(footer).toContain('simple/general/low');
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
    it('returns Markdown mode for non-admin users', () => {
      const ctx = createMockContext({
        username: 'testuser',
        adminUsername: 'admin',
      });
      const result = prepareMessageWithDebug('Hello', ctx);
      expect(result.text).toBe('Hello');
      expect(result.parseMode).toBe('Markdown');
    });

    it('returns HTML mode with debug footer for admin users', () => {
      const ctx = createMockContext({
        username: 'admin',
        adminUsername: 'admin',
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
        username: 'admin',
        adminUsername: 'admin',
        debugContext: {
          routingFlow: [{ agent: 'simple-agent', durationMs: 500 }],
          totalDurationMs: 500,
        },
      });
      const result = prepareMessageWithDebug('Hello <b>world</b>', ctx);
      expect(result.text).toContain('Hello &lt;b&gt;world&lt;/b&gt;');
      expect(result.parseMode).toBe('HTML');
    });

    it('returns Markdown mode for admin without debug context', () => {
      const ctx = createMockContext({
        username: 'admin',
        adminUsername: 'admin',
      });
      const result = prepareMessageWithDebug('Hello', ctx);
      expect(result.text).toBe('Hello');
      expect(result.parseMode).toBe('Markdown');
    });
  });
});
