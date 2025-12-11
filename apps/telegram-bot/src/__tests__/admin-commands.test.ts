/**
 * Tests for slash command handlers
 */

import { describe, expect, it, vi } from 'vitest';
import {
  handleClearCommand,
  handleDebugCommand,
  handleHelpCommand,
  handleSlashCommand,
  handleStartCommand,
  handleStatusCommand,
} from '../commands/admin.js';
import type { TelegramContext } from '../transport.js';

// Mock context factory
function createMockContext(overrides: Partial<TelegramContext> = {}): TelegramContext {
  return {
    token: 'test-token',
    chatId: 12345,
    userId: 67890,
    text: '/test',
    messageId: 1,
    isAdmin: false,
    requestId: 'test-request-id',
    startTime: Date.now(),
    parseMode: 'HTML',
    ...overrides,
  } as TelegramContext;
}

// Mock agent stub
function createMockAgent(response: string | null = 'mock response') {
  return {
    handleBuiltinCommand: vi.fn().mockResolvedValue(response),
  };
}

describe('slash command handlers', () => {
  describe('handleStartCommand', () => {
    it('returns welcome message', () => {
      const result = handleStartCommand();
      expect(result).toContain('Hello!');
      expect(result).toContain('/help');
    });
  });

  describe('handleHelpCommand', () => {
    it('returns help message with all commands', () => {
      const result = handleHelpCommand();
      expect(result).toContain('/start');
      expect(result).toContain('/help');
      expect(result).toContain('/clear');
      expect(result).toContain('/debug');
      expect(result).toContain('/status');
    });
  });

  describe('handleStatusCommand', () => {
    it('returns status for admin', async () => {
      const ctx = createMockContext({ isAdmin: true });
      const result = await handleStatusCommand(ctx);
      expect(result).toContain('System Status');
      expect(result).toContain('operational');
    });

    it('returns access denied for non-admin', async () => {
      const ctx = createMockContext({ isAdmin: false });
      const result = await handleStatusCommand(ctx);
      expect(result).toContain('Admin command - access denied');
    });
  });

  describe('handleDebugCommand', () => {
    it('calls agent RPC for admin', async () => {
      const ctx = createMockContext({ isAdmin: true, username: 'admin' });
      const agent = createMockAgent('debug info');
      const result = await handleDebugCommand(ctx, agent);

      expect(agent.handleBuiltinCommand).toHaveBeenCalledWith('/debug', {
        isAdmin: true,
        username: 'admin',
        parseMode: 'HTML',
      });
      expect(result).toBe('debug info');
    });

    it('returns access denied for non-admin', async () => {
      const ctx = createMockContext({ isAdmin: false });
      const agent = createMockAgent();
      const result = await handleDebugCommand(ctx, agent);

      expect(agent.handleBuiltinCommand).not.toHaveBeenCalled();
      expect(result).toContain('Admin command - access denied');
    });

    it('handles RPC error gracefully', async () => {
      const ctx = createMockContext({ isAdmin: true });
      const agent = {
        handleBuiltinCommand: vi.fn().mockRejectedValue(new Error('RPC failed')),
      };
      const result = await handleDebugCommand(ctx, agent);

      expect(result).toContain('Debug command failed');
      expect(result).toContain('RPC failed');
    });
  });

  describe('handleClearCommand', () => {
    it('calls agent RPC for admin', async () => {
      const ctx = createMockContext({ isAdmin: true, username: 'admin' });
      const agent = createMockAgent('cleared');
      const result = await handleClearCommand(ctx, agent);

      expect(agent.handleBuiltinCommand).toHaveBeenCalledWith('/clear', {
        isAdmin: true,
        username: 'admin',
        parseMode: 'HTML',
      });
      expect(result).toBe('cleared');
    });

    it('returns access denied for non-admin', async () => {
      const ctx = createMockContext({ isAdmin: false });
      const agent = createMockAgent();
      const result = await handleClearCommand(ctx, agent);

      expect(agent.handleBuiltinCommand).not.toHaveBeenCalled();
      expect(result).toContain('Admin command - access denied');
    });
  });

  describe('handleSlashCommand', () => {
    it('handles /start without agent', async () => {
      const ctx = createMockContext({ text: '/start' });
      const result = await handleSlashCommand('/start', ctx);

      expect(result).toContain('Hello!');
    });

    it('handles /help without agent', async () => {
      const ctx = createMockContext({ text: '/help' });
      const result = await handleSlashCommand('/help', ctx);

      expect(result).toContain('/start');
    });

    it('handles /status without agent', async () => {
      const ctx = createMockContext({ text: '/status', isAdmin: true });
      const result = await handleSlashCommand('/status', ctx);

      expect(result).toContain('System Status');
    });

    it('handles /debug with agent', async () => {
      const ctx = createMockContext({ text: '/debug', isAdmin: true });
      const agent = createMockAgent('debug output');
      const result = await handleSlashCommand('/debug', ctx, agent);

      expect(result).toBe('debug output');
    });

    it('returns error for /debug without agent', async () => {
      const ctx = createMockContext({ text: '/debug', isAdmin: true });
      const result = await handleSlashCommand('/debug', ctx);

      expect(result).toContain('Debug command unavailable');
    });

    it('handles /clear with agent', async () => {
      const ctx = createMockContext({ text: '/clear', isAdmin: true });
      const agent = createMockAgent('cleared');
      const result = await handleSlashCommand('/clear', ctx, agent);

      expect(result).toBe('cleared');
    });

    it('returns error for /clear without agent', async () => {
      const ctx = createMockContext({ text: '/clear', isAdmin: true });
      const result = await handleSlashCommand('/clear', ctx);

      expect(result).toContain('Clear command unavailable');
    });

    it('returns undefined for unknown commands', async () => {
      const ctx = createMockContext({ text: '/unknown' });
      const result = await handleSlashCommand('/unknown', ctx);

      expect(result).toBeUndefined();
    });

    it('handles command with arguments', async () => {
      const ctx = createMockContext({ text: '/start some args' });
      const result = await handleSlashCommand('/start some args', ctx);

      expect(result).toContain('Hello!');
    });

    it('is case insensitive', async () => {
      const ctx = createMockContext({ text: '/START' });
      const result = await handleSlashCommand('/START', ctx);

      expect(result).toContain('Hello!');
    });
  });
});
