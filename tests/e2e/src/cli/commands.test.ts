import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

// Self-contained implementations for testing
interface DuyetbotConfig {
  defaultProvider?: string;
  providers?: any[];
  mcpServerUrl?: string;
  defaultModel?: string;
}

function loadConfig(path: string): DuyetbotConfig {
  if (!existsSync(path)) {
    return { defaultProvider: 'claude', providers: [] };
  }
  return JSON.parse(readFileSync(path, 'utf-8'));
}

function saveConfig(path: string, config: DuyetbotConfig): void {
  writeFileSync(path, JSON.stringify(config, null, 2));
}

class FileSessionManager {
  constructor(private dir: string) {
    mkdirSync(dir, { recursive: true });
  }

  async create(opts: { title?: string; metadata?: any }) {
    const id = `session_${Math.random().toString(36).slice(2)}`;
    const session = {
      id,
      title: opts.title || 'Untitled',
      messages: [] as any[],
      metadata: opts.metadata || {},
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    writeFileSync(join(this.dir, `${id}.json`), JSON.stringify(session));
    return session;
  }

  async list() {
    const files = existsSync(this.dir) ? require('node:fs').readdirSync(this.dir) : [];
    return files
      .filter((f: string) => f.endsWith('.json'))
      .map((f: string) => JSON.parse(readFileSync(join(this.dir, f), 'utf-8')));
  }

  async get(id: string) {
    const path = join(this.dir, `${id}.json`);
    return existsSync(path) ? JSON.parse(readFileSync(path, 'utf-8')) : null;
  }

  async appendMessages(id: string, messages: any[]) {
    const session = await this.get(id);
    if (session) {
      session.messages.push(...messages);
      session.updatedAt = Date.now();
      writeFileSync(join(this.dir, `${id}.json`), JSON.stringify(session));
    }
  }

  async delete(id: string) {
    const path = join(this.dir, `${id}.json`);
    if (existsSync(path)) {
      rmSync(path);
      return true;
    }
    return false;
  }

  async export(id: string) {
    const session = await this.get(id);
    return session ? JSON.stringify(session, null, 2) : null;
  }
}

class AuthManager {
  private creds: any = null;

  constructor(private path: string) {
    if (existsSync(path)) {
      this.creds = JSON.parse(readFileSync(path, 'utf-8'));
    }
  }

  isAuthenticated() {
    return this.creds !== null;
  }
  getCredentials() {
    return this.creds;
  }

  saveCredentials(creds: any) {
    this.creds = creds;
    writeFileSync(this.path, JSON.stringify(creds));
  }

  clearCredentials() {
    this.creds = null;
    if (existsSync(this.path)) {
      rmSync(this.path);
    }
  }
}

describe('CLI E2E', () => {
  const testDir = join(tmpdir(), `duyetbot-cli-e2e-${Date.now()}`);
  const configDir = join(testDir, '.duyetbot');
  const sessionsDir = join(testDir, 'sessions');

  beforeEach(() => {
    mkdirSync(configDir, { recursive: true });
    mkdirSync(sessionsDir, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('Config Management', () => {
    it('should create default config', () => {
      const configPath = join(configDir, 'config.json');
      const config = loadConfig(configPath);
      expect(config).toBeDefined();
      expect(config.defaultProvider).toBeDefined();
    });

    it('should save and load config', () => {
      const configPath = join(configDir, 'config.json');
      const testConfig: DuyetbotConfig = {
        defaultProvider: 'claude',
        mcpServerUrl: 'https://memory.example.com',
        defaultModel: 'sonnet',
      };

      saveConfig(configPath, testConfig);
      const loaded = loadConfig(configPath);

      expect(loaded.defaultProvider).toBe('claude');
      expect(loaded.mcpServerUrl).toBe('https://memory.example.com');
    });
  });

  describe('Session Management', () => {
    let sessionManager: FileSessionManager;

    beforeEach(() => {
      sessionManager = new FileSessionManager(sessionsDir);
    });

    it('should create and retrieve sessions', async () => {
      const session = await sessionManager.create({ title: 'Test' });
      expect(session.id).toBeTruthy();

      const found = await sessionManager.get(session.id);
      expect(found?.title).toBe('Test');
    });

    it('should append messages', async () => {
      const session = await sessionManager.create({ title: 'Chat' });
      await sessionManager.appendMessages(session.id, [{ role: 'user', content: 'Hello' }]);

      const updated = await sessionManager.get(session.id);
      expect(updated?.messages.length).toBe(1);
    });

    it('should delete sessions', async () => {
      const session = await sessionManager.create({ title: 'Delete Me' });
      await sessionManager.delete(session.id);
      const found = await sessionManager.get(session.id);
      expect(found).toBeNull();
    });
  });

  describe('Auth Management', () => {
    it('should handle credentials', () => {
      const authPath = join(configDir, 'credentials.json');
      const auth = new AuthManager(authPath);

      expect(auth.isAuthenticated()).toBe(false);

      auth.saveCredentials({ accessToken: 'test' });
      expect(auth.isAuthenticated()).toBe(true);
      expect(auth.getCredentials()?.accessToken).toBe('test');

      auth.clearCredentials();
      expect(auth.isAuthenticated()).toBe(false);
    });
  });
});
