/**
 * Deployment Tool
 *
 * Provides autonomous deployment capabilities:
 * - Run build commands
 * - Run tests
 * - Deploy to Cloudflare Workers
 * - Deploy to Cloudflare Pages
 * - Verify deployment health
 *
 * This enables the agent to autonomously build, test, and deploy its own changes.
 */

import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import type { Tool, ToolInput, ToolOutput } from '@duyetbot/types';
import { ToolExecutionError } from '@duyetbot/types';
import { z } from 'zod';

const execAsync = promisify(exec);

// =============================================================================
// Input Schemas (Zod)
// =============================================================================

/**
 * Schema for run_build tool
 */
const runBuildInputSchema = z.object({
  cwd: z.string().optional(),
  command: z.string().optional(),
  package: z.string().optional(),
});

/**
 * Schema for run_tests tool
 */
const runTestsInputSchema = z.object({
  cwd: z.string().optional(),
  command: z.string().optional(),
  pattern: z.string().optional(),
  watch: z.boolean().optional(),
});

/**
 * Schema for deploy_cloudflare tool
 */
const deployCloudflareInputSchema = z.object({
  cwd: z.string().optional(),
  target: z.enum(['workers', 'pages', 'telegram', 'github', 'shared-agents', 'memory-mcp', 'all']),
  env: z.enum(['production', 'staging', 'development']).optional(),
  dryRun: z.boolean().optional(),
});

/**
 * Schema for health_check tool
 */
const healthCheckInputSchema = z.object({
  url: z.string().url('URL must be valid'),
  expectedStatus: z.number().int().positive().optional(),
  timeout: z.number().int().positive().optional(),
});

/**
 * Schema for type_check tool
 */
const typeCheckInputSchema = z.object({
  cwd: z.string().optional(),
  package: z.string().optional(),
});

/**
 * Schema for lint tool
 */
const lintInputSchema = z.object({
  cwd: z.string().optional(),
  fix: z.boolean().optional(),
});

/**
 * Schema for ci_pipeline tool
 */
const ciPipelineInputSchema = z.object({
  cwd: z.string().optional(),
  skipTests: z.boolean().optional(),
  skipDeploy: z.boolean().optional(),
  deployTarget: z.enum(['all', 'telegram', 'github', 'shared-agents', 'memory-mcp']).optional(),
});

// =============================================================================
// Tool Implementations
// =============================================================================

/**
 * Run build tool
 *
 * Executes build commands with proper error handling.
 */
export class RunBuildTool implements Tool {
  name = 'run_build';
  description =
    'Run build commands. Supports monorepo builds and single package builds. ' +
    'Returns build output and success status.';
  inputSchema = runBuildInputSchema;

  validate(input: ToolInput): boolean {
    const result = this.inputSchema.safeParse(input.content);
    return result.success;
  }

  async execute(input: ToolInput): Promise<ToolOutput> {
    const startTime = Date.now();

    try {
      const parsed = this.inputSchema.parse(input.content);
      const { cwd = '.', command, package: pkg } = parsed;

      let buildCommand = command || 'bun run build';

      if (pkg) {
        buildCommand = `cd packages/${pkg} && bun run build`;
      }

      const { stdout, stderr } = await execAsync(buildCommand, {
        cwd,
        timeout: 300000, // 5 minutes
      });

      if (stderr?.toLowerCase().includes('error')) {
        return {
          status: 'error',
          content: 'Build failed with errors',
          error: {
            message: stderr,
            code: 'BUILD_ERROR',
          },
          metadata: {
            stdout,
            stderr,
            command: buildCommand,
            duration: Date.now() - startTime,
          },
        };
      }

      return {
        status: 'success',
        content: stdout || 'Build completed successfully',
        metadata: {
          package: pkg || 'all',
          buildTime: Date.now(),
          command: buildCommand,
          duration: Date.now() - startTime,
        },
      };
    } catch (error) {
      return {
        status: 'error',
        content: 'Build execution failed',
        error: {
          message: error instanceof Error ? error.message : String(error),
          code: 'BUILD_EXECUTION_ERROR',
        },
      };
    }
  }
}

/**
 * Run tests tool
 *
 * Executes test commands with pattern matching support.
 */
export class RunTestsTool implements Tool {
  name = 'run_tests';
  description =
    'Run test commands. Supports pattern filtering and watch mode. ' +
    'Returns test results and coverage information.';
  inputSchema = runTestsInputSchema;

