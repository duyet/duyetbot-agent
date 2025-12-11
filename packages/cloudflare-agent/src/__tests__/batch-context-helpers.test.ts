/**
 * Tests for batch context helpers
 *
 * These helpers consolidate context extraction and transformation
 * patterns used throughout the message processing pipeline.
 */

import { describe, expect, it } from 'vitest';
import type { PendingMessage } from '../batch-types.js';
import {
  buildContextFromBatch,
  buildResponseTarget,
  extractAdminContext,
  extractMessageMetadata,
} from '../context/batch-context-helpers.js';

describe('extractAdminContext', () => {
  it('extracts admin context from message with all fields', () => {
    const message: PendingMessage<unknown> = {
      text: 'test',
      timestamp: Date.now(),
      requestId: 'req-1',
      isAdmin: true,
      adminUsername: 'admin_user',
      username: 'test_user',
    };

    const result = extractAdminContext({ message });

    expect(result.isAdmin).toBe(true);
    expect(result.adminUsername).toBe('admin_user');
    expect(result.username).toBe('test_user');
  });

  it('applies priority chain: ctx > message > env for adminUsername', () => {
    const ctx = { adminUsername: 'ctx_admin' };
    const message: PendingMessage<unknown> = {
      text: 'test',
      timestamp: Date.now(),
      requestId: 'req-1',
      adminUsername: 'msg_admin',
    };
    const env = { ADMIN_USERNAME: 'env_admin' };

    // ctx takes priority
    expect(extractAdminContext({ ctx, message, env }).adminUsername).toBe('ctx_admin');

    // message takes priority when ctx is missing
    expect(extractAdminContext({ message, env }).adminUsername).toBe('msg_admin');

    // env is fallback
    expect(extractAdminContext({ env }).adminUsername).toBe('env_admin');
  });

  it('applies priority chain: ctx > message for username', () => {
    const ctx = { username: 'ctx_user' };
    const message: PendingMessage<unknown> = {
      text: 'test',
      timestamp: Date.now(),
      requestId: 'req-1',
      username: 'msg_user',
    };

    // ctx takes priority
    expect(extractAdminContext({ ctx, message }).username).toBe('ctx_user');

    // message is fallback
    expect(extractAdminContext({ message }).username).toBe('msg_user');
  });

  it('applies priority chain: message > ctx for isAdmin', () => {
    const ctxTrue = { isAdmin: true };
    const ctxFalse = { isAdmin: false };
    const messageTrue: PendingMessage<unknown> = {
      text: 'test',
      timestamp: Date.now(),
      requestId: 'req-1',
      isAdmin: true,
    };
    const messageFalse: PendingMessage<unknown> = {
      text: 'test',
      timestamp: Date.now(),
      requestId: 'req-1',
      isAdmin: false,
    };

    // message takes priority
    expect(extractAdminContext({ ctx: ctxTrue, message: messageFalse }).isAdmin).toBe(false);
    expect(extractAdminContext({ ctx: ctxFalse, message: messageTrue }).isAdmin).toBe(true);

    // ctx is fallback
    expect(extractAdminContext({ ctx: ctxTrue }).isAdmin).toBe(true);
  });

  it('defaults isAdmin to false when not provided', () => {
    expect(extractAdminContext({}).isAdmin).toBe(false);
  });
});

describe('extractMessageMetadata', () => {
  it('extracts all metadata fields', () => {
    const metadata = {
      eventId: 'evt-123',
      isAdmin: true,
      adminUsername: 'admin',
      requestId: 'req-456',
      traceId: 'trace-789',
      platform: 'telegram',
    };

    const result = extractMessageMetadata(metadata);

    expect(result.eventId).toBe('evt-123');
    expect(result.isAdmin).toBe(true);
    expect(result.adminUsername).toBe('admin');
    expect(result.requestId).toBe('req-456');
    expect(result.traceId).toBe('trace-789');
    expect(result.platform).toBe('telegram');
  });

  it('returns undefined for missing fields', () => {
    const result = extractMessageMetadata({});

    expect(result.eventId).toBeUndefined();
    expect(result.isAdmin).toBeUndefined();
    expect(result.adminUsername).toBeUndefined();
  });

  it('returns all undefined for undefined metadata', () => {
    const result = extractMessageMetadata(undefined);

    expect(result.eventId).toBeUndefined();
    expect(result.isAdmin).toBeUndefined();
    expect(result.adminUsername).toBeUndefined();
    expect(result.requestId).toBeUndefined();
    expect(result.traceId).toBeUndefined();
    expect(result.platform).toBeUndefined();
  });
});

