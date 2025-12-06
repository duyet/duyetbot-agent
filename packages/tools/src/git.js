/**
 * Git Tool
 *
 * Executes git operations for version control
 */
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { ToolExecutionError } from '@duyetbot/types';
import { z } from 'zod';

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
export class GitTool {
  name = 'git';
  description =
    'Execute git version control operations. Supports status, clone, commit, push, pull, add, diff, log, branch, and checkout.';
  inputSchema = gitInputSchema;
  /**
   * Validate input
   */
  validate(input) {
    const result = this.inputSchema.safeParse(input.content);
    return result.success;
  }
  /**
   * Execute git command
   */
  async execute(input) {
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
      const cwd = input.metadata?.cwd;
      // Execute git command based on type
      let gitCommand;
      let result;
      switch (command) {
        case 'status':
          gitCommand = 'git status --porcelain --branch';
          result = await this.execGit(gitCommand, cwd);
          return this.handleStatus(result, startTime, input);
        case 'clone':
          if (typeof data !== 'string' && !data.url) {
            return this.error('Clone requires URL parameter', 'MISSING_PARAMETER');
          }
          gitCommand = this.buildCloneCommand(data);
          result = await this.execGit(gitCommand, cwd);
          if (result.failed === true) {
            return this.error(result.stderr || 'Clone failed', 'GIT_ERROR');
          }
          return this.success('Repository cloned successfully', result, startTime, input, {
            command,
          });
        case 'commit':
          if (typeof data !== 'string' && !data.message) {
            return this.error('Commit requires message parameter', 'MISSING_PARAMETER');
          }
          gitCommand = this.buildCommitCommand(data);
          result = await this.execGit(gitCommand, cwd);
          if (result.failed === true) {
            return this.error(result.stderr || 'Commit failed', 'GIT_ERROR');
          }
          return this.success('Commit created successfully', result, startTime, input, {
            command,
          });
        case 'push':
          gitCommand = this.buildPushCommand(data);
          result = await this.execGit(gitCommand, cwd);
          if (result.failed === true) {
            return this.error(result.stderr || 'Push failed', 'GIT_ERROR');
          }
          return this.success('Pushed to remote successfully', result, startTime, input, {
            command,
          });
        case 'pull':
          gitCommand = this.buildPullCommand(data);
          result = await this.execGit(gitCommand, cwd);
          if (result.failed === true) {
            return this.error(result.stderr || 'Pull failed', 'GIT_ERROR');
          }
          return this.success('Pulled from remote successfully', result, startTime, input, {
            command,
          });
        case 'add':
          if (typeof data !== 'string' && !data.files) {
            return this.error('Add requires files parameter', 'MISSING_PARAMETER');
          }
          gitCommand = this.buildAddCommand(data);
          result = await this.execGit(gitCommand, cwd);
          if (result.failed === true) {
            return this.error(result.stderr || 'Add failed', 'GIT_ERROR');
          }
          return this.success('Files staged successfully', result, startTime, input, { command });
        case 'diff':
          gitCommand = this.buildDiffCommand(data);
          result = await this.execGit(gitCommand, cwd);
          return this.success(result.stdout || 'No changes', result, startTime, input, {
            command,
          });
        case 'log':
          gitCommand = this.buildLogCommand(data);
          result = await this.execGit(gitCommand, cwd);
          return this.success(result.stdout, result, startTime, input, { command });
        case 'branch':
          gitCommand = this.buildBranchCommand(data);
          result = await this.execGit(gitCommand, cwd);
          return this.handleBranch(result, startTime, input);
        case 'checkout':
          if (typeof data !== 'string' && !data.branch) {
            return this.error('Checkout requires branch parameter', 'MISSING_PARAMETER');
          }
          gitCommand = this.buildCheckoutCommand(data);
          result = await this.execGit(gitCommand, cwd);
          if (result.failed === true) {
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
  async execGit(command, cwd) {
    try {
      const { stdout, stderr } = await execAsync(command, {
        cwd: cwd || process.cwd(),
        timeout: DEFAULT_TIMEOUT,
        maxBuffer: 10 * 1024 * 1024, // 10MB
      });
      return { stdout: stdout.trim(), stderr: stderr.trim() };
    } catch (error) {
      // Git commands can return non-zero exit codes for valid operations
      // (e.g., git diff returns 1 if there are changes)
      const execError = error;
      if (execError.stdout || execError.stderr) {
        return {
          stdout: execError.stdout?.trim() || '',
          stderr: execError.stderr?.trim() || execError.message || '',
          failed: true,
        };
      }
      throw error;
    }
  }
  /**
   * Build clone command
   */
  buildCloneCommand(data) {
    let cmd = 'git clone';
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
  buildCommitCommand(data) {
    let cmd = 'git commit';
    if (data.amend) {
      cmd += ' --amend';
    }
    cmd += ` -m "${data.message?.replace(/"/g, '\\"')}"`;
    return cmd;
  }
  /**
   * Build push command
   */
  buildPushCommand(data) {
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
  buildPullCommand(data) {
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
  buildAddCommand(data) {
    return `git add ${data.files?.join(' ')}`;
  }
  /**
   * Build diff command
   */
  buildDiffCommand(data) {
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
  buildLogCommand(data) {
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
  buildBranchCommand(data) {
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
  buildCheckoutCommand(data) {
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
  handleStatus(result, startTime, input) {
    if (result.failed === true) {
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
  handleBranch(result, startTime, input) {
    if (result.failed === true) {
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
  success(content, result, startTime, input, metadata) {
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
  error(message, code) {
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
