/**
 * Bash Tool
 *
 * Executes shell commands in a sandboxed environment
 */

import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { z } from 'zod';
import type { Tool, ToolInput, ToolOutput } from './types';
import { ToolExecutionError } from './types';

const execAsync = promisify(exec);

// Maximum command length
const MAX_COMMAND_LENGTH = 50000;

// Default timeout: 30 seconds
const DEFAULT_TIMEOUT = 30000;

// Input schema for bash tool
const bashInputSchema = z.union([
  z
    .string()
    .min(1, 'Command cannot be empty')
    .transform((command) => ({ command })),
  z.object({
    command: z.string().min(1, 'Command cannot be empty'),
    timeout: z.number().positive().optional(),
    cwd: z.string().optional(),
    env: z.record(z.string()).optional(),
  }),
]);

/**
 * Bash tool implementation
 */
export class BashTool implements Tool {
  name = 'bash';
  description =
    'Execute shell commands in a sandboxed environment. Returns stdout, stderr, and exit code.';
  inputSchema = bashInputSchema;

  /**
   * Validate input
   */
  validate(input: ToolInput): boolean {
    const result = this.inputSchema.safeParse(input.content);
    if (!result.success) {
      return false;
    }

    const data = result.data;
    const command = data.command;

    // Check command length
    if (command.length > MAX_COMMAND_LENGTH) {
      return false;
    }

    // Check timeout is not negative
    const timeout = 'timeout' in data ? data.timeout : undefined;
    if (timeout !== undefined && timeout < 0) {
      return false;
    }

    return true;
  }

  /**
   * Execute bash command
   */
  async execute(input: ToolInput): Promise<ToolOutput> {
    const startTime = Date.now();

    try {
      // Validate and parse input
      const parsed = this.inputSchema.safeParse(input.content);
      if (!parsed.success) {
        return {
          status: 'error',
          content: 'Invalid input',
          error: {
            message: `Invalid input: ${parsed.error.message}`,
            code: 'INVALID_INPUT',
          },
        };
      }

      const data = parsed.data;
      const command = data.command;
      const timeout =
        'timeout' in data && data.timeout !== undefined ? data.timeout : DEFAULT_TIMEOUT;
      const cwd = 'cwd' in data ? data.cwd : undefined;
      const env = 'env' in data ? data.env : undefined;

      // Check maximum command length
      if (command.length > MAX_COMMAND_LENGTH) {
        return {
          status: 'error',
          content: `Command too long (max ${MAX_COMMAND_LENGTH} characters)`,
          error: {
            message: `Command length ${command.length} exceeds maximum ${MAX_COMMAND_LENGTH}`,
            code: 'COMMAND_TOO_LONG',
          },
        };
      }

      // Execute command
      try {
        const { stdout, stderr } = await execAsync(command, {
          timeout,
          cwd,
          env: env ? { ...process.env, ...env } : process.env,
          maxBuffer: 10 * 1024 * 1024, // 10MB
        });

        const endTime = Date.now();

        return {
          status: 'success',
          content: stdout || '(no output)',
          metadata: {
            command,
            exitCode: 0,
            stdout,
            stderr: stderr || undefined,
            duration: endTime - startTime,
            ...(input.metadata?.reason ? { reason: input.metadata.reason } : {}),
          },
        };
      } catch (execError: unknown) {
        const endTime = Date.now();

        // Type guard for exec error
        if (execError && typeof execError === 'object' && 'code' in execError) {
          const error = execError as {
            code?: number | string;
            killed?: boolean;
            stdout?: string;
            stderr?: string;
            message: string;
          };

          // Handle timeout
          if (error.killed || error.code === 'ETIMEDOUT') {
            return {
              status: 'error',
              content: `Command timed out after ${timeout}ms`,
              error: {
                message: `Command execution exceeded timeout of ${timeout}ms`,
                code: 'TIMEOUT',
              },
              metadata: {
                command,
                duration: endTime - startTime,
                stdout: error.stdout,
                stderr: error.stderr,
              },
            };
          }

          // Handle non-zero exit code
          const exitCode = typeof error.code === 'number' ? error.code : 1;
          return {
            status: 'error',
            content: error.stderr || error.stdout || error.message,
            error: {
              message: `Command exited with code ${exitCode}`,
              code: 'NON_ZERO_EXIT',
            },
            metadata: {
              command,
              exitCode,
              stdout: error.stdout,
              stderr: error.stderr,
              duration: endTime - startTime,
            },
          };
        }

        // Unknown error
        throw execError;
      }
    } catch (error) {
      // Handle unexpected errors
      throw new ToolExecutionError(
        'bash',
        error instanceof Error ? error.message : 'Unknown error',
        'EXECUTION_ERROR',
        error instanceof Error ? error : undefined
      );
    }
  }
}

/**
 * Create and export singleton instance
 */
export const bashTool = new BashTool();
