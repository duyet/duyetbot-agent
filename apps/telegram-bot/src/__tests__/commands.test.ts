/**
 * Commands Tests
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearCommand,
  helpCommand,
  sessionsCommand,
  startCommand,
  statusCommand,
} from '../commands/index.js';
import { TelegramSessionManager } from '../session-manager.js';

describe('startCommand', () => {
  it('should return welcome message', () => {
    const result = startCommand();

    expect(result.text).toContain('Welcome to @duyetbot');
    expect(result.text).toContain('/chat');
    expect(result.text).toContain('/help');
    expect(result.parseMode).toBe('Markdown');
  });
});

describe('helpCommand', () => {
  it('should return help message with all commands', () => {
    const result = helpCommand();

    expect(result.text).toContain('/start');
    expect(result.text).toContain('/chat');
    expect(result.text).toContain('/clear');
    expect(result.text).toContain('/status');
    expect(result.text).toContain('/help');
    expect(result.parseMode).toBe('Markdown');
  });
});

describe('statusCommand', () => {
  it('should return bot status', () => {
    const sessionManager = new TelegramSessionManager();
    const result = statusCommand(sessionManager);

    expect(result.text).toContain('Bot Status');
    expect(result.text).toContain('Online');
    expect(result.text).toContain('Active Sessions: 0');
    expect(result.text).toContain('Claude Sonnet');
    expect(result.parseMode).toBe('Markdown');
  });

  it('should show correct session count', async () => {
    const sessionManager = new TelegramSessionManager();

    // Create some sessions
    await sessionManager.getSession({ id: 1, firstName: 'A' }, 100);
    await sessionManager.getSession({ id: 2, firstName: 'B' }, 200);

    const result = statusCommand(sessionManager);
    expect(result.text).toContain('Active Sessions: 2');
  });
});

describe('clearCommand', () => {
  it('should clear session and return confirmation', async () => {
    const sessionManager = new TelegramSessionManager();

    // Create session with messages
    const user = { id: 123, firstName: 'Test' };
    const session = await sessionManager.getSession(user, 456);
    await sessionManager.appendMessage(session.sessionId, 'user', 'Hello');

    const result = await clearCommand(session.sessionId, sessionManager);

    expect(result.text).toContain('cleared');
    expect(session.messages).toHaveLength(0);
  });

  it('should handle non-existent session gracefully', async () => {
    const sessionManager = new TelegramSessionManager();
    const result = await clearCommand('nonexistent', sessionManager);

    // Should not throw, just return confirmation
    expect(result.text).toContain('cleared');
  });
});

describe('sessionsCommand', () => {
  it('should return session info', () => {
    const sessionId = 'telegram:123:456';
    const result = sessionsCommand(sessionId);

    expect(result.text).toContain('Current Session');
    expect(result.text).toContain(sessionId);
    expect(result.parseMode).toBe('Markdown');
  });
});
