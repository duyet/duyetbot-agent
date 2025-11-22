/**
 * Agent Handler
 *
 * Handles GitHub bot mentions using ChatAgent with tools
 */

import { ChatAgent, type LLMMessage } from '@duyetbot/chat-agent';
import type { Octokit } from '@octokit/rest';
import {
  type EnhancedContext,
  fetchEnhancedContext,
  formatEnhancedContext,
} from './context-fetcher.js';
import { logger } from './logger.js';
import { createOpenRouterProvider } from './provider.js';
import { GitHubSessionManager, createMCPClient } from './session-manager.js';
import { loadAndRenderTemplate } from './template-loader.js';
import { createToolExecutor, githubTools } from './tools/index.js';
import type { BotConfig, MentionContext } from './types.js';

/**
 * Build system prompt for GitHub context
 */
export function buildSystemPrompt(
  context: MentionContext,
  enhancedContext?: EnhancedContext
): string {
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

  // Add enhanced context if available
  if (enhancedContext) {
    templateContext.enhancedContext = formatEnhancedContext(enhancedContext);
  }

  return loadAndRenderTemplate('system-prompt.txt', templateContext);
}

/**
 * Handle mention and generate response using LLM provider
 */
export async function handleMention(
  context: MentionContext,
  config: BotConfig,
  octokit?: Octokit
): Promise<string> {
  const repo = context.repository.full_name;
  const issueNumber = context.issue?.number || context.pullRequest?.number;

  logger.info('mention_received', {
    repository: repo,
    issue: issueNumber,
    mentionedBy: context.mentionedBy.login,
    task: context.task.substring(0, 100),
    hasPR: !!context.pullRequest,
  });

  // Fetch enhanced context if Octokit is provided
  let enhancedContext: EnhancedContext | undefined;
  if (octokit) {
    try {
      enhancedContext = await fetchEnhancedContext(
        octokit,
        context.repository,
        context.issue?.number,
        context.pullRequest?.number
      );
      logger.debug('enhanced_context_fetched', {
        repository: repo,
        issue: issueNumber,
      });
    } catch (error) {
      logger.error('enhanced_context_error', {
        repository: repo,
        issue: issueNumber,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const systemPrompt = buildSystemPrompt(context, enhancedContext);

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

  // Create LLM provider using AI Gateway
  if (!config.AI || !config.AI_GATEWAY_NAME) {
    throw new Error('AI Gateway configuration is required');
  }

  const provider = createOpenRouterProvider({
    AI: config.AI,
    AI_GATEWAY_NAME: config.AI_GATEWAY_NAME,
    AI_GATEWAY_PROVIDER: config.AI_GATEWAY_PROVIDER,
    AI_GATEWAY_API_KEY: config.AI_GATEWAY_API_KEY,
    MODEL: config.model,
  });

  // Create ChatAgent with tools if Octokit is available
  let response = '';
  const startTime = Date.now();

  try {
    if (octokit) {
      // Use ChatAgent with tools for full agent capabilities
      const toolExecutor = createToolExecutor({
        octokit,
        mentionContext: context,
      });

      const agent = new ChatAgent({
        llmProvider: provider,
        systemPrompt,
        maxHistory: 30,
        tools: githubTools,
        onToolCall: toolExecutor,
      });

      // Restore session messages
      if (session.messages.length > 0) {
        agent.setMessages(
          session.messages.map((m) => ({
            role: m.role as 'user' | 'assistant',
            content: m.content,
          }))
        );
      }

      logger.info('agent_execution_start', {
        repository: repo,
        issue: issueNumber,
        model: config.model,
        sessionMessages: session.messages.length,
      });

      // Agent handles tool calls internally
      response = await agent.chat(context.task);

      logger.info('agent_execution_complete', {
        repository: repo,
        issue: issueNumber,
        durationMs: Date.now() - startTime,
        responseLength: response.length,
      });
    } else {
      // Fallback to direct LLM call without tools
      const messages: LLMMessage[] = [
        { role: 'system', content: systemPrompt },
        ...session.messages.map((m) => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
        })),
        { role: 'user', content: context.task },
      ];

      logger.info('llm_direct_call', {
        repository: repo,
        issue: issueNumber,
        model: config.model,
      });

      const result = await provider.chat(messages);
      response = result.content || 'I was unable to generate a response.';
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    logger.error('agent_execution_error', {
      repository: repo,
      issue: issueNumber,
      error: errorMessage,
      durationMs: Date.now() - startTime,
      stack: error instanceof Error ? error.stack : undefined,
    });

    response = `I encountered an error while processing your request: ${errorMessage}

Please try again or contact @duyet for assistance.`;
  }

  // Save assistant response to session
  await sessionManager.appendMessage(session.sessionId, 'assistant', response);

  return response;
}
