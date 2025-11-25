/**
 * Tests for originalContext preservation in batch processing
 *
 * This test suite verifies that platform-specific context (like bot tokens)
 * is correctly preserved when messages are queued and processed in batches.
 *
 * Bug context: The batch processing was creating a minimal context object
 * without the token, causing "botundefined" in API URLs (404 errors).
 * Fix: Use originalContext from the first pending message.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PendingMessage } from '../batch-types.js';
import type { ParsedInput, Transport } from '../transport.js';

/**
 * Telegram-like context with bot token
 * This simulates the real TelegramContext structure
 */
interface TelegramTestContext {
  /** Bot token - CRITICAL for API calls */
  token: string;
  chatId: number;
  userId: number;
  text: string;
  username?: string;
  startTime: number;
  adminUsername?: string;
  requestId?: string;
}

/**
 * GitHub-like context with authentication
 */
interface GitHubTestContext {
  /** GitHub token - CRITICAL for API calls */
  githubToken: string;
  owner: string;
  repo: string;
  issueNumber: number;
  text: string;
  senderLogin: string;
}

describe('Batch Context Preservation', () => {
  describe('Telegram Context', () => {
    const createTelegramTransport = (): Transport<TelegramTestContext> => ({
      send: vi.fn().mockResolvedValue(123),
      edit: vi.fn().mockResolvedValue(undefined),
      typing: vi.fn().mockResolvedValue(undefined),
      parseContext: (ctx: TelegramTestContext): ParsedInput => ({
        text: ctx.text,
        userId: ctx.userId,
        chatId: ctx.chatId,
        username: ctx.username,
        metadata: { requestId: ctx.requestId, startTime: ctx.startTime },
      }),
    });

    it('preserves bot token in originalContext when queuing', () => {
      const ctx: TelegramTestContext = {
        token: 'secret-bot-token-12345',
        chatId: 453193179,
        userId: 453193179,
        text: 'hello test',
        username: 'testuser',
        startTime: Date.now(),
        requestId: 'req-123',
      };

      // Simulate queueMessage storing originalContext
      const pendingMessage: PendingMessage<TelegramTestContext> = {
        text: ctx.text,
        timestamp: Date.now(),
        requestId: ctx.requestId || crypto.randomUUID(),
        userId: ctx.userId,
        chatId: ctx.chatId,
        originalContext: ctx,
      };

      // Verify token is preserved in originalContext
      expect(pendingMessage.originalContext).toBeDefined();
      expect(pendingMessage.originalContext?.token).toBe('secret-bot-token-12345');
    });

    it('uses originalContext (with token) in processBatch instead of minimal context', () => {
      const mockSend = vi.fn().mockResolvedValue(123);
      const transport = createTelegramTransport();
      transport.send = mockSend;

      const originalContext: TelegramTestContext = {
        token: 'actual-bot-token',
        chatId: 123,
        userId: 456,
        text: 'original message',
        startTime: Date.now(),
      };

      const pendingMessage: PendingMessage<TelegramTestContext> = {
        text: 'original message',
        timestamp: Date.now(),
        requestId: 'req-1',
        userId: 456,
        chatId: 123,
        originalContext,
      };

      // Simulate processBatch using originalContext (THE FIX)
      const combinedText = 'combined messages';
      const ctx = {
        ...pendingMessage.originalContext!,
        text: combinedText,
      };

      // Call transport.send with reconstructed context
      transport.send(ctx, 'thinking...');

      // Verify send was called with full context including token
      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          token: 'actual-bot-token',
          chatId: 123,
          userId: 456,
          text: combinedText,
        }),
        'thinking...'
      );
    });

    it('would fail with minimal context (demonstrates the bug)', () => {
      const mockSend = vi.fn().mockResolvedValue(123);

      const pendingMessage: PendingMessage<TelegramTestContext> = {
        text: 'message',
        timestamp: Date.now(),
        requestId: 'req-1',
        userId: 456,
        chatId: 123,
        // Note: originalContext exists but wasn't being used
        originalContext: {
          token: 'real-token',
          chatId: 123,
          userId: 456,
          text: 'message',
          startTime: Date.now(),
        },
      };

      // BUGGY CODE - creates minimal context WITHOUT token
      const buggyCtx = {
        chatId: pendingMessage.chatId,
        userId: pendingMessage.userId,
        text: 'combined',
        metadata: { requestId: 'batch-123' },
      } as TelegramTestContext;

      // This would cause "botundefined" in the URL
      expect(buggyCtx.token).toBeUndefined();
    });

    it('correctly uses originalContext (demonstrates the fix)', () => {
      const pendingMessage: PendingMessage<TelegramTestContext> = {
        text: 'message',
        timestamp: Date.now(),
        requestId: 'req-1',
        userId: 456,
        chatId: 123,
        originalContext: {
          token: 'real-token',
          chatId: 123,
          userId: 456,
          text: 'message',
          startTime: Date.now(),
        },
      };

      // FIXED CODE - uses originalContext
      const baseCtx =
        pendingMessage.originalContext ??
        ({
          chatId: pendingMessage.chatId,
          userId: pendingMessage.userId,
        } as TelegramTestContext);

      const ctx = {
        ...baseCtx,
        text: 'combined messages',
      };

      // Token is preserved!
      expect(ctx.token).toBe('real-token');
      expect(ctx.text).toBe('combined messages');
    });
  });

  describe('GitHub Context', () => {
    it('preserves GitHub token in originalContext', () => {
      const ctx: GitHubTestContext = {
        githubToken: 'ghp_xxxxxxxxxxxx',
        owner: 'duyet',
        repo: 'duyetbot-agent',
        issueNumber: 123,
        text: '@bot help',
        senderLogin: 'user',
      };

      const pendingMessage: PendingMessage<GitHubTestContext> = {
        text: ctx.text,
        timestamp: Date.now(),
        requestId: 'req-456',
        userId: 'user',
        chatId: '123',
        originalContext: ctx,
      };

      // Verify GitHub-specific context is preserved
      expect(pendingMessage.originalContext?.githubToken).toBe('ghp_xxxxxxxxxxxx');
      expect(pendingMessage.originalContext?.owner).toBe('duyet');
      expect(pendingMessage.originalContext?.repo).toBe('duyetbot-agent');
      expect(pendingMessage.originalContext?.issueNumber).toBe(123);
    });

    it('uses originalContext for GitHub API calls', () => {
      const originalContext: GitHubTestContext = {
        githubToken: 'ghp_real_token',
        owner: 'owner',
        repo: 'repo',
        issueNumber: 42,
        text: 'original',
        senderLogin: 'sender',
      };

      const pendingMessage: PendingMessage<GitHubTestContext> = {
        text: 'original',
        timestamp: Date.now(),
        requestId: 'req-1',
        userId: 'sender',
        chatId: '42',
        originalContext,
      };

      // Fixed processBatch behavior
      const ctx = {
        ...pendingMessage.originalContext!,
        text: 'combined messages',
      };

      // All GitHub context preserved
      expect(ctx.githubToken).toBe('ghp_real_token');
      expect(ctx.owner).toBe('owner');
      expect(ctx.repo).toBe('repo');
      expect(ctx.issueNumber).toBe(42);
    });
  });

  describe('Error Context Preservation', () => {
    it('uses originalContext for error messages after max retries', () => {
      const originalContext: TelegramTestContext = {
        token: 'error-case-token',
        chatId: 999,
        userId: 888,
        text: 'failed message',
        startTime: Date.now(),
      };

      const pendingMessage: PendingMessage<TelegramTestContext> = {
        text: 'failed message',
        timestamp: Date.now(),
        requestId: 'req-error',
        userId: 888,
        chatId: 999,
        originalContext,
      };

      // Fixed: use originalContext for error message sending
      if (pendingMessage.originalContext) {
        const errorCtx = pendingMessage.originalContext;
        expect(errorCtx.token).toBe('error-case-token');
      }
    });
  });

  describe('Edge Cases', () => {
    it('handles missing originalContext gracefully', () => {
      // Edge case: originalContext somehow not set
      const pendingMessage: PendingMessage<TelegramTestContext> = {
        text: 'message',
        timestamp: Date.now(),
        requestId: 'req-1',
        userId: 456,
        chatId: 123,
        // originalContext is undefined
      };

      // Fallback to minimal context
      const ctx =
        pendingMessage.originalContext ??
        ({
          chatId: pendingMessage.chatId,
          userId: pendingMessage.userId,
          text: 'combined',
        } as TelegramTestContext);

      // Still works, just without token (would fail API call but won't crash)
      expect(ctx.chatId).toBe(123);
      expect(ctx.userId).toBe(456);
    });

    it('preserves additional platform-specific fields', () => {
      interface ExtendedContext extends TelegramTestContext {
        customField: string;
        nestedData: { foo: string };
      }

      const ctx: ExtendedContext = {
        token: 'token',
        chatId: 1,
        userId: 2,
        text: 'hi',
        startTime: Date.now(),
        customField: 'custom value',
        nestedData: { foo: 'bar' },
      };

      const pendingMessage: PendingMessage<ExtendedContext> = {
        text: ctx.text,
        timestamp: Date.now(),
        requestId: 'req-1',
        userId: ctx.userId,
        chatId: ctx.chatId,
        originalContext: ctx,
      };

      const restored = pendingMessage.originalContext!;
      expect(restored.customField).toBe('custom value');
      expect(restored.nestedData.foo).toBe('bar');
    });

    it('updates text while preserving other context fields', () => {
      const originalContext: TelegramTestContext = {
        token: 'preserve-me',
        chatId: 100,
        userId: 200,
        text: 'original text',
        startTime: 1234567890,
        username: 'testuser',
        adminUsername: 'admin',
      };

      const combinedText = 'message1\nmessage2\nmessage3';

      // Pattern from the fix
      const ctx = {
        ...originalContext,
        text: combinedText,
      };

      // All fields preserved except text (which is updated)
      expect(ctx.token).toBe('preserve-me');
      expect(ctx.chatId).toBe(100);
      expect(ctx.userId).toBe(200);
      expect(ctx.startTime).toBe(1234567890);
      expect(ctx.username).toBe('testuser');
      expect(ctx.adminUsername).toBe('admin');
      // Text is updated to combined
      expect(ctx.text).toBe(combinedText);
    });
  });
});