  validate(input: ToolInput): boolean {
    const result = this.inputSchema.safeParse(input.content);
    return result.success;
  }

  async execute(input: ToolInput): Promise<ToolOutput> {
    const startTime = Date.now();

    try {
      const parsed = this.inputSchema.parse(input.content);
      const { cwd = '.', command, pattern, watch = false } = parsed;

      let testCommand = command || 'bun run test';

      if (pattern) {
        testCommand = `bun run test -- ${pattern}`;
      }

      if (watch) {
        testCommand += ' -- --watch';
      }

      const { stdout, stderr } = await execAsync(testCommand, {
        cwd,
        timeout: 300000, // 5 minutes
      });

      const hasFailures = stderr.toLowerCase().includes('fail');

      if (hasFailures) {
        return {
          status: 'error',
          content: stdout || 'Tests failed',
          error: {
            message: 'Some tests failed',
            code: 'TEST_FAILURE',
          },
          metadata: {
            pattern,
            watch,
            command: testCommand,
            duration: Date.now() - startTime,
          },
        };
      }

      return {
        status: 'success',
        content: stdout || 'Tests completed',
        metadata: {
          pattern,
          watch,
          command: testCommand,
          duration: Date.now() - startTime,
        },
      };
    } catch (error) {
      return {
        status: 'error',
        content: 'Test execution failed',
        error: {
          message: error instanceof Error ? error.message : String(error),
          code: 'TEST_EXECUTION_ERROR',
        },
      };
    }
  }
}

/**
 * Deploy to Cloudflare tool
 *
 * Deploys applications to Cloudflare Workers or Pages.
 */
export class DeployCloudflareTool implements Tool {
  name = 'deploy_cloudflare';
  description =
    'Deploy applications to Cloudflare. Supports Workers, Pages, and specific apps. ' +
    'Can deploy to different environments (production, staging).';
  inputSchema = deployCloudflareInputSchema;

  validate(input: ToolInput): boolean {
    const result = this.inputSchema.safeParse(input.content);
    return result.success;
  }

  async execute(input: ToolInput): Promise<ToolOutput> {
    const startTime = Date.now();

    try {
      const parsed = this.inputSchema.parse(input.content);
      const { cwd = '.', target, env, dryRun = false } = parsed;

      if (dryRun) {
        return {
          status: 'success',
          content: 'Dry run - deployment skipped',
          metadata: {
            target,
            env,
            dryRun: true,
          },
        };
      }

      let deployCommand: string;

      switch (target) {
        case 'telegram':
          deployCommand = 'bun run deploy:telegram';
          break;
        case 'github':
          deployCommand = 'bun run deploy:github';
          break;
        case 'shared-agents':
          deployCommand = 'bun run deploy:shared';
          break;
        case 'memory-mcp':
          deployCommand = 'bun run deploy:memory-mcp';
          break;
        case 'all':
          deployCommand = 'bun run deploy';
          break;
        default:
          deployCommand = `bun run deploy:${target}`;
      }

      if (env && env !== 'production') {
        deployCommand += ` --env ${env}`;
      }

      const { stdout, stderr } = await execAsync(deployCommand, {
        cwd,
        timeout: 600000, // 10 minutes
      });

      if (stderr?.toLowerCase().includes('error')) {
        return {
          status: 'error',
          content: 'Deployment failed',
          error: {
            message: stderr,
            code: 'DEPLOY_ERROR',
          },
          metadata: {
            stdout,
            stderr,
            target,
            duration: Date.now() - startTime,
          },
        };
      }

      const urlMatch = stdout.match(/(https:\/\/[^\s]+)/);
      const deployedUrl = urlMatch ? urlMatch[1] : undefined;

      return {
        status: 'success',
        content: stdout || 'Deployment completed',
        metadata: {
          target,
          env,
          deployedUrl,
          deployTime: Date.now(),
          duration: Date.now() - startTime,
        },
      };
    } catch (error) {
      return {
        status: 'error',
        content: 'Deployment execution failed',
        error: {
          message: error instanceof Error ? error.message : String(error),
          code: 'DEPLOY_EXECUTION_ERROR',
        },
      };
    }
  }
}

/**
 * Health check tool
 *
 * Performs health checks on deployed applications.
 */
export class HealthCheckTool implements Tool {
  name = 'health_check';
  description =
    'Perform health check on a deployed application. ' +
    'Returns status, response time, and availability.';
  inputSchema = healthCheckInputSchema;

