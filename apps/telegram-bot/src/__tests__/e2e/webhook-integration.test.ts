/**
 * Telegram Bot Webhook Integration Tests
 *
 * Tests webhook handling, message parsing, and response flow through
 * the Cloudflare Workers test environment.
 */

import { SELF } from 'cloudflare:test';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createUpdate, resetFixtureCounters } from './helpers/fixtures';
import { resetMocks, setupMocks } from './helpers/mocks';

describe('Telegram Bot - Webhook Integration', () => {
  beforeEach(() => {
    setupMocks();
    resetFixtureCounters();
  });

  afterEach(() => {
    resetMocks();
  });

  describe('Webhook Handling', () => {
    it('accepts valid webhook payload and returns OK', async () => {
      const update = createUpdate({ text: 'Hello bot', user: 'admin' });

      const response = await SELF.fetch('http://localhost/webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(update),
      });

      expect(response.status).toBe(200);
      const result = await response.json();
      expect(result).toHaveProperty('ok', true);
    });

    it('returns OK for invalid JSON payload gracefully', async () => {
      const response = await SELF.fetch('http://localhost/webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'invalid json{{{',
      });

      // Should return OK (webhook pattern - never fail webhook delivery)
      expect(response.status).toBe(200);
    });

    it('handles empty update payload', async () => {
      const response = await SELF.fetch('http://localhost/webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      expect(response.status).toBe(200);
    });

    it('handles missing update_id gracefully', async () => {
      const update = createUpdate({ text: 'test' });
      const { update_id, ...rest } = update;

      const response = await SELF.fetch('http://localhost/webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(rest),
      });

      expect(response.status).toBe(200);
    });
  });

  describe('Message Parsing', () => {
    it('parses text message from private chat', async () => {
      const update = createUpdate({ text: 'Hello world', user: 'admin', chat: 'private' });

      const response = await SELF.fetch('http://localhost/webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(update),
      });

      expect(response.status).toBe(200);
    });

    it('parses text message from group chat', async () => {
      const update = createUpdate({
        text: 'Hello bot',
        user: 'admin',
        chat: 'supergroup',
      });

      const response = await SELF.fetch('http://localhost/webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(update),
      });

      expect(response.status).toBe(200);
    });

    it('handles message with reply_to_message', async () => {
      const update = createUpdate({
        text: 'Thanks for the help',
        user: 'admin',
        replyToBot: true,
      });

      const response = await SELF.fetch('http://localhost/webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(update),
      });

      expect(response.status).toBe(200);
    });

    it('handles quoted message with custom reply', async () => {
      const update = createUpdate({
        text: 'Can you explain more?',
        user: 'admin',
        replyTo: {
          messageId: 99,
          user: 'admin',
          text: 'Previous context',
        },
      });

      const response = await SELF.fetch('http://localhost/webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(update),
      });

      expect(response.status).toBe(200);
    });

    it('handles special characters in message', async () => {
      const update = createUpdate({
        text: 'Test: <b>bold</b>, <i>italic</i>, code: `const x = 1`',
        user: 'admin',
      });

      const response = await SELF.fetch('http://localhost/webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(update),
      });

      expect(response.status).toBe(200);
    });

    it('handles very long messages (5000+ chars)', async () => {
      const longText = 'a'.repeat(5000);
      const update = createUpdate({ text: longText, user: 'admin' });

      const response = await SELF.fetch('http://localhost/webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(update),
      });

      expect(response.status).toBe(200);
    });

    it('handles emoji and unicode characters', async () => {
      const update = createUpdate({
        text: 'Hello! 🎉🚀🤖 Test unicode: 你好 🌍',
        user: 'admin',
      });

      const response = await SELF.fetch('http://localhost/webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(update),
      });

      expect(response.status).toBe(200);
    });
  });

  describe('Response Sending', () => {
    it('responds immediately (fire-and-forget pattern)', async () => {
      const update = createUpdate({ text: 'Hello bot', user: 'admin' });

      const startTime = Date.now();
      const response = await SELF.fetch('http://localhost/webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(update),
      });
      const duration = Date.now() - startTime;

      expect(response.status).toBe(200);
      // Should return quickly (< 200ms for immediate response)
      expect(duration).toBeLessThan(200);
    });

    it('queues message to Durable Object for async processing', async () => {
      const update = createUpdate({
        text: 'Test message for queue',
        user: 'admin',
      });

      const response = await SELF.fetch('http://localhost/webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(update),
      });

      expect(response.status).toBe(200);
      const result = await response.json();
      expect(result).toHaveProperty('ok', true);
    });
  });

  describe('Command Handling', () => {
    it('handles /start command', async () => {
      const update = createUpdate({ text: '/start', user: 'admin' });

      const response = await SELF.fetch('http://localhost/webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(update),
      });

      expect(response.status).toBe(200);
    });

    it('handles /help command', async () => {
      const update = createUpdate({ text: '/help', user: 'admin' });

      const response = await SELF.fetch('http://localhost/webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(update),
      });

      expect(response.status).toBe(200);
    });

    it('handles /clear command', async () => {
      const update = createUpdate({ text: '/clear', user: 'admin' });

      const response = await SELF.fetch('http://localhost/webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(update),
      });

      expect(response.status).toBe(200);
    });
  });

  describe('Error Scenarios', () => {
    it('handles unauthorized user gracefully', async () => {
      const update = createUpdate({ text: 'Hello', user: 'unauthorized' });

      const response = await SELF.fetch('http://localhost/webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(update),
      });

      // Should still return OK (webhook pattern)
      expect(response.status).toBe(200);
    });

    it('handles empty message text gracefully', async () => {
      const update = createUpdate({ text: '', user: 'admin' });

      const response = await SELF.fetch('http://localhost/webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(update),
      });

      expect(response.status).toBe(200);
    });

    it('handles webhook with malformed data gracefully', async () => {
      const response = await SELF.fetch('http://localhost/webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{invalid json',
      });

      // Should return OK anyway (webhook pattern)
      expect(response.status).toBe(200);
    });

    it('handles concurrent webhook requests', async () => {
      const updates = [
        createUpdate({ text: 'Message 1', user: 'admin' }),
        createUpdate({ text: 'Message 2', user: 'admin' }),
        createUpdate({ text: 'Message 3', user: 'admin' }),
        createUpdate({ text: 'Message 4', user: 'admin' }),
        createUpdate({ text: 'Message 5', user: 'admin' }),
      ];

      const responses = await Promise.all(
        updates.map((update) =>
          SELF.fetch('http://localhost/webhook', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(update),
          })
        )
      );

      // All should succeed
      responses.forEach((response) => {
        expect(response.status).toBe(200);
      });
    });
  });

  describe('Group Chat Handling', () => {
    it('skips group message without bot mention', async () => {
      const update = createUpdate({
        text: 'Regular group message',
        user: 'admin',
        chat: 'supergroup',
      });

      const response = await SELF.fetch('http://localhost/webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(update),
      });

      // Should return OK but skip processing
      expect(response.status).toBe(200);
    });

    it('processes group message with bot mention', async () => {
      const update = createUpdate({
        text: '@duyetbot help me',
        user: 'admin',
        chat: 'supergroup',
      });

      const response = await SELF.fetch('http://localhost/webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(update),
      });

      expect(response.status).toBe(200);
    });

    it('processes group message as reply to bot', async () => {
      const update = createUpdate({
        text: 'Thanks for the info',
        user: 'admin',
        chat: 'supergroup',
        replyToBot: true,
      });

      const response = await SELF.fetch('http://localhost/webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(update),
      });

      expect(response.status).toBe(200);
    });
  });
});
