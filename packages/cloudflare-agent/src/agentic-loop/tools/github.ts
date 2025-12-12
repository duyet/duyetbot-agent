/**
 * GitHub Tool for Agentic Loop
 *
 * Provides GitHub operations (list PRs, show issues, repo info, etc.) via MCP server.
 * Wraps the GitHub MCP server at api.githubcopilot.com for edge deployment.
 *
 * Features:
 * - Query PRs, issues, repository information
 * - Check workflow/action status
 * - Search across repositories
 * - Graceful timeout handling (5s default)
 * - Fallback responses when MCP is unavailable
 *
 * @see https://api.githubcopilot.com for MCP server documentation
 */

import { logger } from '@duyetbot/hono-middleware';
import type { LoopContext, LoopTool, ToolResult } from '../types.js';

/**
 * GitHub tool configuration
 */
interface GitHubToolConfig {
  /** MCP server timeout in milliseconds (default: 5000) */
  timeoutMs?: number;
  /** Default repository in owner/repo format (optional) */
  defaultRepo?: string;
}

/**
 * GitHub MCP action type
 */
type GitHubAction =
  | 'list_prs'
  | 'get_pr'
  | 'list_issues'
  | 'get_issue'
  | 'get_repo'
  | 'list_workflows'
  | 'search';

/**
 * GitHub tool arguments
 */
interface GitHubToolArgs {
  action: GitHubAction;
  query?: string;
  repo?: string;
  number?: number;
}

/**
 * Create the GitHub tool for agentic loop
 *
 * @param config - Optional configuration
 * @returns LoopTool definition
 *
 * @example
 * ```typescript
 * const githubTool = createGitHubTool({
 *   timeoutMs: 5000,
 *   defaultRepo: 'duyetbot-agent'
 * });
 *
 * executor.register(githubTool);
 * ```
 */
export function createGitHubTool(config: GitHubToolConfig = {}): LoopTool {
  const { timeoutMs = 5000, defaultRepo } = config;

  const tool: LoopTool = {
    name: 'github',
    description:
      'GitHub operations: list PRs, show issues, get repository info, check workflow status. Use for queries like "my open PRs", "PR #123 status", "list issues".',
    parameters: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: [
            'list_prs',
            'get_pr',
            'list_issues',
            'get_issue',
            'get_repo',
            'list_workflows',
            'search',
          ],
          description: 'GitHub operation to perform',
        },
        query: {
          type: 'string',
          description: 'Search query or identifier (PR number, repo name, etc.)',
        },
        repo: {
          type: 'string',
          description: 'Repository in owner/repo format (optional, uses default if not specified)',
        },
        number: {
          type: 'number',
          description: 'PR or issue number (for get_pr and get_issue actions)',
        },
      },
      required: ['action'],
    },

    execute: async (args, ctx): Promise<ToolResult> => {
      const startTime = Date.now();

      try {
        // Parse and validate arguments
        const toolArgs = args as Partial<GitHubToolArgs>;
        const action = toolArgs.action as GitHubAction | undefined;

        if (!action) {
          return {
            success: false,
            output: 'Missing required argument: action',
            error: 'Missing required argument: action',
            durationMs: Date.now() - startTime,
          };
        }

        // TODO: Wire up MCP client from execution context
        // When available, extract from: ctx.executionContext.mcp or similar
        // const mcpClient = ctx.executionContext.mcp;

        // For now, return a stub implementation
        const result = await executeGitHubAction(
          action,
          toolArgs as GitHubToolArgs,
          defaultRepo,
          timeoutMs,
          ctx
        );

        return {
          ...result,
          durationMs: Date.now() - startTime,
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);

        logger.error('[GitHubTool] Execution failed', {
          error: errorMessage,
          duration: Date.now() - startTime,
        });

        return {
          success: false,
          output: `GitHub tool error: ${errorMessage}`,
          error: errorMessage,
          durationMs: Date.now() - startTime,
        };
      }
    },
  };

  return tool;
}

/**
 * Execute a GitHub action
 *
 * @param action - GitHub action to perform
 * @param args - Tool arguments
 * @param defaultRepo - Default repository to use
 * @param timeoutMs - MCP timeout in milliseconds
 * @param ctx - Loop execution context
 * @returns Tool result
 */
