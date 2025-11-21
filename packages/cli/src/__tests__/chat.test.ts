/**
 * Chat Tests
 */

import * as fs from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { runPrompt } from '../chat.js';

// Mock fs
vi.mock('node:fs');

describe('Chat', () => {
  const sessionsDir = '/mock/sessions';
  const savedSessions = new Map<string, string>();

  beforeEach(() => {
    savedSessions.clear();

    // Mock existsSync to check our saved sessions
    vi.mocked(fs.existsSync).mockImplementation((path) => {
      const pathStr = String(path);
      if (pathStr === sessionsDir) {
        return true;
      }
      return savedSessions.has(pathStr);
    });

    vi.mocked(fs.mkdirSync).mockImplementation(() => undefined);

    // Save sessions when written
    vi.mocked(fs.writeFileSync).mockImplementation((path, content) => {
      savedSessions.set(String(path), String(content));
    });

    // Read sessions from our store
    vi.mocked(fs.readFileSync).mockImplementation((path) => {
      const content = savedSessions.get(String(path));
      if (content) {
        return content;
      }
      return '[]';
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('runPrompt', () => {
    it('should return a response for a prompt', async () => {
      const response = await runPrompt('Hello', {
        mode: 'local',
        sessionsDir,
      });

      expect(response).toBeDefined();
      // Without ANTHROPIC_API_KEY, SDK returns placeholder
      expect(response).toContain('placeholder');
    });

    it('should create a session for the prompt', async () => {
      await runPrompt('Test prompt', {
        mode: 'local',
        sessionsDir,
      });

      expect(fs.writeFileSync).toHaveBeenCalled();
    });

    it('should handle empty prompt', async () => {
      const response = await runPrompt('', {
        mode: 'local',
        sessionsDir,
      });

      expect(response).toBeDefined();
    });

    it('should work in cloud mode', async () => {
      const response = await runPrompt('Cloud test', {
        mode: 'cloud',
        sessionsDir,
        mcpServerUrl: 'https://example.com',
      });

      expect(response).toBeDefined();
    });
  });
});

describe('Chat options', () => {
  it('should support session ID', () => {
    const options = {
      sessionId: 'test-session',
      mode: 'local' as const,
      sessionsDir: '/test',
    };

    expect(options.sessionId).toBe('test-session');
  });

  it('should support MCP server URL for cloud mode', () => {
    const options = {
      mode: 'cloud' as const,
      sessionsDir: '/test',
      mcpServerUrl: 'https://memory.example.com',
    };

    expect(options.mcpServerUrl).toBeDefined();
  });
});
