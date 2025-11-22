/**
 * Agent Handler
 *
 * Creates and executes agent for GitHub bot tasks using Claude Agent SDK
 */

import { createDefaultOptions, query, toSDKTools } from '@duyetbot/core';
import { type GitHubClient, createGitHubTool, getAllBuiltinTools } from '@duyetbot/tools';
import type { Tool } from '@duyetbot/types';
import { Octokit } from '@octokit/rest';
import { GitHubSessionManager, createMCPClient } from './session-manager.js';
import { loadAndRenderTemplate } from './template-loader.js';
import type { BotConfig, MentionContext } from './types.js';

/**
 * Adapter to convert Octokit to GitHubClient interface
 */
function createOctokitAdapter(octokit: Octokit): GitHubClient {
  return {
    request: async (method: string, url: string, options?: Record<string, unknown>) => {
      const response = await octokit.request(`${method} ${url}`, options);
      return { data: response.data, status: response.status };
    },
  };
}

/**
 * Build system prompt for GitHub context
 */
export function buildSystemPrompt(context: MentionContext): string {
  // Prepare template context with pre-computed values
  const templateContext: Record<string, unknown> = {
    repository: context.repository,
    task: context.task,
    mentionedBy: context.mentionedBy,
  };

  // Add pull request context if present
  if (context.pullRequest) {
    templateContext.pullRequest = context.pullRequest;
  }

  // Add issue context if present (and no PR, since PR takes precedence in template)
  if (context.issue && !context.pullRequest) {
    templateContext.issue = {
      ...context.issue,
      // Pre-compute labels string for template
      labelsString: context.issue.labels.map((l) => l.name).join(', '),
    };
  }

  return loadAndRenderTemplate('system-prompt.txt', templateContext);
}

/**
 * Handle mention and generate response using Claude Agent SDK
 */
export async function handleMention(context: MentionContext, config: BotConfig): Promise<string> {
  const octokit = new Octokit({ auth: config.githubToken });
  const systemPrompt = buildSystemPrompt(context);

  // Initialize session manager with MCP client if configured
  let sessionManager: GitHubSessionManager;
  if (config.mcpServerUrl) {
    const mcpClient = createMCPClient(config.mcpServerUrl, config.mcpAuthToken);
    sessionManager = new GitHubSessionManager(mcpClient);
  } else {
    sessionManager = new GitHubSessionManager();
  }

  // Get or create session based on context
  let session: Awaited<ReturnType<typeof sessionManager.getPRSession>>;
  if (context.pullRequest) {
    session = await sessionManager.getPRSession(
      context.repository,
      context.pullRequest.number,
      context.pullRequest.title
    );
  } else if (context.issue) {
    session = await sessionManager.getIssueSession(
      context.repository,
      context.issue.number,
      context.issue.title
    );
  } else {
    // Fallback for unknown context
    session = {
      sessionId: `github:${context.repository.full_name}:unknown:${Date.now()}`,
      messages: [],
      metadata: {
        type: 'issue' as const,
        repository: {
          owner: context.repository.owner.login,
          name: context.repository.name,
          fullName: context.repository.full_name,
        },
        number: 0,
        title: undefined,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    };
  }

  // Add the user's message to the session
  await sessionManager.appendMessage(session.sessionId, 'user', context.task);

  // Create GitHub tool with Octokit adapter
  const githubClient = createOctokitAdapter(octokit);
  const githubToolDef = createGitHubTool(githubClient, {
    owner: context.repository.owner.login,
    repo: context.repository.name,
  });

  // Get all built-in tools and add GitHub tool
  const builtinTools = getAllBuiltinTools();

  // Create a Tool-compatible wrapper for the GitHub tool
  const githubTool: Tool = {
    name: githubToolDef.name,
    description: githubToolDef.description,
    inputSchema: githubToolDef.inputSchema,
    execute: async (input: { content: string | Record<string, unknown> }) => {
      const result = await githubToolDef.execute(
        input.content as Parameters<typeof githubToolDef.execute>[0]
      );
      return {
        status: result.success ? ('success' as const) : ('error' as const),
        content: result.success
          ? JSON.stringify(result.data, null, 2)
          : result.error || 'Unknown error',
        ...(result.error && { error: { message: result.error } }),
      };
    },
  };

  // Convert all tools to SDK format
  const allTools = [...builtinTools, githubTool];
  const sdkTools = toSDKTools(allTools);

  // Create query options
  const queryOptions = createDefaultOptions({
    model: config.model || 'sonnet',
    sessionId: session.sessionId,
    systemPrompt,
    tools: sdkTools,
  });

  // Execute agent using SDK streaming
  let response = '';
  try {
    for await (const message of query(context.task, queryOptions)) {
      switch (message.type) {
        case 'assistant':
          if (message.content) {
            response = message.content;
          }
          break;
        case 'result':
          // Final result - use this as the complete response
          if (message.content) {
            response = message.content;
          }
          break;
        // Ignore tool_use and tool_result messages - they're intermediate
      }
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    response = `I encountered an error while processing your request: ${errorMessage}

Please try again or contact @duyet for assistance.`;
  }

  // Save assistant response to session
  await sessionManager.appendMessage(session.sessionId, 'assistant', response);

  return response;
}
