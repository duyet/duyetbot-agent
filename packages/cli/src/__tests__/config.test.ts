/**
 * CLI Config Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { CLIConfig, getDefaultConfig, loadConfig, saveConfig } from '../config.js';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

// Mock fs and os
vi.mock('node:fs');
vi.mock('node:os');

describe('CLIConfig', () => {
  const mockHomeDir = '/mock/home';
  const configDir = path.join(mockHomeDir, '.duyetbot');
  const configPath = path.join(configDir, 'config.json');

  beforeEach(() => {
    vi.mocked(os.homedir).mockReturnValue(mockHomeDir);
    vi.mocked(fs.existsSync).mockReturnValue(false);
    vi.mocked(fs.mkdirSync).mockImplementation(() => undefined);
    vi.mocked(fs.writeFileSync).mockImplementation(() => undefined);
    vi.mocked(fs.readFileSync).mockReturnValue('{}');
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('getDefaultConfig', () => {
    it('should return default configuration', () => {
      const config = getDefaultConfig();

      expect(config).toBeDefined();
      expect(config.defaultProvider).toBe('claude');
      expect(config.mcpServerUrl).toBeUndefined();
      expect(config.providers).toEqual({});
    });

    it('should have correct default values', () => {
      const config = getDefaultConfig();

      expect(config.mode).toBe('local');
      expect(config.sessionsDir).toContain('.duyetbot/sessions');
    });
  });

  describe('loadConfig', () => {
    it('should return default config if file does not exist', () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);

      const config = loadConfig();

      expect(config).toEqual(getDefaultConfig());
    });

    it('should load config from file if exists', () => {
      const savedConfig: CLIConfig = {
        ...getDefaultConfig(),
        defaultProvider: 'openai',
        mode: 'cloud',
      };

      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(savedConfig));

      const config = loadConfig();

      expect(config.defaultProvider).toBe('openai');
      expect(config.mode).toBe('cloud');
    });

    it('should merge with defaults for missing fields', () => {
      const partialConfig = { defaultProvider: 'openai' };

      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(partialConfig));

      const config = loadConfig();

      expect(config.defaultProvider).toBe('openai');
      expect(config.mode).toBe('local'); // from defaults
    });

    it('should handle invalid JSON gracefully', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue('invalid json');

      const config = loadConfig();

      expect(config).toEqual(getDefaultConfig());
    });
  });

  describe('saveConfig', () => {
    it('should create config directory if not exists', () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);

      const config = getDefaultConfig();
      saveConfig(config);

      expect(fs.mkdirSync).toHaveBeenCalledWith(configDir, { recursive: true });
    });

    it('should write config to file', () => {
      const config: CLIConfig = {
        ...getDefaultConfig(),
        defaultProvider: 'openai',
      };

      saveConfig(config);

      expect(fs.writeFileSync).toHaveBeenCalledWith(
        configPath,
        JSON.stringify(config, null, 2)
      );
    });

    it('should not recreate directory if exists', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);

      const config = getDefaultConfig();
      saveConfig(config);

      expect(fs.mkdirSync).not.toHaveBeenCalled();
    });
  });
});

describe('CLIConfig types', () => {
  it('should support provider configuration', () => {
    const config: CLIConfig = {
      defaultProvider: 'zai',
      mode: 'cloud',
      mcpServerUrl: 'https://memory.example.com',
      sessionsDir: '/custom/sessions',
      providers: {
        zai: {
          type: 'anthropic',
          apiKey: 'test-key',
          baseUrl: 'https://api.z.ai',
        },
      },
    };

    expect(config.providers.zai).toBeDefined();
    expect(config.providers.zai?.baseUrl).toBe('https://api.z.ai');
  });

  it('should support auth token storage', () => {
    const config: CLIConfig = {
      ...getDefaultConfig(),
      auth: {
        githubToken: 'ghp_xxxxx',
        sessionToken: 'session-token',
        expiresAt: Date.now() + 3600000,
      },
    };

    expect(config.auth?.githubToken).toBe('ghp_xxxxx');
  });
});
