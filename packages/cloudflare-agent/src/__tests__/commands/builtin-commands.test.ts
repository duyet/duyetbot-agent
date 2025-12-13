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
  });

  it('should return null for unknown commands', async () => {
    const ctx = createCtx();
    const result = await handleBuiltinCommand('/unknown', ctx);
    expect(result).toBeNull();
  });
});
