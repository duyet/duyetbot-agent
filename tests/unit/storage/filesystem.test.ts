import { FileSystemStorage } from '@/storage/filesystem';
import { existsSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

describe('FileSystemStorage', () => {
  let storage: FileSystemStorage;
  let testDir: string;

  beforeEach(() => {
    // Use temp directory for tests
    testDir = join(process.cwd(), '.test-storage');
    storage = new FileSystemStorage(testDir);
  });

  afterEach(() => {
    // Clean up test directory
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('initialization', () => {
    it('should create storage directory if it does not exist', () => {
      expect(existsSync(testDir)).toBe(true);
    });

    it('should create subdirectories', () => {
      expect(existsSync(join(testDir, 'sessions'))).toBe(true);
      expect(existsSync(join(testDir, 'tasks'))).toBe(true);
      expect(existsSync(join(testDir, 'history'))).toBe(true);
      expect(existsSync(join(testDir, 'cache'))).toBe(true);
    });

    it('should use default directory ~/.duyetbot when no path specified', () => {
      const defaultStorage = new FileSystemStorage();
      expect(defaultStorage.getBasePath()).toContain('.duyetbot');
    });

    it('should expand ~ to home directory', () => {
      const homeStorage = new FileSystemStorage('~/.duyetbot-test');
      expect(homeStorage.getBasePath()).not.toContain('~');
    });
  });

  describe('writeJSON', () => {
    it('should write JSON file', async () => {
      const data = { test: 'value', number: 42 };
      await storage.writeJSON('test.json', data);

      const filePath = join(testDir, 'test.json');
      expect(existsSync(filePath)).toBe(true);
    });

    it('should create nested directories', async () => {
      const data = { nested: true };
      await storage.writeJSON('deep/nested/file.json', data);

      const filePath = join(testDir, 'deep/nested/file.json');
      expect(existsSync(filePath)).toBe(true);
    });

    it('should write pretty JSON by default', async () => {
      const data = { a: 1, b: 2 };
      await storage.writeJSON('pretty.json', data);

      const content = await storage.readText('pretty.json');
      expect(content).toContain('\n');
      expect(content).toContain('  ');
    });

    it('should write compact JSON when specified', async () => {
      const data = { a: 1, b: 2 };
      await storage.writeJSON('compact.json', data, { pretty: false });

      const content = await storage.readText('compact.json');
      expect(content).not.toContain('\n  ');
    });

    it('should use atomic writes', async () => {
      const data = { atomic: true };
      await storage.writeJSON('atomic.json', data);

      // File should exist and be complete
      const read = await storage.readJSON('atomic.json');
      expect(read).toEqual(data);
    });
  });

  describe('readJSON', () => {
    it('should read JSON file', async () => {
      const data = { test: 'value' };
      await storage.writeJSON('read.json', data);

      const result = await storage.readJSON('read.json');
      expect(result).toEqual(data);
    });

    it('should throw error for non-existent file', async () => {
      await expect(storage.readJSON('missing.json')).rejects.toThrow();
    });

    it('should throw error for invalid JSON', async () => {
      await storage.writeText('invalid.json', 'not json');
      await expect(storage.readJSON('invalid.json')).rejects.toThrow();
    });
  });

  describe('writeText', () => {
    it('should write text file', async () => {
      await storage.writeText('text.txt', 'Hello, world!');

      const content = await storage.readText('text.txt');
      expect(content).toBe('Hello, world!');
    });
  });

  describe('appendJSONL', () => {
    it('should append JSONL line', async () => {
      await storage.appendJSONL('log.jsonl', { event: 'start' });
      await storage.appendJSONL('log.jsonl', { event: 'end' });

      const content = await storage.readText('log.jsonl');
      const lines = content.trim().split('\n');
      expect(lines).toHaveLength(2);
      expect(JSON.parse(lines[0])).toEqual({ event: 'start' });
      expect(JSON.parse(lines[1])).toEqual({ event: 'end' });
    });

    it('should create file if it does not exist', async () => {
      await storage.appendJSONL('new.jsonl', { first: true });

      const content = await storage.readText('new.jsonl');
      expect(content.trim()).toBe('{"first":true}');
    });
  });

  describe('exists', () => {
    it('should return true for existing file', async () => {
      await storage.writeJSON('exists.json', {});
      expect(await storage.exists('exists.json')).toBe(true);
    });

    it('should return false for non-existent file', async () => {
      expect(await storage.exists('missing.json')).toBe(false);
    });
  });

  describe('delete', () => {
    it('should delete existing file', async () => {
      await storage.writeJSON('delete-me.json', {});
      expect(await storage.exists('delete-me.json')).toBe(true);

      await storage.delete('delete-me.json');
      expect(await storage.exists('delete-me.json')).toBe(false);
    });

    it('should not throw for non-existent file', async () => {
      await expect(storage.delete('missing.json')).resolves.not.toThrow();
    });
  });

  describe('list', () => {
    beforeEach(async () => {
      await storage.writeJSON('sessions/session-1.json', {});
      await storage.writeJSON('sessions/session-2.json', {});
      await storage.writeJSON('sessions/session-3.json', {});
      await storage.writeJSON('other.json', {});
    });

    it('should list files in directory', async () => {
      const files = await storage.list('sessions');
      expect(files).toHaveLength(3);
      expect(files).toContain('session-1.json');
    });

    it('should support glob patterns', async () => {
      const files = await storage.list('sessions/*.json');
      expect(files.length).toBeGreaterThanOrEqual(3);
    });

    it('should return empty array for non-existent directory', async () => {
      const files = await storage.list('missing');
      expect(files).toEqual([]);
    });
  });

  describe('getPath', () => {
    it('should return absolute path', () => {
      const path = storage.getPath('test.json');
      expect(path).toContain(testDir);
      expect(path).toContain('test.json');
    });

    it('should handle nested paths', () => {
      const path = storage.getPath('deep/nested/file.json');
      expect(path).toContain('deep');
      expect(path).toContain('nested');
    });
  });
});