  validate(input: ToolInput): boolean {
    const result = this.inputSchema.safeParse(input.content);
    return result.success;
  }

  async execute(input: ToolInput): Promise<ToolOutput> {
    try {
      const parsed = this.inputSchema.parse(input.content);
      const { url, expectedStatus = 200, timeout = 30000 } = parsed;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const response = await fetch(url, {
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      const isHealthy = response.status === expectedStatus;

      if (isHealthy) {
        return {
          status: 'success',
          content: 'Health check passed',
          metadata: {
            url,
            status: response.status,
            statusText: response.statusText,
            isHealthy: true,
            expectedStatus,
            responseTime: Date.now(),
          },
        };
      }

      return {
        status: 'error',
        content: 'Health check failed',
        error: {
          message: `Expected status ${expectedStatus}, got ${response.status}`,
          code: 'UNHEALTHY',
        },
        metadata: {
          url,
          status: response.status,
          statusText: response.statusText,
          isHealthy: false,
          expectedStatus,
          responseTime: Date.now(),
        },
      };
    } catch (error) {
      return {
        status: 'error',
        content: 'Health check failed',
        error: {
          message: error instanceof Error ? error.message : String(error),
          code: 'HEALTH_CHECK_ERROR',
        },
      };
    }
  }
}

/**
 * Type check tool
 *
 * Runs TypeScript type checking.
 */
export class TypeCheckTool implements Tool {
  name = 'type_check';
  description = 'Run TypeScript type checking. Returns type errors if any.';
  inputSchema = typeCheckInputSchema;

  validate(input: ToolInput): boolean {
    const result = this.inputSchema.safeParse(input.content);
    return result.success;
  }

  async execute(input: ToolInput): Promise<ToolOutput> {
    const startTime = Date.now();

    try {
      const parsed = this.inputSchema.parse(input.content);
      const { cwd = '.', package: pkg } = parsed;

      let command = 'bun run type-check';

      if (pkg) {
        command = `cd packages/${pkg} && bun run type-check`;
      }

      const { stdout, stderr } = await execAsync(command, {
        cwd,
        timeout: 120000, // 2 minutes
      });

      const hasErrors = stderr.toLowerCase().includes('error');

      if (hasErrors) {
        return {
          status: 'error',
          content: stdout || 'Type errors found',
          error: {
            message: stderr,
            code: 'TYPE_ERROR',
          },
          metadata: {
            package: pkg || 'all',
            duration: Date.now() - startTime,
          },
        };
      }

      return {
        status: 'success',
        content: stdout || 'Type check completed',
        metadata: {
          package: pkg || 'all',
          duration: Date.now() - startTime,
        },
      };
    } catch (error) {
      return {
        status: 'error',
        content: 'Type check execution failed',
        error: {
          message: error instanceof Error ? error.message : String(error),
          code: 'TYPE_CHECK_EXECUTION_ERROR',
        },
      };
    }
  }
}

/**
 * Lint tool
 *
 * Runs linting and optionally fixes issues.
 */
export class LintTool implements Tool {
  name = 'lint';
  description = 'Run linting. Can optionally fix issues automatically.';
  inputSchema = lintInputSchema;

  validate(input: ToolInput): boolean {
    const result = this.inputSchema.safeParse(input.content);
    return result.success;
  }

  async execute(input: ToolInput): Promise<ToolOutput> {
    const startTime = Date.now();

    try {
      const parsed = this.inputSchema.parse(input.content);
      const { cwd = '.', fix = false } = parsed;

      const command = fix ? 'bun run lint:fix' : 'bun run lint';

      const { stdout } = await execAsync(command, {
        cwd,
        timeout: 120000, // 2 minutes
      });

      return {
        status: 'success',
        content: stdout || 'Linting completed',
        metadata: {
          fix,
          duration: Date.now() - startTime,
        },
      };
    } catch (error) {
      return {
        status: 'error',
        content: 'Lint execution failed',
        error: {
          message: error instanceof Error ? error.message : String(error),
          code: 'LINT_EXECUTION_ERROR',
        },
      };
    }
  }
}

/**
 * CI Pipeline tool
 *
 * Runs complete CI pipeline: type check -> lint -> test -> deploy
 */
export class CIPipelineTool implements Tool {
  name = 'ci_pipeline';
  description =
    'Run complete CI pipeline: type check -> lint -> test -> deploy. ' +
    'Use for autonomous deployment with validation.';
  inputSchema = ciPipelineInputSchema;

  validate(input: ToolInput): boolean {
    const result = this.inputSchema.safeParse(input.content);
    return result.success;
  }

  async execute(input: ToolInput): Promise<ToolOutput> {
    const startTime = Date.now();
    const results: Record<string, unknown> = {};

    try {
      const parsed = this.inputSchema.parse(input.content);
      const { cwd = '.', skipTests, skipDeploy, deployTarget } = parsed;

      // Step 1: Type check
      const typeCheckResult = await typeCheckTool.execute({ content: { cwd } });
      results.typeCheck = typeCheckResult;

      if (typeCheckResult.status === 'error') {
        return {
          status: 'error',
          content: 'CI pipeline failed at type check',
          error: {
            message: 'Type check failed',
            code: 'TYPE_CHECK_FAILED',
          },
          metadata: {
            stage: 'type_check',
            results,
            duration: Date.now() - startTime,
          },
        };
      }

      // Step 2: Lint
      const lintResult = await lintTool.execute({ content: { cwd, fix: false } });
      results.lint = lintResult;

      if (lintResult.status === 'error') {
        return {
          status: 'error',
          content: 'CI pipeline failed at lint',
          error: {
            message: 'Lint failed',
            code: 'LINT_FAILED',
          },
          metadata: {
            stage: 'lint',
            results,
            duration: Date.now() - startTime,
          },
        };
      }

      // Step 3: Tests
      if (!skipTests) {
        const testResult = await runTestsTool.execute({ content: { cwd } });
        results.tests = testResult;

        if (testResult.status === 'error') {
          return {
            status: 'error',
            content: 'CI pipeline failed at tests',
            error: {
              message: 'Tests failed',
              code: 'TESTS_FAILED',
            },
            metadata: {
              stage: 'tests',
              results,
              duration: Date.now() - startTime,
            },
          };
        }
      }

      // Step 4: Deploy
      if (!skipDeploy && deployTarget) {
        const deployResult = await deployCloudflareTool.execute({
          content: { cwd, target: deployTarget },
        });
        results.deploy = deployResult;

        if (deployResult.status === 'error') {
          return {
            status: 'error',
            content: 'CI pipeline failed at deploy',
            error: {
              message: 'Deployment failed',
              code: 'DEPLOY_FAILED',
            },
            metadata: {
              stage: 'deploy',
              results,
              duration: Date.now() - startTime,
            },
          };
        }
      }

      return {
        status: 'success',
        content: 'CI pipeline completed successfully',
        metadata: {
          results,
          stagesCompleted: Object.keys(results).length,
          duration: Date.now() - startTime,
        },
      };
    } catch (error) {
      throw new ToolExecutionError(
        'ci_pipeline',
        error instanceof Error ? error.message : 'Unknown error',
        'CI_PIPELINE_ERROR',
        error instanceof Error ? error : undefined
      );
    }
  }
}

// =============================================================================
// Single Instances (for backwards compatibility)
// =============================================================================

export const runBuildTool = new RunBuildTool();
export const runTestsTool = new RunTestsTool();
export const deployCloudflareTool = new DeployCloudflareTool();
export const healthCheckTool = new HealthCheckTool();
export const typeCheckTool = new TypeCheckTool();
export const lintTool = new LintTool();
export const ciPipelineTool = new CIPipelineTool();

// =============================================================================
// Legacy Type Exports (for backwards compatibility)
// =============================================================================

export interface RunBuildInput {
  cwd?: string;
  command?: string;
  package?: string;
}

export interface RunTestsInput {
  cwd?: string;
  command?: string;
  pattern?: string;
  watch?: boolean;
}

export interface DeployCloudflareInput {
  cwd?: string;
  target: 'workers' | 'pages' | 'telegram' | 'github' | 'shared-agents' | 'memory-mcp' | 'all';
  env?: 'production' | 'staging' | 'development';
  dryRun?: boolean;
}

export interface HealthCheckInput {
  url: string;
  expectedStatus?: number;
  timeout?: number;
}

export interface TypeCheckInput {
  cwd?: string;
  package?: string;
}

export interface LintInput {
  cwd?: string;
  fix?: boolean;
}

export interface CIPipelineInput {
  cwd?: string;
  skipTests?: boolean;
  skipDeploy?: boolean;
  deployTarget?: DeployCloudflareInput['target'];
}
