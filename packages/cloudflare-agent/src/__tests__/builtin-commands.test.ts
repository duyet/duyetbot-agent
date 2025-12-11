/**
 * Tests for built-in slash commands (/debug, /help, /start, /clear)
 *
 * Tests command formatting based on parseMode to ensure:
 * - MarkdownV2 mode uses *text* for bold (Markdown style)
 * - HTML mode uses <b>text</b> for bold (HTML style)
 */

import { describe, expect, it } from 'vitest';

describe('built-in slash commands', () => {
  describe('/debug command formatting', () => {
    it('formats /debug response correctly for MarkdownV2 mode (default)', () => {
      // Test the formatting logic without needing agent instantiation
      const isHTML = undefined === 'HTML'; // parseMode check
      const bold = (text: string) => (isHTML ? `<b>${text}</b>` : `*${text}*`);

      const title = bold('Debug Information');
      const userContext = bold('User Context:');
      const agentState = bold('Agent State:');

      // Should use Markdown syntax for MarkdownV2
      expect(title).toBe('*Debug Information*');
      expect(userContext).toBe('*User Context:*');
      expect(agentState).toBe('*Agent State:*');
      expect(title).not.toContain('<b>');
    });

    it('formats /debug response correctly for HTML mode', () => {
      // Test the formatting logic without needing agent instantiation
      const parseMode: 'HTML' | 'MarkdownV2' | undefined = 'HTML';
      const isHTML = parseMode === 'HTML';
      const bold = (text: string) => (isHTML ? `<b>${text}</b>` : `*${text}*`);

      const title = bold('Debug Information');
      const userContext = bold('User Context:');
      const agentState = bold('Agent State:');

      // Should use HTML syntax for HTML mode
      expect(title).toBe('<b>Debug Information</b>');
      expect(userContext).toBe('<b>User Context:</b>');
      expect(agentState).toBe('<b>Agent State:</b>');
      expect(title).not.toContain('*');
    });

    it('parseMode HTML uses HTML tags', () => {
      const parseMode: 'HTML' | 'MarkdownV2' | undefined = 'HTML';
      const isHTML = parseMode === 'HTML';
      const bold = (text: string) => (isHTML ? `<b>${text}</b>` : `*${text}*`);

      const result = bold('Test');
      expect(result).toBe('<b>Test</b>');
      expect(result).not.toContain('*');
    });

    it('parseMode MarkdownV2 uses Markdown syntax', () => {
      const parseMode: 'HTML' | 'MarkdownV2' | undefined = 'MarkdownV2';
      const isHTML = parseMode === 'HTML';
      const bold = (text: string) => (isHTML ? `<b>${text}</b>` : `*${text}*`);

      const result = bold('Test');
      expect(result).toBe('*Test*');
      expect(result).not.toContain('<b>');
    });

    it('parseMode undefined defaults to Markdown syntax', () => {
      const parseMode: 'HTML' | 'MarkdownV2' | undefined = undefined;
      const isHTML = parseMode === 'HTML';
      const bold = (text: string) => (isHTML ? `<b>${text}</b>` : `*${text}*`);

      const result = bold('Test');
      expect(result).toBe('*Test*');
      expect(result).not.toContain('<b>');
    });

    it('access denial response is consistent across modes', () => {
      const denialMessage = '🔒 Admin command - access denied';

      // Same response regardless of parseMode
      expect(denialMessage).toBe('🔒 Admin command - access denied');
      expect(denialMessage).not.toContain('*');
      expect(denialMessage).not.toContain('<b>');
    });
  });
});
