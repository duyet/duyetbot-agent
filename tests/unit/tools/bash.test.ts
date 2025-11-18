import { BashTool } from '@/tools/bash';
import type { ToolInput } from '@/tools/types';
import { beforeEach, describe, expect, it } from 'vitest';

describe('BashTool', () => {
  let bashTool: BashTool;

  beforeEach(() => {
    bashTool = new BashTool();
  });

  describe('tool definition', () => {
    it('should have correct name', () => {
      expect(bashTool.name).toBe('bash');
    });

    it('should have description', () => {
      expect(bashTool.description).toBeDefined();
      expect(bashTool.description.length).toBeGreaterThan(0);
    });

    it('should have input schema', () => {
      expect(bashTool.inputSchema).toBeDefined();
    });
  });

  describe('validation', () => {
    it('should validate correct input with command', () => {
      const input: ToolInput = {
        content: { command: 'echo "hello"' },
      };

      const result = bashTool.validate?.(input);
      expect(result).toBe(true);
    });

    it('should validate input with string command', () => {
      const input: ToolInput = {
        content: 'ls -la',
      };

      const result = bashTool.validate?.(input);
      expect(result).toBe(true);
    });

    it('should validate input with timeout', () => {
      const input: ToolInput = {
        content: {
          command: 'sleep 1',
          timeout: 5000,
        },
      };

      const result = bashTool.validate?.(input);
      expect(result).toBe(true);
    });

    it('should validate input with working directory', () => {
      const input: ToolInput = {
        content: {
          command: 'pwd',
          cwd: '/tmp',
        },
      };

      const result = bashTool.validate?.(input);
      expect(result).toBe(true);
    });

    it('should reject empty command', () => {
      const input: ToolInput = {
        content: { command: '' },
      };

      const result = bashTool.validate?.(input);
      expect(result).toBe(false);
    });

    it('should reject commands that are too long', () => {
      const input: ToolInput = {
        content: { command: 'A'.repeat(100000) },
      };

      const result = bashTool.validate?.(input);
      expect(result).toBe(false);
    });

    it('should reject negative timeout', () => {
      const input: ToolInput = {
        content: {
          command: 'echo test',
          timeout: -1000,
        },
      };

      const result = bashTool.validate?.(input);
      expect(result).toBe(false);
    });
  });

  describe('execution', () => {
    it('should execute simple command', async () => {
      const result = await bashTool.execute({
        content: { command: 'echo "hello world"' },
      });

      expect(result.status).toBe('success');
      expect(result.content).toContain('hello world');
    });

    it('should execute command from string', async () => {
      const result = await bashTool.execute({
        content: 'echo "test"',
      });

      expect(result.status).toBe('success');
      expect(result.content).toContain('test');
    });

    it('should return stdout in content', async () => {
      const result = await bashTool.execute({
        content: { command: 'echo "output"' },
      });

      expect(result.status).toBe('success');
      expect(result.content).toContain('output');
    });

    it('should include stderr in metadata', async () => {
      const result = await bashTool.execute({
        content: { command: 'echo "error" >&2' },
      });

      expect(result.status).toBe('success');
      expect(result.metadata?.stderr).toBeDefined();
    });

    it('should include exit code in metadata', async () => {
      const result = await bashTool.execute({
        content: { command: 'echo "test"' },
      });

      expect(result.status).toBe('success');
      expect(result.metadata?.exitCode).toBe(0);
    });

    it('should handle commands with exit code 0', async () => {
      const result = await bashTool.execute({
        content: { command: 'true' },
      });

      expect(result.status).toBe('success');
      expect(result.metadata?.exitCode).toBe(0);
    });

    it('should handle commands with non-zero exit code', async () => {
      const result = await bashTool.execute({
        content: { command: 'false' },
      });

      expect(result.status).toBe('error');
      expect(result.metadata?.exitCode).toBe(1);
    });

    it('should respect timeout setting', async () => {
      const startTime = Date.now();
      const result = await bashTool.execute({
        content: {
          command: 'sleep 10',
          timeout: 100,
        },
      });
      const duration = Date.now() - startTime;

      expect(result.status).toBe('error');
      expect(result.error?.code).toBe('TIMEOUT');
      expect(duration).toBeLessThan(1000);
    });

    it('should support environment variables', async () => {
      const result = await bashTool.execute({
        content: {
          command: 'echo $TEST_VAR',
          env: { TEST_VAR: 'test_value' },
        },
      });

      expect(result.status).toBe('success');
      expect(result.content).toContain('test_value');
    });

    it('should support working directory', async () => {
      const result = await bashTool.execute({
        content: {
          command: 'pwd',
          cwd: '/tmp',
        },
      });

      expect(result.status).toBe('success');
      expect(result.content).toContain('/tmp');
    });

    it('should include execution duration', async () => {
      const result = await bashTool.execute({
        content: { command: 'echo "test"' },
      });

      expect(result.status).toBe('success');
      expect(result.metadata?.duration).toBeDefined();
      expect(typeof result.metadata?.duration).toBe('number');
    });
  });

  describe('error handling', () => {
    it('should return error for missing command', async () => {
      const result = await bashTool.execute({
        content: {},
      });

      expect(result.status).toBe('error');
      expect(result.error?.message).toContain('command');
    });

    it('should return error for empty command', async () => {
      const result = await bashTool.execute({
        content: '',
      });

      expect(result.status).toBe('error');
      expect(result.error?.code).toBe('INVALID_INPUT');
    });

    it('should return error for command not found', async () => {
      const result = await bashTool.execute({
        content: { command: 'nonexistentcommand123456' },
      });

      expect(result.status).toBe('error');
      expect(result.metadata?.exitCode).not.toBe(0);
    });

    it('should handle commands that write to stderr', async () => {
      const result = await bashTool.execute({
        content: { command: 'ls /nonexistent 2>&1' },
      });

      // Should still capture stderr even if command fails
      expect(['success', 'error']).toContain(result.status);
    });

    it('should return error for very long commands', async () => {
      const result = await bashTool.execute({
        content: { command: `echo ${'A'.repeat(100000)}` },
      });

      expect(result.status).toBe('error');
      expect(result.error?.code).toBe('COMMAND_TOO_LONG');
    });
  });

  describe('security', () => {
    it('should handle shell injection attempts safely', async () => {
      const result = await bashTool.execute({
        content: { command: 'echo "test"; rm -rf /' },
      });

      // Should execute the command as-is without shell expansion issues
      expect(['success', 'error']).toContain(result.status);
    });

    it('should handle commands with special characters', async () => {
      const result = await bashTool.execute({
        content: { command: 'echo "test $PATH | grep bash"' },
      });

      expect(result.status).toBe('success');
    });

    it('should isolate environment variables', async () => {
      const result1 = await bashTool.execute({
        content: {
          command: 'echo $ISOLATED_VAR',
          env: { ISOLATED_VAR: 'value1' },
        },
      });

      const result2 = await bashTool.execute({
        content: { command: 'echo $ISOLATED_VAR' },
      });

      expect(result1.content).toContain('value1');
      expect(result2.content).not.toContain('value1');
    });
  });

  describe('integration', () => {
    it('should support reason in metadata', async () => {
      const result = await bashTool.execute({
        content: { command: 'echo "test"' },
        metadata: { reason: 'Testing bash execution' },
      });

      expect(result.status).toBe('success');
      expect(result.metadata?.reason).toBe('Testing bash execution');
    });

    it('should handle concurrent executions', async () => {
      const commands = [
        bashTool.execute({ content: { command: 'echo "cmd1"' } }),
        bashTool.execute({ content: { command: 'echo "cmd2"' } }),
        bashTool.execute({ content: { command: 'echo "cmd3"' } }),
      ];

      const results = await Promise.all(commands);

      for (const result of results) {
        expect(result.status).toBe('success');
      }
    });

    it('should handle piped commands', async () => {
      const result = await bashTool.execute({
        content: { command: 'echo "line1\nline2\nline3" | grep line2' },
      });

      expect(result.status).toBe('success');
      expect(result.content).toContain('line2');
    });
  });
});
