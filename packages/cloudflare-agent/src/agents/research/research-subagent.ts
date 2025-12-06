/**
 * Research Subagent
 *
 * A specialized Durable Object agent that handles research tasks
 * with independent context window and parallel tool calling.
 *
 * Key features:
 * - Independent context window (not shared with lead researcher)
 * - Parallel tool calling within the subagent
 * - Structured output to lightweight references
 * - Self-contained timeout handling
 */

import { logger } from '@duyetbot/hono-middleware';
import { Agent, type Connection } from 'agents';
import type { LLMProvider } from '../../types.js';
import { type AgentContext, AgentMixin } from '../base-agent.js';
import { buildSubagentPrompt } from './delegation-templates.js';
import type { Citation, DelegationContext, SubagentResult } from './types.js';

/**
 * Subagent state
 */
export interface SubagentState {
  /** Task ID being processed */
  taskId: string;
  /** Session ID */
  sessionId: string;
  /** Tool calls made */
  toolCallCount: number;
  /** Maximum allowed tool calls */
  maxToolCalls: number;
  /** Whether the subagent is currently active */
  isActive: boolean;
  /** Creation timestamp */
  createdAt: number;
  /** Last activity timestamp */
  lastActivityAt: number;
}

/**
 * Environment for subagent
 */
export interface SubagentEnv {
  /** LLM provider configuration */
  AI_GATEWAY_ACCOUNT_ID?: string;
  AI_GATEWAY_ID?: string;
  ANTHROPIC_API_KEY?: string;
  OPENROUTER_API_KEY?: string;
}

/**
 * Configuration for subagent
 */
export interface SubagentConfig<TEnv extends SubagentEnv> {
  /** Function to create LLM provider from env */
  createProvider: (env: TEnv) => LLMProvider;
  /** Subagent type */
  subagentType: 'research' | 'code' | 'github' | 'general';
  /** Default timeout in ms */
  timeoutMs?: number;
  /** Enable detailed logging */
  debug?: boolean;
}

/**
 * Methods exposed by subagent
 */
export interface SubagentMethods {
  perform(
    delegationContext: DelegationContext,
    agentContext: AgentContext
  ): Promise<SubagentResult>;
  getState(): SubagentState;
  abort(): void;
}

/**
 * Type for Subagent class
 */
export type SubagentClass<TEnv extends SubagentEnv> = typeof Agent<TEnv, SubagentState> & {
  new (
    ...args: ConstructorParameters<typeof Agent<TEnv, SubagentState>>
  ): Agent<TEnv, SubagentState> & SubagentMethods;
};

/**
 * Create a Research Subagent class
 */
