/**
 * File System Storage
 *
 * Local file-based storage for sessions, tasks, and configuration
 * Similar to Claude Code's ~/.claude/ directory structure
 */

import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';

/**
 * Write options
 */
export interface WriteOptions {
  pretty?: boolean;
  atomic?: boolean;
}

/**
 * File system storage class
 * Manages local file-based persistence in ~/.duyetbot/
 */
export class FileSystemStorage {
  private basePath: string;

  constructor(basePath?: string) {
    // Default to ~/.duyetbot if no path specified
    this.basePath = basePath
      ? basePath.startsWith('~')
        ? join(homedir(), basePath.slice(1))
        : basePath
      : join(homedir(), '.duyetbot');

    // Initialize directory structure
    this.init();
  }

  /**
   * Initialize storage directory structure
   */
  private init(): void {
    // Create base directory
    if (!existsSync(this.basePath)) {
      mkdirSync(this.basePath, { recursive: true });
    }

    // Create subdirectories
    const subdirs = ['sessions', 'tasks', 'history', 'cache'];
    for (const dir of subdirs) {
      const dirPath = join(this.basePath, dir);
      if (!existsSync(dirPath)) {
        mkdirSync(dirPath, { recursive: true });
      }
    }
  }

  /**
   * Get base path
   */
  getBasePath(): string {
    return this.basePath;
  }

  /**
   * Get absolute path for a file
   */
  getPath(relativePath: string): string {
    return join(this.basePath, relativePath);
  }

  /**
   * Write JSON to file
   */
  async writeJSON(relativePath: string, data: unknown, options?: WriteOptions): Promise<void> {
    const filePath = this.getPath(relativePath);

    // Create directory if needed
    const dir = dirname(filePath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    // Serialize JSON
    const json = options?.pretty !== false ? JSON.stringify(data, null, 2) : JSON.stringify(data);

    // Atomic write: write to temp file, then rename
    if (options?.atomic !== false) {
      const tempPath = `${filePath}.tmp`;
      writeFileSync(tempPath, json, 'utf-8');
      // Rename is atomic on most filesystems
      rmSync(filePath, { force: true });
      writeFileSync(filePath, json, 'utf-8');
      rmSync(tempPath, { force: true });
    } else {
      writeFileSync(filePath, json, 'utf-8');
    }
  }

  /**
   * Read JSON from file
   */
  async readJSON<T = unknown>(relativePath: string): Promise<T> {
    const filePath = this.getPath(relativePath);
    const content = readFileSync(filePath, 'utf-8');
    return JSON.parse(content) as T;
  }

  /**
   * Write text to file
   */
  async writeText(relativePath: string, content: string): Promise<void> {
    const filePath = this.getPath(relativePath);

    // Create directory if needed
    const dir = dirname(filePath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    writeFileSync(filePath, content, 'utf-8');
  }

  /**
   * Read text from file
   */
  async readText(relativePath: string): Promise<string> {
    const filePath = this.getPath(relativePath);
    return readFileSync(filePath, 'utf-8');
  }

  /**
   * Append JSONL (JSON Lines) to file
   */
  async appendJSONL(relativePath: string, data: unknown): Promise<void> {
    const filePath = this.getPath(relativePath);

    // Create directory if needed
    const dir = dirname(filePath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    const line = `${JSON.stringify(data)}\n`;
    appendFileSync(filePath, line, 'utf-8');
  }

  /**
   * Check if file exists
   */
  async exists(relativePath: string): Promise<boolean> {
    const filePath = this.getPath(relativePath);
    return existsSync(filePath);
  }

  /**
   * Delete file
   */
  async delete(relativePath: string): Promise<void> {
    const filePath = this.getPath(relativePath);
    rmSync(filePath, { force: true });
  }

  /**
   * List files in directory
   */
  async list(relativePath: string): Promise<string[]> {
    const basePath = relativePath.split('*')[0];
    const dirPath = this.getPath(basePath || '');

    if (!existsSync(dirPath)) {
      return [];
    }

    try {
      return readdirSync(dirPath);
    } catch {
      return [];
    }
  }
}