async function executeGitHubAction(
  action: GitHubAction,
  args: GitHubToolArgs,
  defaultRepo: string | undefined,
  _timeoutMs: number,
  _ctx: LoopContext
): Promise<Omit<ToolResult, 'durationMs'>> {
  // TODO: Implement actual MCP client calls once wired up
  // This is a stub that demonstrates the expected flow
  // _timeoutMs will be used for MCP client timeout configuration
  // _ctx will provide access to execution context and MCP client when wired up

  switch (action) {
    case 'list_prs': {
      const repo = args.repo || defaultRepo || 'duyetbot-agent';
      const query = args.query || '';

      // TODO: Call MCP client
      // const response = await mcpClient.call('github_list_prs', {
      //   repo,
      //   query,
      //   state: 'open'
      // }, { timeout: timeoutMs });

      return {
        success: true,
        output: `Listing open PRs for repository ${repo}${query ? ` matching "${query}"` : ''}.\n\nNote: MCP integration pending.`,
        data: {
          action,
          repo,
          query,
          message: 'MCP client not yet wired up - stub implementation',
        },
      };
    }

    case 'get_pr': {
      const repo = args.repo || defaultRepo || 'duyetbot-agent';
      const number = args.number;

      if (number === undefined) {
        return {
          success: false,
          output: 'PR number is required for get_pr action',
          error: 'Missing PR number argument',
        };
      }

      // TODO: Call MCP client
      // const response = await mcpClient.call('github_get_pr', {
      //   repo,
      //   number
      // }, { timeout: timeoutMs });

      return {
        success: true,
        output: `Getting details for PR #${number} in repository ${repo}.\n\nNote: MCP integration pending.`,
        data: {
          action,
          repo,
          number,
          message: 'MCP client not yet wired up - stub implementation',
        },
      };
    }

    case 'list_issues': {
      const repo = args.repo || defaultRepo || 'duyetbot-agent';
      const query = args.query || '';

      // TODO: Call MCP client
      // const response = await mcpClient.call('github_list_issues', {
      //   repo,
      //   query,
      //   state: 'open'
      // }, { timeout: timeoutMs });

      return {
        success: true,
        output: `Listing open issues for repository ${repo}${query ? ` matching "${query}"` : ''}.\n\nNote: MCP integration pending.`,
        data: {
          action,
          repo,
          query,
          message: 'MCP client not yet wired up - stub implementation',
        },
      };
    }

    case 'get_issue': {
      const repo = args.repo || defaultRepo || 'duyetbot-agent';
      const number = args.number;

      if (number === undefined) {
        return {
          success: false,
          output: 'Issue number is required for get_issue action',
          error: 'Missing issue number argument',
        };
      }

      // TODO: Call MCP client
      // const response = await mcpClient.call('github_get_issue', {
      //   repo,
      //   number
      // }, { timeout: timeoutMs });

      return {
        success: true,
        output: `Getting details for issue #${number} in repository ${repo}.\n\nNote: MCP integration pending.`,
        data: {
          action,
          repo,
          number,
          message: 'MCP client not yet wired up - stub implementation',
        },
      };
    }

    case 'get_repo': {
      const repo = args.repo || defaultRepo || 'duyetbot-agent';

      // TODO: Call MCP client
      // const response = await mcpClient.call('github_get_repo', {
      //   repo
      // }, { timeout: timeoutMs });

      return {
        success: true,
        output: `Getting repository information for ${repo}.\n\nNote: MCP integration pending.`,
        data: {
          action,
          repo,
          message: 'MCP client not yet wired up - stub implementation',
        },
      };
    }

    case 'list_workflows': {
      const repo = args.repo || defaultRepo || 'duyetbot-agent';

      // TODO: Call MCP client
      // const response = await mcpClient.call('github_list_workflows', {
      //   repo,
      //   status: 'latest'
      // }, { timeout: timeoutMs });

      return {
        success: true,
        output: `Listing workflow runs for repository ${repo}.\n\nNote: MCP integration pending.`,
        data: {
          action,
          repo,
          message: 'MCP client not yet wired up - stub implementation',
        },
      };
    }

    case 'search': {
      const query = args.query;

      if (!query) {
        return {
          success: false,
          output: 'Search query is required for search action',
          error: 'Missing search query argument',
        };
      }

      // TODO: Call MCP client
      // const response = await mcpClient.call('github_search', {
      //   query,
      //   type: 'repositories' // or 'issues', 'code'
      // }, { timeout: timeoutMs });

      return {
        success: true,
        output: `Searching GitHub for: "${query}".\n\nNote: MCP integration pending.`,
        data: {
          action,
          query,
          message: 'MCP client not yet wired up - stub implementation',
        },
      };
    }

    default: {
      const unknownAction = action as string;
      return {
        success: false,
        output: `Unknown GitHub action: ${unknownAction}`,
        error: `Unsupported action: ${unknownAction}`,
      };
    }
  }
}

/**
 * Export singleton instance with default configuration
 *
 * @example
 * ```typescript
 * executor.register(githubTool);
 * ```
 */
export const githubTool = createGitHubTool();
