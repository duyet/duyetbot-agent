import { describe, expect, it } from 'vitest';
import { shortenModelName } from '../model.js';

describe('shortenModelName', () => {
  describe('Claude 3.5 models', () => {
    it('should shorten claude-3-5-sonnet-20241022 to sonnet-3.5', () => {
      expect(shortenModelName('claude-3-5-sonnet-20241022')).toBe('sonnet-3.5');
    });

    it('should shorten claude-3-5-sonnet with different date to sonnet-3.5', () => {
      expect(shortenModelName('claude-3-5-sonnet-20250101')).toBe('sonnet-3.5');
    });

    it('should shorten claude-3-5-haiku-20241022 to haiku-3.5', () => {
      expect(shortenModelName('claude-3-5-haiku-20241022')).toBe('haiku-3.5');
    });

    it('should shorten claude-3-5-haiku with different date to haiku-3.5', () => {
      expect(shortenModelName('claude-3-5-haiku-20250101')).toBe('haiku-3.5');
    });
  });

  describe('Claude 3 models', () => {
    it('should shorten claude-3-opus-20240229 to opus-3', () => {
      expect(shortenModelName('claude-3-opus-20240229')).toBe('opus-3');
    });

    it('should shorten claude-3-opus with different date to opus-3', () => {
      expect(shortenModelName('claude-3-opus-20240101')).toBe('opus-3');
    });

    it('should handle claude-3-opus without date suffix', () => {
      expect(shortenModelName('claude-3-opus')).toBe('opus-3');
    });
  });

  describe('Claude 4 models', () => {
    it('should shorten claude-4-opus to opus-4', () => {
      expect(shortenModelName('claude-4-opus')).toBe('opus-4');
    });

    it('should shorten claude-4-opus with date suffix to opus-4', () => {
      expect(shortenModelName('claude-4-opus-20250101')).toBe('opus-4');
    });
  });

  describe('GPT models', () => {
    it('should keep gpt-4o-mini as-is', () => {
      expect(shortenModelName('gpt-4o-mini')).toBe('gpt-4o-mini');
    });

    it('should shorten gpt-4-turbo-2024-04-09 to gpt-4-turbo', () => {
      expect(shortenModelName('gpt-4-turbo-2024-04-09')).toBe('gpt-4-turbo');
    });

    it('should shorten gpt-4-turbo with different date to gpt-4-turbo', () => {
      expect(shortenModelName('gpt-4-turbo-2025-01-15')).toBe('gpt-4-turbo');
    });

    it('should handle gpt-4-turbo without date suffix', () => {
      expect(shortenModelName('gpt-4-turbo')).toBe('gpt-4-turbo');
    });
  });

  describe('Unknown/other models', () => {
    it('should keep short model names unchanged', () => {
      expect(shortenModelName('gpt-4')).toBe('gpt-4');
    });

    it('should keep medium length model names unchanged', () => {
      expect(shortenModelName('llama-2-70b')).toBe('llama-2-70b');
    });

    it('should keep exactly 20 character model names unchanged', () => {
      const model = 'a'.repeat(20);
      expect(shortenModelName(model)).toBe(model);
    });

    it('should truncate model names longer than 20 characters', () => {
      const longName = 'very-long-model-name-that-exceeds-limit';
      expect(shortenModelName(longName)).toBe(longName.substring(0, 17) + '...');
      expect(shortenModelName(longName).length).toBe(20);
    });

    it('should truncate very long model names correctly', () => {
      const veryLongName = 'a'.repeat(50);
      expect(shortenModelName(veryLongName)).toBe('a'.repeat(17) + '...');
      expect(shortenModelName(veryLongName).length).toBe(20);
    });
  });

  describe('Edge cases', () => {
    it('should handle empty string', () => {
      expect(shortenModelName('')).toBe('');
    });

    it('should handle model names with extra whitespace (no trimming)', () => {
      // Note: The function doesn't trim, so leading/trailing spaces are preserved
      expect(shortenModelName(' gpt-4 ')).toHaveLength(7);
    });

    it('should handle model names that are exactly at boundary (17 chars)', () => {
      const boundaryName = 'a'.repeat(17);
      expect(shortenModelName(boundaryName)).toBe(boundaryName);
    });

    it('should handle model names that are just over boundary (18 chars)', () => {
      const overBoundary = 'a'.repeat(18);
      // 18 chars is still within the 20 char limit, so no truncation
      expect(shortenModelName(overBoundary)).toBe(overBoundary);
    });

    it('should case-sensitively match claude patterns', () => {
      // These should be treated as unknown models since they don\'t match exactly
      const upperModel = 'CLAUDE-3-5-SONNET-20241022';
      expect(shortenModelName(upperModel)).toBe(upperModel.substring(0, 17) + '...');
    });
  });

  describe('Real-world examples', () => {
    it('should handle typical Anthropic model names', () => {
      const models = [
        ['claude-3-5-sonnet-20241022', 'sonnet-3.5'],
        ['claude-3-5-haiku-20241022', 'haiku-3.5'],
        ['claude-3-opus-20240229', 'opus-3'],
      ];

      for (const [input, expected] of models) {
        expect(shortenModelName(input)).toBe(expected);
      }
    });

    it('should handle typical OpenAI model names', () => {
      const models = [
        ['gpt-4o-mini', 'gpt-4o-mini'],
        ['gpt-4-turbo-2024-04-09', 'gpt-4-turbo'],
      ];

      for (const [input, expected] of models) {
        expect(shortenModelName(input)).toBe(expected);
      }
    });

    it('should handle other provider models', () => {
      const models = [
        ['meta-llama-3-8b-instruct', 'meta-llama-3-8b-i...'],
        ['mistral-large-2402', 'mistral-large-2402'],
        ['gemini-2.0-flash', 'gemini-2.0-flash'],
      ];

      for (const [input, expected] of models) {
        expect(shortenModelName(input)).toBe(expected);
      }
    });
  });
});
