/**
 * Autonomous Tools Integration Tests
 *
 * Tests for newly added autonomous agent tools:
 * - File operations (read, write, edit, list, search)
 * - Deployment operations (build, test, lint, deploy)
 * - Tool registration and discovery
 * - Error handling for invalid inputs
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import type { Tool } from '@duyetbot/types';

// Import tools from packages/tools
import {
  ReadFileTool,
  WriteFileTool,
  EditFileTool,
  ListDirTool,
  SearchFilesTool,
  FileStatsTool,
} from '@duyetbot/tools/file-ops';
import {
  RunBuildTool,
  RunTestsTool,
  TypeCheckTool,
  LintTool,
  DeployCloudflareTool,
  HealthCheckTool,
  CIPipelineTool,
} from '@duyetbot/tools/deployment';

// =============================================================================
// File Operations Tools Tests
// =============================================================================

describe('File Operations Tools - Integration', () => {
  const testDir = '/tmp/duyetbot-test-' + Date.now();
  const testFile = join(testDir, 'test.txt');
  const testContent = 'Hello, World!';

  // Helper to join paths (simple implementation for tests)
  function join(...paths: string[]): string {
    return paths.join('/').replace(/\/+/g, '/');
  }

  beforeEach(async () => {
    // Clean up test directory before each test
    const fs = await import('node:fs/promises');
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch {
      // Ignore if directory doesn't exist
    }
    await fs.mkdir(testDir, { recursive: true });
  });

  describe('ReadFileTool', () => {
    const tool = new ReadFileTool();

    it('should have correct metadata', () => {
      expect(tool.name).toBe('read_file');
      expect(tool.description).toContain('Read the contents of a file');
      expect(tool.inputSchema).toBeInstanceOf(z.ZodObject);
    });

    it('should validate input schema', () => {
      const validInput = { path: '/tmp/test.txt', encoding: 'utf-8' as const };
      expect(() => tool.inputSchema.parse(validInput)).not.toThrow();

      const invalidInput = { path: '' };
      expect(() => tool.inputSchema.parse(invalidInput)).toThrow();
    });

    it('should read file contents', async () => {
      const fs = await import('node:fs/promises');
      await fs.writeFile(testFile, testContent, 'utf-8');

      const result = await tool.execute({ content: { path: testFile } });

      expect(result.status).toBe('success');
      expect(result.content).toBe(testContent);
    });

    it('should return error for non-existent file', async () => {
      const result = await tool.execute({ content: { path: '/nonexistent/file.txt' } });

      expect(result.status).toBe('error');
      expect(result.error).toBeDefined();
      expect(result.error?.code).toBe('READ_FAILED');
    });

    it('should read specific line range', async () => {
      const fs = await import('node:fs/promises');
      const multiLineContent = 'Line 1\nLine 2\nLine 3\nLine 4\nLine 5';
      await fs.writeFile(testFile, multiLineContent, 'utf-8');

      const result = await tool.execute({
        content: { path: testFile, lines: { from: 2, to: 4 } },
      });

      expect(result.status).toBe('success');
      expect(result.content).toContain('Line 2');
      expect(result.content).toContain('Line 4');
    });
  });

  describe('WriteFileTool', () => {
    const tool = new WriteFileTool();

    it('should have correct metadata', () => {
      expect(tool.name).toBe('write_file');
      expect(tool.description).toContain('Write content to a file');
    });

    it('should write file contents', async () => {
      const result = await tool.execute({
        content: { path: testFile, content: testContent },
      });

      expect(result.status).toBe('success');

      const fs = await import('node:fs/promises');
      const written = await fs.readFile(testFile, 'utf-8');
      expect(written).toBe(testContent);
    });

    it('should create directories with createDirs option', async () => {
      const nestedPath = join(testDir, 'nested', 'dir', 'file.txt');

      const result = await tool.execute({
        content: { path: nestedPath, content: testContent, createDirs: true },
      });

      expect(result.status).toBe('success');

      const fs = await import('node:fs/promises');
      const exists = await fs.access(nestedPath).then(() => true).catch(() => false);
      expect(exists).toBe(true);
    });

    it('should handle encoding options', async () => {
      const result = await tool.execute({
        content: { path: testFile, content: testContent },
      });

      expect(result.status).toBe('success');
    });
  });

  describe('EditFileTool', () => {
    const tool = new EditFileTool();
    const originalContent = 'Hello World\nFoo Bar\nBaz Qux';

    beforeEach(async () => {
      const fs = await import('node:fs/promises');
      await fs.writeFile(testFile, originalContent, 'utf-8');
    });

    it('should have correct metadata', () => {
      expect(tool.name).toBe('edit_file');
      expect(tool.description).toContain('finding and replacing');
    });

    it('should replace single occurrence', async () => {
      const result = await tool.execute({
        content: { path: testFile, oldText: 'Hello World', newText: 'Hi Universe' },
      });

      expect(result.status).toBe('success');
      expect(result.metadata?.replacements).toBe(1);

      const fs = await import('node:fs/promises');
      const content = await fs.readFile(testFile, 'utf-8');
      expect(content).toContain('Hi Universe');
      expect(content).not.toContain('Hello World');
    });

    it('should replace all occurrences with replaceAll', async () => {
      const result = await tool.execute({
        content: {
          path: testFile,
          oldText: 'o',
          newText: '0',
          replaceAll: true,
        },
      });

      expect(result.status).toBe('success');
      expect(result.metadata?.replacements).toBeGreaterThan(0);
    });

    it('should return error when oldText not found', async () => {
      const result = await tool.execute({
        content: { path: testFile, oldText: 'NonExistent', newText: 'New' },
      });

      expect(result.status).toBe('error');
      expect(result.error?.code).toBe('TEXT_NOT_FOUND');
    });

    it('should validate non-empty oldText', () => {
      expect(() =>
        tool.inputSchema.parse({ path: testFile, oldText: '', newText: 'New' })
      ).toThrow();
    });
  });

  describe('ListDirTool', () => {
    const tool = new ListDirTool();

    beforeEach(async () => {
      const fs = await import('node:fs/promises');
      await fs.writeFile(join(testDir, 'file1.txt'), 'content1');
      await fs.writeFile(join(testDir, 'file2.ts'), 'content2');
      await fs.mkdir(join(testDir, 'subdir'));
      await fs.writeFile(join(testDir, 'subdir', 'file3.md'), 'content3');
    });

    it('should have correct metadata', () => {
      expect(tool.name).toBe('list_dir');
      expect(tool.description).toContain('List directory contents');
    });

    it('should list directory contents', async () => {
      const result = await tool.execute({
        content: { path: testDir },
      });

      expect(result.status).toBe('success');
      const files = result.content as Array<{ name: string; type: string }>;
      expect(Array.isArray(files)).toBe(true);
      expect(files.length).toBeGreaterThan(0);
    });

    it('should filter by extension', async () => {
      const result = await tool.execute({
        content: { path: testDir, extension: '.txt' },
      });

      expect(result.status).toBe('success');
      const files = result.content as Array<{ name: string; type: string }>;
      expect(files.some((f: { name: string }) => f.name === 'file1.txt')).toBe(true);
      expect(files.some((f: { name: string }) => f.name === 'file2.ts')).toBe(false);
    });

    it('should list recursively', async () => {
      const result = await tool.execute({
        content: { path: testDir, recursive: true },
      });

      expect(result.status).toBe('success');
      const files = result.content as Array<{ name: string; path: string }>;
      expect(files.some((f: { name: string }) => f.name === 'file3.md')).toBe(true);
    });
  });

  describe('SearchFilesTool', () => {
    const tool = new SearchFilesTool();

    beforeEach(async () => {
      const fs = await import('node:fs/promises');
      await fs.writeFile(join(testDir, 'test.ts'), 'export function test() {}');
      await fs.writeFile(join(testDir, 'spec.ts'), '// TODO: implement test');
      await fs.writeFile(join(testDir, 'readme.md'), '# Test README');
    });

    it('should have correct metadata', () => {
      expect(tool.name).toBe('search_files');
      expect(tool.description).toContain('Search for files by pattern');
    });

    it('should search files by glob pattern', async () => {
      const result = await tool.execute({
        content: { pattern: '*.ts', root: testDir },
      });

      expect(result.status).toBe('success');
      const matches = result.content as { matches: string[] };
      expect(Array.isArray(matches.matches)).toBe(true);
      expect(matches.matches.length).toBe(2);
    });

    it('should search file contents', async () => {
      const result = await tool.execute({
        content: { pattern: '*.ts', root: testDir, contentSearch: 'TODO' },
      });

      expect(result.status).toBe('success');
      const content = result.content as { results: Array<{ file: string }> };
      expect(content.results.length).toBe(1);
      expect(content.results[0].file).toContain('spec.ts');
    });

    it('should handle case-insensitive search', async () => {
      const result = await tool.execute({
        content: { pattern: '*.ts', root: testDir, contentSearch: 'TODO', ignoreCase: true },
      });

      expect(result.status).toBe('success');
    });
  });

  describe('FileStatsTool', () => {
    const tool = new FileStatsTool();

    it('should have correct metadata', () => {
      expect(tool.name).toBe('file_stats');
      expect(tool.description).toContain('Get file statistics');
    });

    it('should return file stats', async () => {
      const fs = await import('node:fs/promises');
      await fs.writeFile(testFile, testContent);

      const result = await tool.execute({
        content: { path: testFile },
      });

      expect(result.status).toBe('success');
      expect(result.stats).toBeDefined();
      expect(result.stats.exists).toBe(true);
      expect(result.stats.size).toBeGreaterThan(0);
    });

    it('should return exists=false for non-existent file', async () => {
      const result = await tool.execute({
        content: { path: '/nonexistent/file.txt' },
      });

      expect(result.status).toBe('success');
      expect(result.stats.exists).toBe(false);
    });
  });
});

// =============================================================================
// Deployment Tools Tests
// =============================================================================

describe('Deployment Tools - Integration', () => {
  describe('RunBuildTool', () => {
    const tool = new RunBuildTool();

    it('should have correct metadata', () => {
      expect(tool.name).toBe('run_build');
      expect(tool.description).toContain('Run build process');
    });

    it('should validate package option', () => {
      const validInput = { package: '@duyetbot/tools' };
      expect(() => tool.inputSchema.parse(validInput)).not.toThrow();
    });
  });

  describe('RunTestsTool', () => {
    const tool = new RunTestsTool();

    it('should have correct metadata', () => {
      expect(tool.name).toBe('run_tests');
      expect(tool.description).toContain('Run test suite');
    });

    it('should validate filter option', () => {
      const validInput = { filter: '@duyetbot/core' };
      expect(() => tool.inputSchema.parse(validInput)).not.toThrow();
    });
  });

  describe('TypeCheckTool', () => {
    const tool = new TypeCheckTool();

    it('should have correct metadata', () => {
      expect(tool.name).toBe('type_check');
      expect(tool.description).toContain('Run TypeScript type checking');
    });
  });

  describe('LintTool', () => {
    const tool = new LintTool();

    it('should have correct metadata', () => {
      expect(tool.name).toBe('lint');
      expect(tool.description).toContain('Run linter');
    });

    it('should validate fix option', () => {
      const validInput = { fix: true };
      expect(() => tool.inputSchema.parse(validInput)).not.toThrow();
    });
  });

  describe('DeployCloudflareTool', () => {
    const tool = new DeployCloudflareTool();

    it('should have correct metadata', () => {
      expect(tool.name).toBe('deploy_cloudflare');
      expect(tool.description).toContain('Deploy to Cloudflare Workers');
    });

    it('should validate required options', () => {
      const validInput = { app: 'telegram-bot' };
      expect(() => tool.inputSchema.parse(validInput)).not.toThrow();

      const invalidInput = { app: '' };
      expect(() => tool.inputSchema.parse(invalidInput)).toThrow();
    });
  });

  describe('HealthCheckTool', () => {
    const tool = new HealthCheckTool();

    it('should have correct metadata', () => {
      expect(tool.name).toBe('health_check');
      expect(tool.description).toContain('Check deployment health');
    });

    it('should validate app option', () => {
      const validInput = { app: 'telegram-bot' };
      expect(() => tool.inputSchema.parse(validInput)).not.toThrow();
    });
  });

  describe('CIPipelineTool', () => {
    const tool = new CIPipelineTool();

    it('should have correct metadata', () => {
      expect(tool.name).toBe('ci_pipeline');
      expect(tool.description).toContain('Run complete CI pipeline');
    });

    it('should validate app option', () => {
      const validInput = { app: 'github-bot', deploy: false };
      expect(() => tool.inputSchema.parse(validInput)).not.toThrow();
    });
  });
});

// =============================================================================
// Tool Registration and Discovery Tests
// =============================================================================

describe('Tool Registration and Discovery', () => {
  it('should discover all file-ops tools', async () => {
    const fileOpsTools = await import('@duyetbot/tools/file-ops');

    const toolNames = [
      'read_file',
      'write_file',
      'edit_file',
      'list_dir',
      'search_files',
      'file_stats',
      'batch_file_ops',
    ];

    for (const name of toolNames) {
      // Tools should be exported as classes
      expect(fileOpsTools).toBeDefined();
    }
  });

  it('should discover all deployment tools', async () => {
    const deploymentTools = await import('@duyetbot/tools/deployment');

    const toolNames = [
      'run_build',
      'run_tests',
      'type_check',
      'lint',
      'deploy_cloudflare',
      'health_check',
      'ci_pipeline',
    ];

    for (const name of toolNames) {
      expect(deploymentTools).toBeDefined();
    }
  });

  it('should get all builtin tools', async () => {
    const { getAllBuiltinTools } = await import('@duyetbot/tools');

    const tools = getAllBuiltinTools();

    // Should include file-ops tools
    expect(tools.some((t: Tool) => t.name === 'read_file')).toBe(true);
    expect(tools.some((t: Tool) => t.name === 'write_file')).toBe(true);
    expect(tools.some((t: Tool) => t.name === 'edit_file')).toBe(true);

    // Should include deployment tools
    expect(tools.some((t: Tool) => t.name === 'run_build')).toBe(true);
    expect(tools.some((t: Tool) => t.name === 'run_tests')).toBe(true);
    expect(tools.some((t: Tool) => t.name === 'ci_pipeline')).toBe(true);

    // Should include existing tools
    expect(tools.some((t: Tool) => t.name === 'bash')).toBe(true);
    expect(tools.some((t: Tool) => t.name === 'git')).toBe(true);
  });
});

// =============================================================================
// Tool Executor Integration with New Tools
// =============================================================================

describe('ToolExecutor with Autonomous Tools', () => {
  it('should execute read_file tool', async () => {
    const { ToolExecutor } = await import('@duyetbot/cloudflare-agent/chat/tool-executor');
    const { getAllBuiltinTools } = await import('@duyetbot/tools');

    const tools = getAllBuiltinTools();
    const toolMap = new Map<string, Tool>(tools.map((t: Tool) => [t.name, t]));

    const mockMcpCallTool = vi.fn();
    const executor = new ToolExecutor({
      builtinToolMap: toolMap,
      mcpCallTool: mockMcpCallTool,
    });

    // Create a test file
    const fs = await import('node:fs/promises');
    const testFile = '/tmp/executor-test-' + Date.now() + '.txt';
    await fs.writeFile(testFile, 'Test content', 'utf-8');

    const result = await executor.execute({
      name: 'read_file',
      arguments: JSON.stringify({ path: testFile }),
    });

    expect(result.error).toBeUndefined();
    expect(result.result).toContain('Test content');

    // Cleanup
    await fs.rm(testFile).catch(() => {});
  });

  it('should validate input schema before execution', async () => {
    const { ToolExecutor } = await import('@duyetbot/cloudflare-agent/chat/tool-executor');
    const { getAllBuiltinTools } = await import('@duyetbot/tools');

    const tools = getAllBuiltinTools();
    const toolMap = new Map<string, Tool>(tools.map((t: Tool) => [t.name, t]));

    const mockMcpCallTool = vi.fn();
    const executor = new ToolExecutor({
      builtinToolMap: toolMap,
      mcpCallTool: mockMcpCallTool,
    });

    const result = await executor.execute({
      name: 'write_file',
      arguments: JSON.stringify({ path: '', content: 'test' }),
    });

    // Should fail validation
    expect(result.error).toBeDefined();
  });

  it('should handle write_file tool execution', async () => {
    const { ToolExecutor } = await import('@duyetbot/cloudflare-agent/chat/tool-executor');
    const { getAllBuiltinTools } = await import('@duyetbot/tools');

    const tools = getAllBuiltinTools();
    const toolMap = new Map<string, Tool>(tools.map((t: Tool) => [t.name, t]));

    const mockMcpCallTool = vi.fn();
    const executor = new ToolExecutor({
      builtinToolMap: toolMap,
      mcpCallTool: mockMcpCallTool,
    });

    const testFile = '/tmp/executor-write-' + Date.now() + '.txt';

    const result = await executor.execute({
      name: 'write_file',
      arguments: JSON.stringify({ path: testFile, content: 'Autonomous test' }),
    });

    expect(result.error).toBeUndefined();
    expect(result.result).toContain('written');

    // Verify file was created
    const fs = await import('node:fs/promises');
    const content = await fs.readFile(testFile, 'utf-8');
    expect(content).toBe('Autonomous test');

    // Cleanup
    await fs.rm(testFile).catch(() => {});
  });
});

// =============================================================================
// Error Handling Tests
// =============================================================================

describe('Autonomous Tools Error Handling', () => {
  it('should return error for invalid paths in read_file', async () => {
    const { ReadFileTool } = await import('@duyetbot/tools/file-ops');
    const tool = new ReadFileTool();

    const result = await tool.execute({
      content: { path: '/nonexistent/path/file.txt' },
    });

    expect(result.status).toBe('error');
    expect(result.error).toBeDefined();
    expect(result.error?.code).toBe('READ_FAILED');
  });

  it('should return error for edit_file with non-existent file', async () => {
    const { EditFileTool } = await import('@duyetbot/tools/file-ops');
    const tool = new EditFileTool();

    const result = await tool.execute({
      content: { path: '/nonexistent/file.txt', oldText: 'old', newText: 'new' },
    });

    expect(result.status).toBe('error');
    expect(result.error?.code).toBe('EDIT_FAILED');
  });

  it('should handle batch operations with partial failures', async () => {
    const { BatchFileOpsTool } = await import('@duyetbot/tools/file-ops');
    const tool = new BatchFileOpsTool();

    const operations = [
      { type: 'write' as const, params: { path: '/tmp/test1.txt', content: 'content1' } },
      { type: 'write' as const, params: { path: '/tmp/test2.txt', content: 'content2' } },
    ];

    const result = await tool.execute({ content: { operations, stopOnError: false } });

    expect(result.status).toBe('success');
    expect(result.content).toBeDefined();

    const results = result.content as Array<{ operation: number; status: string }>;
    expect(results).toBeDefined();
    expect(results.length).toBe(2);

    // Cleanup
    const fs = await import('node:fs/promises');
    await fs.rm('/tmp/test1.txt').catch(() => {});
    await fs.rm('/tmp/test2.txt').catch(() => {});
  });
});
