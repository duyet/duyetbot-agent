import { describe, expect, it, vi } from 'vitest';
import type { CloudflareAgentState } from '../../cloudflare-agent.js';
import { handleBuiltinCommand } from '../../commands/builtin-commands.js';
import type { CommandContext } from '../../commands/types.js';

describe('Built-in Commands', () => {
  const mockState: CloudflareAgentState = {
    messages: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  const mockConfig = {
    welcomeMessage: 'Welcome!',
    helpMessage: 'Help info',
  };

  const createCtx = (overrides: Partial<CommandContext> = {}): CommandContext => ({
    isAdmin: false,
    state: mockState,
    setState: vi.fn(),
    config: mockConfig,
    ...overrides,
  });

  it('should handle /start', async () => {
    const ctx = createCtx();
    const result = await handleBuiltinCommand('/start', ctx);
    expect(result).toBe('Welcome!');
  });

  it('should handle /help', async () => {
    const ctx = createCtx();
    const result = await handleBuiltinCommand('/help', ctx);
    expect(result).toBe('Help info');
  });

  describe('/debug', () => {
    it('should deny access to non-admins', async () => {
      const ctx = createCtx({ isAdmin: false });
      const result = await handleBuiltinCommand('/debug', ctx);
      expect(result).toContain('denied');
    });

    it('should show info to admins (HTML)', async () => {
      const ctx = createCtx({ isAdmin: true, parseMode: 'HTML' });
      const result = await handleBuiltinCommand('/debug', ctx);
      expect(result).toContain('<b>Debug Information</b>');
      expect(result).toContain('Agent State:');
    });

    it('should show info to admins (Markdown)', async () => {
      const ctx = createCtx({ isAdmin: true, parseMode: 'MarkdownV2' });
      const result = await handleBuiltinCommand('/debug', ctx);
      expect(result).toContain('*Debug Information*');
    });
  });

  describe('/clear', () => {
    it('should reset state', async () => {
      const setState = vi.fn();
      const ctx = createCtx({
        setState,
        state: { ...mockState, messages: [{ role: 'user', content: 'hi' }] },
      });

      const result = await handleBuiltinCommand('/clear', ctx);
      expect(result).toContain('cleared');

      expect(setState).toHaveBeenCalled();
      const newState = setState.mock.calls[0][0];
      expect(newState.messages).toHaveLength(0);
    });

    it('should call clearMessages if provided', async () => {
      const setState = vi.fn();
      const clearMessages = vi.fn().mockResolvedValue(5);
      const ctx = createCtx({
        setState,
        clearMessages,
        state: { ...mockState, messages: [{ role: 'user', content: 'hi' }] },
      });

      const result = await handleBuiltinCommand('/clear', ctx);
      expect(result).toContain('cleared');
      expect(clearMessages).toHaveBeenCalledTimes(1);
    });

    it('should work without clearMessages callback', async () => {
      const setState = vi.fn();
      const ctx = createCtx({
        setState,
        clearMessages: undefined,
        state: { ...mockState, messages: [{ role: 'user', content: 'hi' }] },
      });

      const result = await handleBuiltinCommand('/clear', ctx);
      expect(result).toContain('cleared');
      expect(setState).toHaveBeenCalled();
    });
  });

  it('should return null for unknown commands', async () => {
    const ctx = createCtx();
    const result = await handleBuiltinCommand('/unknown', ctx);
    expect(result).toBeNull();
  });

  // ============================================
  // ADMIN DASHBOARD COMMANDS
  // ============================================

  describe('/status', () => {
    it('should deny access to non-admins', async () => {
      const ctx = createCtx({ isAdmin: false });
      const result = await handleBuiltinCommand('/status', ctx);
      expect(result).toContain('denied');
    });

    it('should show system status to admins (HTML)', async () => {
      const ctx = createCtx({
        isAdmin: true,
        parseMode: 'HTML',
        startedAt: Date.now() - 3600000, // 1 hour ago
      });
      const result = await handleBuiltinCommand('/status', ctx);
      expect(result).toContain('<b>System Status</b>');
      expect(result).toContain('Uptime');
      expect(result).toContain('Memory:');
      expect(result).toContain('Capabilities:');
      expect(result).toContain('Health:');
    });

    it('should show system status to admins (Markdown)', async () => {
      const ctx = createCtx({ isAdmin: true, parseMode: 'MarkdownV2' });
      const result = await handleBuiltinCommand('/status', ctx);
      expect(result).toContain('*System Status*');
    });

    it('should show healthy status when no workflows active', async () => {
      const ctx = createCtx({
        isAdmin: true,
        parseMode: 'HTML',
        state: { ...mockState, activeWorkflows: {} },
      });
      const result = await handleBuiltinCommand('/status', ctx);
      expect(result).toContain('✅ Healthy');
    });

    it('should show warning when workflows are active', async () => {
      const ctx = createCtx({
        isAdmin: true,
        parseMode: 'HTML',
        state: { ...mockState, activeWorkflows: { test: {} } },
      });
      const result = await handleBuiltinCommand('/status', ctx);
      expect(result).toContain('⚠️ Active workflows');
    });
  });

  describe('/agents', () => {
    it('should deny access to non-admins', async () => {
      const ctx = createCtx({ isAdmin: false });
      const result = await handleBuiltinCommand('/agents', ctx);
      expect(result).toContain('denied');
    });

    it('should list agents to admins', async () => {
      const ctx = createCtx({ isAdmin: true, parseMode: 'HTML' });
      const result = await handleBuiltinCommand('/agents', ctx);
      expect(result).toContain('Agent Registry');
      expect(result).toContain('telegram-bot');
      expect(result).toContain('github-bot');
      expect(result).toContain('memory-mcp');
    });
  });

  describe('/tasks', () => {
    it('should deny access to non-admins', async () => {
      const ctx = createCtx({ isAdmin: false });
      const result = await handleBuiltinCommand('/tasks', ctx);
      expect(result).toContain('denied');
    });

    it('should show empty queue when no tasks', async () => {
      const ctx = createCtx({
        isAdmin: true,
        parseMode: 'HTML',
        state: { ...mockState, activeWorkflows: {} },
      });
      const result = await handleBuiltinCommand('/tasks', ctx);
      expect(result).toContain('Task Queue');
      expect(result).toContain('No active tasks');
    });

    it('should show active tasks when present', async () => {
      const ctx = createCtx({
        isAdmin: true,
        parseMode: 'HTML',
        state: {
          ...mockState,
          activeWorkflows: {
            'task-1': { status: 'running', startedAt: Date.now() - 60000 },
          },
        },
      });
      const result = await handleBuiltinCommand('/tasks', ctx);
      expect(result).toContain('Active Tasks');
      expect(result).toContain('task-1');
      expect(result).toContain('running');
    });
  });

  describe('/metrics', () => {
    it('should deny access to non-admins', async () => {
      const ctx = createCtx({ isAdmin: false });
      const result = await handleBuiltinCommand('/metrics', ctx);
      expect(result).toContain('denied');
    });

    it('should show metrics to admins', async () => {
      const ctx = createCtx({
        isAdmin: true,
        parseMode: 'HTML',
        state: {
          ...mockState,
          messages: [
            { role: 'user', content: 'Hello world' },
            { role: 'assistant', content: 'Hi there!' },
          ],
        },
      });
      const result = await handleBuiltinCommand('/metrics', ctx);
      expect(result).toContain('Usage Metrics');
      expect(result).toContain('Current Session:');
      expect(result).toContain('Messages: 2');
      expect(result).toContain('Est. tokens');
      expect(result).toContain('Limits:');
    });

    it('should show D1 not configured when env missing', async () => {
      const ctx = createCtx({ isAdmin: true, parseMode: 'HTML' });
      const result = await handleBuiltinCommand('/metrics', ctx);
      expect(result).toContain('D1 Metrics');
      expect(result).toContain('not configured');
    });
  });

  describe('/admin', () => {
    it('should deny access to non-admins', async () => {
      const ctx = createCtx({ isAdmin: false });
      const result = await handleBuiltinCommand('/admin', ctx);
      expect(result).toContain('denied');
    });

    it('should show admin help to admins', async () => {
      const ctx = createCtx({ isAdmin: true, parseMode: 'HTML' });
      const result = await handleBuiltinCommand('/admin', ctx);
      expect(result).toContain('Admin Commands');
      expect(result).toContain('/status');
      expect(result).toContain('/agents');
      expect(result).toContain('/tasks');
      expect(result).toContain('/events');
      expect(result).toContain('/metrics');
      expect(result).toContain('/debug');
      expect(result).toContain('Coming Soon');
    });
  });

  describe('/events', () => {
    it('should deny access to non-admins', async () => {
      const ctx = createCtx({ isAdmin: false });
      const result = await handleBuiltinCommand('/events', ctx);
      expect(result).toContain('denied');
    });

    it('should show unavailable message when D1 not configured', async () => {
      const ctx = createCtx({ isAdmin: true, parseMode: 'HTML' });
      // No OBSERVABILITY_DB in env
      const result = await handleBuiltinCommand('/events', ctx);
      expect(result).toContain('Event Bridge');
      expect(result).toContain('not available');
    });

    it('should show event stats when D1 is available', async () => {
      // Create a mock D1 database
      const mockDb = {
        prepare: vi.fn().mockReturnValue({
          bind: vi.fn().mockReturnThis(),
          first: vi.fn().mockResolvedValue({ count: 0, current_value: 0 }),
          all: vi.fn().mockResolvedValue({ results: [] }),
          run: vi.fn().mockResolvedValue({ success: true }),
        }),
        batch: vi.fn().mockResolvedValue([]),
      };

      const ctx = createCtx({
        isAdmin: true,
        parseMode: 'HTML',
        env: { OBSERVABILITY_DB: mockDb as unknown as D1Database },
      });

      const result = await handleBuiltinCommand('/events', ctx);
      expect(result).toContain('Event Bridge');
      expect(result).toContain('Statistics');
      expect(result).toContain('Total events');
    });
  });

  describe('/notifications', () => {
    it('should deny access to non-admins', async () => {
      const ctx = createCtx({ isAdmin: false });
      const result = await handleBuiltinCommand('/notifications', ctx);
      expect(result).toContain('denied');
    });

    it('should show unavailable message when D1 not configured', async () => {
      const ctx = createCtx({ isAdmin: true, parseMode: 'HTML' });
      const result = await handleBuiltinCommand('/notifications', ctx);
      expect(result).toContain('Notification Settings');
      expect(result).toContain('not available');
    });

    it('should show default settings when no preferences saved', async () => {
      // Mock D1 that returns no results (table doesn't exist)
      const mockDb = {
        prepare: vi.fn().mockReturnValue({
          bind: vi.fn().mockReturnThis(),
          first: vi.fn().mockRejectedValue(new Error('no such table')),
          run: vi.fn().mockResolvedValue({ success: true }),
        }),
      };

      const ctx = createCtx({
        isAdmin: true,
        parseMode: 'HTML',
        env: { OBSERVABILITY_DB: mockDb as unknown as D1Database },
      });

      const result = await handleBuiltinCommand('/notifications', ctx);
      expect(result).toContain('Notification Settings');
      expect(result).toContain('Not yet configured');
    });

    it('should show current settings when preferences exist', async () => {
      const mockDb = {
        prepare: vi.fn().mockReturnValue({
          bind: vi.fn().mockReturnThis(),
          first: vi.fn().mockResolvedValue({
            enabled: 1,
            min_priority: 'high',
            categories: '["github","task"]',
            last_sequence: 42,
          }),
          run: vi.fn().mockResolvedValue({ success: true }),
        }),
      };

      const ctx = createCtx({
        isAdmin: true,
        parseMode: 'HTML',
        env: { OBSERVABILITY_DB: mockDb as unknown as D1Database },
      });

      const result = await handleBuiltinCommand('/notifications', ctx);
      expect(result).toContain('Current Settings');
      expect(result).toContain('Enabled');
      expect(result).toContain('high');
    });

    it('should handle /notifications on subcommand', async () => {
      const mockDb = {
        prepare: vi.fn().mockReturnValue({
          bind: vi.fn().mockReturnThis(),
          first: vi.fn().mockResolvedValue(null),
          run: vi.fn().mockResolvedValue({ success: true }),
        }),
      };

      const ctx = createCtx({
        isAdmin: true,
        parseMode: 'HTML',
        env: { OBSERVABILITY_DB: mockDb as unknown as D1Database },
      });

      const result = await handleBuiltinCommand('/notifications on', ctx);
      expect(result).toContain('enabled');
    });

    it('should handle /notifications off subcommand', async () => {
      const mockDb = {
        prepare: vi.fn().mockReturnValue({
          bind: vi.fn().mockReturnThis(),
          first: vi.fn().mockResolvedValue(null),
          run: vi.fn().mockResolvedValue({ success: true }),
        }),
      };

      const ctx = createCtx({
        isAdmin: true,
        parseMode: 'HTML',
        env: { OBSERVABILITY_DB: mockDb as unknown as D1Database },
      });

      const result = await handleBuiltinCommand('/notifications off', ctx);
      expect(result).toContain('disabled');
    });
  });
});
