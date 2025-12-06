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
import { Agent } from 'agents';
import { AgentMixin } from '../base-agent.js';
import { buildSubagentPrompt } from './delegation-templates.js';
/**
 * Create a Research Subagent class
 */
export function createSubagent(config) {
  const timeoutMs = config.timeoutMs ?? 60000;
  const debug = config.debug ?? false;
  const AgentClass = class Subagent extends Agent {
    initialState = {
      taskId: '',
      sessionId: '',
      toolCallCount: 0,
      maxToolCalls: 10,
      isActive: false,
      createdAt: Date.now(),
      lastActivityAt: Date.now(),
    };
    abortController = null;
    onStateUpdate(state, source) {
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
    async perform(delegationContext, agentContext) {
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
        const env = this.env;
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
          type: 'function',
          function: {
            name: toolName,
            description: `Tool: ${toolName}`,
            parameters: {
              type: 'object',
              properties: {},
              required: [],
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
    getState() {
      return this.state;
    }
    /**
     * Abort current task
     */
    abort() {
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
    extractCitations(content) {
      const citations = [];
      // Match [n] citation references
      const citationRefs = content.matchAll(/\[(\d+)\]/g);
      const refNumbers = new Set();
      for (const match of citationRefs) {
        const num = match[1];
        if (num) {
          refNumbers.add(num);
        }
      }
      // Match source definitions: [n] URL or description
      const sourceRegex = /\[(\d+)\]\s*([^\n]+)/g;
      let match = sourceRegex.exec(content);
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
    parseStructuredOutput(content) {
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
  return AgentClass;
}
/**
 * Create a research-specialized subagent
 */
export function createResearchSubagent(createProvider, options) {
  return createSubagent({
    createProvider,
    subagentType: 'research',
    ...options,
  });
}
/**
 * Create a code-specialized subagent
 */
export function createCodeSubagent(createProvider, options) {
  return createSubagent({
    createProvider,
    subagentType: 'code',
    ...options,
  });
}
/**
 * Create a github-specialized subagent
 */
export function createGitHubSubagent(createProvider, options) {
  return createSubagent({
    createProvider,
    subagentType: 'github',
    ...options,
  });
}
/**
 * Create a general-purpose subagent
 */
export function createGeneralSubagent(createProvider, options) {
  return createSubagent({
    createProvider,
    subagentType: 'general',
    ...options,
  });
}
