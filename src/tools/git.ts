/**
 * Git Tool
 *
 * Executes git operations for version control
 */

import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { z } from 'zod';
import type { Tool, ToolInput, ToolOutput } from './types';
import { ToolExecutionError } from './types';

const execAsync = promisify(exec);

// Default timeout: 60 seconds (git operations can be slow)
const DEFAULT_TIMEOUT = 60000;

// Input schema for git tool
const gitInputSchema = z.union([
  z
    .string()
    .min(1, 'Command cannot be empty')
    .transform((command) => ({ command })),
  z.object({
    command: z.enum([
      'status',
      'clone',
      'commit',
      'push',
      'pull',
      'add',
      'diff',
      'log',
      'branch',
      'checkout',
    ]),
    // Clone options
    url: z.string().optional(),
    directory: z.string().optional(),
    depth: z.number().optional(),
    // Commit options
    message: z.string().optional(),
    amend: z.boolean().optional(),
    // Push/Pull options
    remote: z.string().optional(),
    branch: z.string().optional(),
    force: z.boolean().optional(),
    rebase: z.boolean().optional(),
    // Add options
    files: z.array(z.string()).optional(),
    // Diff options
    staged: z.boolean().optional(),
    // Log options
    limit: z.number().optional(),
    oneline: z.boolean().optional(),
    // Branch options
    name: z.string().optional(),
    create: z.boolean().optional(),
    delete: z.boolean().optional(),
  }),
]);

/**
 * Git tool implementation
 */
export class GitTool implements Tool {
  name = 'git';
  description =
    'Execute git version control operations. Supports status, clone, commit, push, pull, add, diff, log, branch, and checkout.';
  inputSchema = gitInputSchema;

  /**
   * Validate input
   */
  validate(input: ToolInput): boolean {
    const result = this.inputSchema.safeParse(input.content);
    return result.success;
  }

  /**
   * Execute git command
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
      const command = typeof data === 'string' ? data : data.command;
      const cwd = input.metadata?.cwd as string | undefined;

      // Execute git command based on type
      let gitCommand: string;
      let result: { stdout: string; stderr: string };

      switch (command) {
        case 'status':
          gitCommand = 'git status --porcelain --branch';
          result = await this.execGit(gitCommand, cwd);
          return this.handleStatus(result, startTime, input);

        case 'clone':
          if (typeof data !== 'string' && !(data as any).url) {
            return this.error('Clone requires URL parameter', 'MISSING_PARAMETER');
          }
          gitCommand = this.buildCloneCommand(data as any);
          result = await this.execGit(gitCommand, cwd);
          if ((result as any).failed) {
            return this.error(result.stderr || 'Clone failed', 'GIT_ERROR');
          }
          return this.success('Repository cloned successfully', result, startTime, input, {
            command,
          });

        case 'commit':
          if (typeof data !== 'string' && !(data as any).message) {
            return this.error('Commit requires message parameter', 'MISSING_PARAMETER');
          }
          gitCommand = this.buildCommitCommand(data as any);
          result = await this.execGit(gitCommand, cwd);
          if ((result as any).failed) {
            return this.error(result.stderr || 'Commit failed', 'GIT_ERROR');
          }
          return this.success('Commit created successfully', result, startTime, input, {
            command,
          });

        case 'push':
          gitCommand = this.buildPushCommand(data as any);
          result = await this.execGit(gitCommand, cwd);
          if ((result as any).failed) {
            return this.error(result.stderr || 'Push failed', 'GIT_ERROR');
          }
          return this.success('Pushed to remote successfully', result, startTime, input, {
            command,
          });

        case 'pull':
          gitCommand = this.buildPullCommand(data as any);
          result = await this.execGit(gitCommand, cwd);
          if ((result as any).failed) {
            return this.error(result.stderr || 'Pull failed', 'GIT_ERROR');
          }
          return this.success('Pulled from remote successfully', result, startTime, input, {
            command,
          });

        case 'add':
          if (typeof data !== 'string' && !(data as any).files) {
            return this.error('Add requires files parameter', 'MISSING_PARAMETER');
          }
          gitCommand = this.buildAddCommand(data as any);
          result = await this.execGit(gitCommand, cwd);
          if ((result as any).failed) {
            return this.error(result.stderr || 'Add failed', 'GIT_ERROR');
          }
          return this.success('Files staged successfully', result, startTime, input, { command });

        case 'diff':
          gitCommand = this.buildDiffCommand(data as any);
          result = await this.execGit(gitCommand, cwd);
          return this.success(result.stdout || 'No changes', result, startTime, input, {
            command,
          });

        case 'log':
          gitCommand = this.buildLogCommand(data as any);
          result = await this.execGit(gitCommand, cwd);
          return this.success(result.stdout, result, startTime, input, { command });

        case 'branch':
          gitCommand = this.buildBranchCommand(data as any);
          result = await this.execGit(gitCommand, cwd);
          return this.handleBranch(result, startTime, input);

        case 'checkout':
          if (typeof data !== 'string' && !(data as any).branch) {
            return this.error('Checkout requires branch parameter', 'MISSING_PARAMETER');
          }
          gitCommand = this.buildCheckoutCommand(data as any);
          result = await this.execGit(gitCommand, cwd);
          if ((result as any).failed) {
            return this.error(result.stderr || 'Checkout failed', 'GIT_ERROR');
          }
          return this.success('Checked out branch successfully', result, startTime, input, {
            command,
          });

        default:
          return this.error(`Unknown git command: ${command}`, 'UNKNOWN_COMMAND');
      }
    } catch (error) {
      throw new ToolExecutionError(
        'git',
        error instanceof Error ? error.message : 'Unknown error',
        'EXECUTION_ERROR',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Execute git command
   */
  private async execGit(
    command: string,
    cwd?: string
  ): Promise<{ stdout: string; stderr: string; failed?: boolean }> {
    try {
      const { stdout, stderr } = await execAsync(command, {
        cwd: cwd || process.cwd(),
        timeout: DEFAULT_TIMEOUT,
        maxBuffer: 10 * 1024 * 1024, // 10MB
      });
      return { stdout: stdout.trim(), stderr: stderr.trim() };
    } catch (error: any) {
      // Git commands can return non-zero exit codes for valid operations
      // (e.g., git diff returns 1 if there are changes)
      if (error.stdout || error.stderr) {
        return {
          stdout: error.stdout?.trim() || '',
          stderr: error.stderr?.trim() || error.message,
          failed: true,
        };
      }
      throw error;
    }
  }