export function createSubagent<TEnv extends SubagentEnv>(
  config: SubagentConfig<TEnv>
): SubagentClass<TEnv> {
  const timeoutMs = config.timeoutMs ?? 60000;
  const debug = config.debug ?? false;

  const AgentClass = class Subagent extends Agent<TEnv, SubagentState> {
    override initialState: SubagentState = {
      taskId: '',
      sessionId: '',
      toolCallCount: 0,
      maxToolCalls: 10,
      isActive: false,
      createdAt: Date.now(),
      lastActivityAt: Date.now(),
    };

    private abortController: AbortController | null = null;

    override onStateUpdate(state: SubagentState, source: 'server' | Connection): void {
      if (debug) {
        logger.info(`[Subagent:${config.subagentType}] State updated`, {
          source,
          taskId: state.taskId,
          toolCallCount: state.toolCallCount,
          isActive: state.isActive,
        });
      }
    }

    /**
     * Main task handler - performs the delegated work
     */
    async perform(
      delegationContext: DelegationContext,
      agentContext: AgentContext
    ): Promise<SubagentResult> {
      const startTime = Date.now();
      const taskId = agentContext.traceId ?? AgentMixin.generateId('task');

      // Initialize abort controller for timeout handling
      this.abortController = new AbortController();
      const timeoutId = setTimeout(() => {
        this.abortController?.abort();
      }, timeoutMs);

      try {
        // Update state
        this.setState({
          ...this.state,
          taskId,
          sessionId: agentContext.chatId?.toString() || taskId,
          maxToolCalls: Number.parseInt(delegationContext.scopeLimit.match(/\d+/)?.[0] || '10', 10),
          isActive: true,
          lastActivityAt: Date.now(),
        });

        AgentMixin.log(`Subagent:${config.subagentType}`, 'Starting task', {
          taskId,
          objective: delegationContext.objective.slice(0, 100),
        });

        const env = (this as unknown as { env: TEnv }).env;
        const provider = config.createProvider(env);

        // Build prompts using delegation templates
        const { systemPrompt, userPrompt } = buildSubagentPrompt(
          config.subagentType,
          delegationContext
        );

        // Extract available tools from delegation context
        // Tools will be executed in parallel by the LLM provider
        const availableTools = delegationContext.toolList || [];

        // Build OpenAI-format tool definitions from tool names
        const toolDefinitions = availableTools.map((toolName) => ({
          type: 'function' as const,
          function: {
            name: toolName,
            description: `Tool: ${toolName}`,
            parameters: {
              type: 'object' as const,
              properties: {},
              required: [] as string[],
            },
          },
        }));

        AgentMixin.log(`Subagent:${config.subagentType}`, 'Available tools', {
          taskId,
          toolCount: toolDefinitions.length,
          tools: availableTools.slice(0, 5), // Log first 5 tools
        });

        // Call LLM with tools available for parallel execution
        // The LLM provider handles tool calls - multiple tools can be called in parallel
        const response = await provider.chat(
          [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          toolDefinitions.length > 0 ? toolDefinitions : undefined
        );

        // Check if aborted
        if (this.abortController?.signal.aborted) {
          throw new Error('Task timed out');
        }

        // Track tool execution if any tools were called
        if (response.toolCalls && response.toolCalls.length > 0) {
          this.setState({
            ...this.state,
            toolCallCount: this.state.toolCallCount + response.toolCalls.length,
            lastActivityAt: Date.now(),
          });

          AgentMixin.log(`Subagent:${config.subagentType}`, 'Tools executed in parallel', {
            taskId,
            toolCallCount: response.toolCalls.length,
            totalToolsCalled: this.state.toolCallCount + response.toolCalls.length,
          });
        }

        // Extract citations if output format requires it
        const citations =
          delegationContext.outputFormat === 'citations'
            ? this.extractCitations(response.content)
            : [];

        // Parse structured data if needed
        const data =
          delegationContext.outputFormat === 'structured'
            ? this.parseStructuredOutput(response.content)
            : undefined;

        const durationMs = Date.now() - startTime;

        // Update state
        this.setState({
          ...this.state,
          isActive: false,
          lastActivityAt: Date.now(),
        });

        AgentMixin.log(`Subagent:${config.subagentType}`, 'Task completed', {
          taskId,
          durationMs,
          toolCallCount: this.state.toolCallCount,
        });

        return {
          taskId,
          success: true,
          content: response.content,
          data,
          error: undefined,
          citations,
          toolCallCount: this.state.toolCallCount,
          durationMs,
          tokensUsed: undefined, // Local LLMResponse doesn't include usage
        };
      } catch (error) {
        const durationMs = Date.now() - startTime;

        // Update state
        this.setState({
          ...this.state,
          isActive: false,
          lastActivityAt: Date.now(),
        });

        AgentMixin.logError(`Subagent:${config.subagentType}`, 'Task failed', error, {
          taskId,
          durationMs,
        });

        return {
          taskId,
          success: false,
          content: undefined,
          data: undefined,
          error: error instanceof Error ? error.message : String(error),
          citations: [],
          toolCallCount: this.state.toolCallCount,
          durationMs,
          tokensUsed: undefined,
        };
      } finally {
        clearTimeout(timeoutId);
        this.abortController = null;
      }
    }

    /**
     * Get current state
     */
    getState(): SubagentState {
      return this.state;
    }

    /**
     * Abort current task
     */
    abort(): void {
      if (this.abortController) {
        this.abortController.abort();
        AgentMixin.log(`Subagent:${config.subagentType}`, 'Task aborted', {
          taskId: this.state.taskId,
        });
      }
    }

    /**
     * Extract citations from content
     */
    private extractCitations(content: string): Citation[] {
      const citations: Citation[] = [];

      // Match [n] citation references
      const citationRefs = content.matchAll(/\[(\d+)\]/g);
      const refNumbers = new Set<string>();
      for (const match of citationRefs) {
        const num = match[1];
        if (num) {
          refNumbers.add(num);
        }
      }

      // Match source definitions: [n] URL or description
      const sourceRegex = /\[(\d+)\]\s*([^\n]+)/g;
      let match: RegExpExecArray | null = sourceRegex.exec(content);

      while (match !== null) {
        const num = match[1];
        const source = match[2];
        if (num && source && refNumbers.has(num)) {
          citations.push({
            id: AgentMixin.generateId('cite'),
            source: source.trim(),
            content: '',
            confidence: 0.8,
            timestamp: Date.now(),
          });
        }
        match = sourceRegex.exec(content);
      }

      return citations;
    }

    /**
     * Parse structured output from content
     */
    private parseStructuredOutput(content: string): unknown {
      try {
        // Try to extract JSON from response
        const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (jsonMatch?.[1]) {
          return JSON.parse(jsonMatch[1].trim());
        }

        // Try parsing the whole content as JSON
        const directMatch = content.match(/\{[\s\S]*\}/);
        if (directMatch) {
          return JSON.parse(directMatch[0]);
        }
      } catch {
        // Return as string if parsing fails
      }

      return { raw: content };
    }
  };

  return AgentClass as SubagentClass<TEnv>;
}

/**
 * Create a research-specialized subagent
 */
export function createResearchSubagent<TEnv extends SubagentEnv>(
  createProvider: (env: TEnv) => LLMProvider,
  options?: { timeoutMs?: number; debug?: boolean }
): SubagentClass<TEnv> {
  return createSubagent({
    createProvider,
    subagentType: 'research',
    ...options,
  });
}

/**
 * Create a code-specialized subagent
 */
export function createCodeSubagent<TEnv extends SubagentEnv>(
  createProvider: (env: TEnv) => LLMProvider,
  options?: { timeoutMs?: number; debug?: boolean }
): SubagentClass<TEnv> {
  return createSubagent({
    createProvider,
    subagentType: 'code',
    ...options,
  });
}

/**
 * Create a github-specialized subagent
 */
export function createGitHubSubagent<TEnv extends SubagentEnv>(
  createProvider: (env: TEnv) => LLMProvider,
  options?: { timeoutMs?: number; debug?: boolean }
): SubagentClass<TEnv> {
  return createSubagent({
    createProvider,
    subagentType: 'github',
    ...options,
  });
}

/**
 * Create a general-purpose subagent
 */
export function createGeneralSubagent<TEnv extends SubagentEnv>(
  createProvider: (env: TEnv) => LLMProvider,
  options?: { timeoutMs?: number; debug?: boolean }
): SubagentClass<TEnv> {
  return createSubagent({
    createProvider,
    subagentType: 'general',
    ...options,
  });
}
