/**
 * Tests for GitHub Webhook Handler
 */

import { describe, it, expect } from 'vitest';
import { verifyWebhookSignature, mentionsDuyetbot, extractCommand } from '@/github/webhook-handler';

describe('GitHub Webhook Handler', () => {
  describe('verifyWebhookSignature', () => {
    it('should verify valid HMAC signature', () => {
      const payload = JSON.stringify({ test: 'data' });
      const secret = 'my-secret-key';

      // Generate expected signature
      const crypto = require('node:crypto');
      const hmac = crypto.createHmac('sha256', secret);
      const expectedSignature = `sha256=${hmac.update(payload).digest('hex')}`;

      const isValid = verifyWebhookSignature(payload, expectedSignature, secret);
      expect(isValid).toBe(true);
    });

    it('should reject invalid signature', () => {
      const payload = JSON.stringify({ test: 'data' });
      const secret = 'my-secret-key';
      // Create a valid-length signature but with wrong content
      const crypto = require('node:crypto');
      const hmac = crypto.createHmac('sha256', secret);
      const invalidSignature = `sha256=${hmac.update('wrong data').digest('hex')}`;

      const isValid = verifyWebhookSignature(payload, invalidSignature, secret);
      expect(isValid).toBe(false);
    });

    it('should reject signature with wrong secret', () => {
      const payload = JSON.stringify({ test: 'data' });
      const secret = 'my-secret-key';
      const wrongSecret = 'wrong-secret';

      const crypto = require('node:crypto');
      const hmac = crypto.createHmac('sha256', wrongSecret);
      const signature = `sha256=${hmac.update(payload).digest('hex')}`;

      const isValid = verifyWebhookSignature(payload, signature, secret);
      expect(isValid).toBe(false);
    });

    it('should handle empty payload', () => {
      const payload = '';
      const secret = 'my-secret-key';

      const crypto = require('node:crypto');
      const hmac = crypto.createHmac('sha256', secret);
      const signature = `sha256=${hmac.update(payload).digest('hex')}`;

      const isValid = verifyWebhookSignature(payload, signature, secret);
      expect(isValid).toBe(true);
    });
  });

  describe('mentionsDuyetbot', () => {
    it('should detect @duyetbot mention', () => {
      expect(mentionsDuyetbot('@duyetbot please review this PR')).toBe(true);
      expect(mentionsDuyetbot('Hey @duyetbot can you help?')).toBe(true);
      expect(mentionsDuyetbot('@duyetbot')).toBe(true);
    });

    it('should detect case-insensitive mentions', () => {
      expect(mentionsDuyetbot('@Duyetbot review this')).toBe(true);
      expect(mentionsDuyetbot('@DUYETBOT help')).toBe(true);
      expect(mentionsDuyetbot('@DuYeTbOt test')).toBe(true);
    });

    it('should not detect partial matches', () => {
      expect(mentionsDuyetbot('@duyetbots')).toBe(false);
      expect(mentionsDuyetbot('duyetbot')).toBe(false);
      expect(mentionsDuyetbot('@notduyetbot')).toBe(false);
    });

    it('should detect mention in multiline text', () => {
      const text = `
        This is a comment.

        @duyetbot please analyze this code

        Thank you!
      `;
      expect(mentionsDuyetbot(text)).toBe(true);
    });

    it('should return false for no mention', () => {
      expect(mentionsDuyetbot('Just a regular comment')).toBe(false);
      expect(mentionsDuyetbot('@otherbot help')).toBe(false);
      expect(mentionsDuyetbot('')).toBe(false);
    });
  });

  describe('extractCommand', () => {
    it('should extract command after @duyetbot', () => {
      const command = extractCommand('@duyetbot review this code');
      expect(command).toBe('review this code');
    });

    it('should remove @duyetbot mention', () => {
      const command = extractCommand('Hey @duyetbot can you help?');
      expect(command).toBe('Hey  can you help?'); // Note: double space is expected
    });

    it('should remove first @duyetbot mention', () => {
      const command = extractCommand('@duyetbot test command');
      expect(command).toBe('test command');
    });

    it('should handle multiple @duyetbot mentions', () => {
      const command = extractCommand('@duyetbot @duyetbot test');
      // Only first mention is removed due to \b word boundary
      expect(command).toContain('test');
    });

    it('should preserve code blocks', () => {
      const text = '@duyetbot check `code` here';
      const command = extractCommand(text);
      expect(command).toContain('`code`');
      expect(command).toContain('check');
    });

    it('should trim whitespace', () => {
      const command = extractCommand('  @duyetbot   test   ');
      expect(command).toBe('test');
    });

    it('should handle only @duyetbot', () => {
      const command = extractCommand('@duyetbot');
      expect(command).toBe('');
    });

    it('should preserve important punctuation', () => {
      const command = extractCommand('@duyetbot what is the issue?');
      expect(command).toBe('what is the issue?');
    });

    it('should handle case-insensitive @duyetbot', () => {
      const command = extractCommand('@Duyetbot TEST command');
      expect(command).toBe('TEST command');
    });
  });
});