  /**
   * Build clone command
   */
  private buildCloneCommand(data: any): string {
    let cmd = `git clone`;
    if (data.depth) {
      cmd += ` --depth ${data.depth}`;
    }
    cmd += ` ${data.url}`;
    if (data.directory) {
      cmd += ` ${data.directory}`;
    }
    return cmd;
  }

  /**
   * Build commit command
   */
  private buildCommitCommand(data: any): string {
    let cmd = 'git commit';
    if (data.amend) {
      cmd += ' --amend';
    }
    cmd += ` -m "${data.message.replace(/"/g, '\\"')}"`;
    return cmd;
  }

  /**
   * Build push command
   */
  private buildPushCommand(data: any): string {
    let cmd = 'git push';
    if (data.force) {
      cmd += ' --force';
    }
    if (data.remote) {
      cmd += ` ${data.remote}`;
    }
    if (data.branch) {
      cmd += ` ${data.branch}`;
    }
    return cmd;
  }

  /**
   * Build pull command
   */
  private buildPullCommand(data: any): string {
    let cmd = 'git pull';
    if (data.rebase) {
      cmd += ' --rebase';
    }
    if (data.remote) {
      cmd += ` ${data.remote}`;
    }
    if (data.branch) {
      cmd += ` ${data.branch}`;
    }
    return cmd;
  }

  /**
   * Build add command
   */
  private buildAddCommand(data: any): string {
    return `git add ${data.files.join(' ')}`;
  }

  /**
   * Build diff command
   */
  private buildDiffCommand(data: any): string {
    let cmd = 'git diff';
    if (data.staged) {
      cmd += ' --staged';
    }
    if (data.files && data.files.length > 0) {
      cmd += ` ${data.files.join(' ')}`;
    }
    return cmd;
  }

  /**
   * Build log command
   */
  private buildLogCommand(data: any): string {
    let cmd = 'git log';
    if (data.oneline) {
      cmd += ' --oneline';
    }
    if (data.limit) {
      cmd += ` -n ${data.limit}`;
    }
    return cmd;
  }

  /**
   * Build branch command
   */
  private buildBranchCommand(data: any): string {
    let cmd = 'git branch';
    if (data.create && data.name) {
      cmd += ` ${data.name}`;
    } else if (data.delete && data.name) {
      cmd += ` -d ${data.name}`;
    }
    return cmd;
  }

  /**
   * Build checkout command
   */
  private buildCheckoutCommand(data: any): string {
    let cmd = 'git checkout';
    if (data.create) {
      cmd += ' -b';
    }
    cmd += ` ${data.branch}`;
    return cmd;
  }

  /**
   * Handle status output
   */
  private handleStatus(
    result: { stdout: string; stderr: string; failed?: boolean },
    startTime: number,
    input: ToolInput
  ): ToolOutput {
    if (result.failed) {
      return this.error(result.stderr || 'Status command failed', 'GIT_ERROR');
    }

    const lines = result.stdout.split('\n');
    const branchLine = lines[0];
    const branch = branchLine?.replace('## ', '').split('...')[0] || 'unknown';

    const files = lines.slice(1).filter((line) => line.trim());

    return {
      status: 'success',
      content: result.stdout || 'Working tree clean',
      metadata: {
        command: 'status',
        branch,
        files,
        duration: Date.now() - startTime,
        ...(input.metadata?.reason ? { reason: input.metadata.reason } : {}),
      },
    };
  }

  /**
   * Handle branch output
   */
  private handleBranch(
    result: { stdout: string; stderr: string; failed?: boolean },
    startTime: number,
    input: ToolInput
  ): ToolOutput {
    if (result.failed) {
      return this.error(result.stderr || 'Branch command failed', 'GIT_ERROR');
    }

    const branches = result.stdout
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line);

    return {
      status: 'success',
      content: result.stdout || 'No branches',
      metadata: {
        command: 'branch',
        branches,
        duration: Date.now() - startTime,
        ...(input.metadata?.reason ? { reason: input.metadata.reason } : {}),
      },
    };
  }

  /**
   * Create success response
   */
  private success(
    content: string,
    result: { stdout: string; stderr: string },
    startTime: number,
    input: ToolInput,
    metadata: Record<string, unknown>
  ): ToolOutput {
    return {
      status: 'success',
      content,
      metadata: {
        ...metadata,
        stdout: result.stdout,
        stderr: result.stderr || undefined,
        duration: Date.now() - startTime,
        ...(input.metadata?.reason ? { reason: input.metadata.reason } : {}),
      },
    };
  }

  /**
   * Create error response
   */
  private error(message: string, code: string): ToolOutput {
    return {
      status: 'error',
      content: message,
      error: {
        message,
        code,
      },
    };
  }
}

/**
 * Create and export singleton instance
 */
export const gitTool = new GitTool();