describe('buildContextFromBatch', () => {
  it('builds context from firstMessage with originalContext', () => {
    const originalContext = {
      token: 'original-token',
      chatId: 123,
      userId: 456,
      text: 'original text',
      customField: 'preserved',
    };

    const firstMessage: PendingMessage<typeof originalContext> = {
      text: 'message text',
      timestamp: Date.now(),
      requestId: 'req-1',
      chatId: 123,
      userId: 456,
      username: 'user',
      originalContext,
    };

    const result = buildContextFromBatch({
      firstMessage,
      text: 'combined text',
      env: { TELEGRAM_BOT_TOKEN: 'new-token' },
      platform: 'telegram',
    });

    // Should preserve originalContext fields
    expect(result.customField).toBe('preserved');
    // Should override text with combined text
    expect(result.text).toBe('combined text');
    // Should inject platform secrets
    expect(result.token).toBe('new-token');
  });

  it('creates fallback context when originalContext is missing', () => {
    const firstMessage: PendingMessage<unknown> = {
      text: 'message text',
      timestamp: Date.now(),
      requestId: 'req-1',
      chatId: 123,
      userId: 456,
      username: 'user',
    };

    const result = buildContextFromBatch({
      firstMessage,
      text: 'combined text',
      env: {},
      batchId: 'batch-123',
    }) as Record<string, unknown>;

    expect(result.chatId).toBe(123);
    expect(result.userId).toBe(456);
    expect(result.text).toBe('combined text');
    expect(result.username).toBe('user');
    expect((result.metadata as Record<string, unknown>)?.requestId).toBe('batch-123');
  });

  it('injects telegram token when platform is telegram', () => {
    const firstMessage: PendingMessage<unknown> = {
      text: 'test',
      timestamp: Date.now(),
      requestId: 'req-1',
    };

    const result = buildContextFromBatch({
      firstMessage,
      text: 'test',
      env: { TELEGRAM_BOT_TOKEN: 'bot-token' },
      platform: 'telegram',
    }) as Record<string, unknown>;

    expect(result.token).toBe('bot-token');
  });

  it('injects github token when platform is github', () => {
    const firstMessage: PendingMessage<unknown> = {
      text: 'test',
      timestamp: Date.now(),
      requestId: 'req-1',
    };

    const result = buildContextFromBatch({
      firstMessage,
      text: 'test',
      env: { GITHUB_TOKEN: 'gh-token' },
      platform: 'github',
    }) as Record<string, unknown>;

    expect(result.githubToken).toBe('gh-token');
  });
});

describe('buildResponseTarget', () => {
  it('builds response target for telegram platform', () => {
    const ctx = { adminUsername: 'admin', username: 'user' };
    const firstMessage: PendingMessage<typeof ctx> = {
      text: 'test',
      timestamp: Date.now(),
      requestId: 'req-1',
      chatId: 12345,
    };

    const result = buildResponseTarget({
      ctx,
      firstMessage,
      messageId: 999,
      platform: 'telegram',
      env: { TELEGRAM_BOT_TOKEN: 'bot-token', ADMIN_USERNAME: 'env_admin' },
    });

    expect(result.chatId).toBe('12345');
    expect(result.messageRef.messageId).toBe(999);
    expect(result.platform).toBe('telegram');
    expect(result.botToken).toBe('bot-token');
    expect(result.adminUsername).toBe('admin'); // from ctx
    expect(result.username).toBe('user'); // from ctx
  });

  it('builds response target for github platform', () => {
    const ctx = {
      owner: 'test-owner',
      repo: 'test-repo',
      issueNumber: 42,
      githubToken: 'ctx-gh-token',
    };
    const firstMessage: PendingMessage<typeof ctx> = {
      text: 'test',
      timestamp: Date.now(),
      requestId: 'req-1',
      chatId: 'owner/repo#42',
      username: 'github_user',
      adminUsername: 'msg_admin',
    };

    const result = buildResponseTarget({
      ctx,
      firstMessage,
      messageId: 123,
      platform: 'github',
      env: { GITHUB_TOKEN: 'env-gh-token' },
    });

    expect(result.platform).toBe('github');
    expect(result.githubOwner).toBe('test-owner');
    expect(result.githubRepo).toBe('test-repo');
    expect(result.githubIssueNumber).toBe(42);
    expect(result.githubToken).toBe('ctx-gh-token'); // ctx takes priority
    expect(result.adminUsername).toBe('msg_admin'); // from message since ctx doesn't have it
    expect(result.username).toBe('github_user'); // from message
  });

  it('falls back to env github token when ctx token is missing', () => {
    const ctx = { owner: 'owner', repo: 'repo', issueNumber: 1 };
    const firstMessage: PendingMessage<typeof ctx> = {
      text: 'test',
      timestamp: Date.now(),
      requestId: 'req-1',
      chatId: '123',
    };

    const result = buildResponseTarget({
      ctx,
      firstMessage,
      messageId: 1,
      platform: 'github',
      env: { GITHUB_TOKEN: 'env-token' },
    });

    expect(result.githubToken).toBe('env-token');
  });

  it('uses admin context priority chain', () => {
    const firstMessage: PendingMessage<unknown> = {
      text: 'test',
      timestamp: Date.now(),
      requestId: 'req-1',
      chatId: '123',
      adminUsername: 'msg_admin',
    };

    const result = buildResponseTarget({
      ctx: {},
      firstMessage,
      messageId: 1,
      platform: 'telegram',
      env: { ADMIN_USERNAME: 'env_admin' },
    });

    // Message takes priority over env
    expect(result.adminUsername).toBe('msg_admin');
  });
});
