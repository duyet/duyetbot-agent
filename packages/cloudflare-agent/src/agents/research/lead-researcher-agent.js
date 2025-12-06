/**
 * Lead Researcher Agent
 *
 * Orchestrates multi-agent research by:
 * 1. Analyzing query complexity and determining effort level
 * 2. Creating a research plan with parallel subagent tasks
 * 3. Spawning and coordinating subagents
 * 4. Synthesizing results with source attribution
 *
 * Extends BaseAgent and uses ExecutionContext for improved tracing,
 * context propagation, and multi-agent coordination.
 *
 * Based on Anthropic's multi-agent research system architecture:
 * https://www.anthropic.com/engineering/multi-agent-research-system
 */
import { randomUUID } from 'node:crypto';
import { logger } from '@duyetbot/hono-middleware';
import { Agent, getAgentByName } from 'agents';
import { BaseAgent } from '../../base/base-agent.js';
import { agentRegistry } from '../registry.js';

// =============================================================================
// Agent Self-Registration
// =============================================================================
/**
 * Register LeadResearcherAgent with the agent registry.
 * This agent handles research queries that require web search, documentation lookup,
 * current events, news, and comparative analysis.
 *
 * Priority is 60 (higher than duyet at 50) to ensure "Latest AI News?" routes here
 * instead of to duyet-info-agent. The key patterns focus on:
 * - Current events and news keywords
 * - Research and comparison phrases
 * - Documentation and lookup requests
 */
agentRegistry.register({
  name: 'lead-researcher-agent',
  description:
    'Performs web research, fetches news, current events, documentation lookup, and comparative analysis. Handles any query requiring up-to-date information from the internet.',
  examples: [
    'latest AI news',
    "today's tech news",
    'current events',
    'compare React vs Vue',
    'what happened today',
    'latest news about OpenAI',
    'research best practices for TypeScript',
    'find documentation for Cloudflare Workers',
  ],
  triggers: {
    // Patterns for news and current events - higher priority than duyet
    patterns: [
      /\b(latest|recent|current|today|breaking)\b.*(news|headlines?|events?|updates?|developments?)\b/i,
      /\b(news|headlines?)\b.*(latest|today|current|recent)\b/i,
      /\bai\s+news\b/i,
      /\btech\s+news\b/i,
      /\bwhat('s|s|\s+is)\s+(happening|new|going\s+on)\b/i,
      /\b(research|find|look\s+up|search\s+for)\s+(information|docs?|documentation)\b/i,
      /\bcompare\s+.+\s+(vs|versus|with|to|and)\s+/i,
    ],
    keywords: ['news', 'current events', 'latest', 'today', 'research', 'compare', 'versus'],
    categories: ['research'],
  },
  capabilities: {
    tools: ['web_search', 'docs_lookup', 'fetch_url'],
    complexity: 'medium',
  },
  priority: 60, // Higher than duyet (50) to catch "latest news" queries
});

import { createErrorResult, createSuccessResult } from '../../base/base-types.js';
import { estimateEffortLevel, getEffortConfigFromEstimate } from '../../config/effort-config.js';
import {
  buildSubagentPrompt,
  formatDependencyContext,
  getDefaultBoundaries,
  getDefaultToolGuidance,
} from './delegation-templates.js';
import { createTrace, createTraceLogger, globalPerformanceMonitor } from './observability.js';
/**
 * Create a Lead Researcher Agent class
 *
 * Creates a specialized agent that extends BaseAgent and coordinates multi-agent research
 * operations using ExecutionContext for proper tracing and context propagation.
 */
export function createLeadResearcherAgent(config) {
  const maxHistory = config.maxHistory ?? 50;
  const debug = config.debug ?? false;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const AgentClass = class LeadResearcherAgent extends BaseAgent {
    initialState = {
      sessionId: '',
      currentPlan: undefined,
      researchHistory: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    onStateUpdate(state, source) {
      if (debug) {
        logger.info('[LeadResearcherAgent] State updated', {
          source,
          hasPlan: !!state.currentPlan,
          historyCount: state.researchHistory.length,
        });
      }
    }
    /**
     * Main research entry point
     *
     * Conducts multi-agent research by:
     * 1. Estimating query complexity and effort level
     * 2. Creating a decomposed research plan
     * 3. Executing subagent tasks in parallel (respecting dependencies)
     * 4. Synthesizing results with proper attribution
     *
     * @param ctx - ExecutionContext containing the user's query and conversation history
     * @param classification - Optional query classification for routing hints
     * @returns AgentResult with research findings and execution metadata
     */
    async research(ctx, classification) {
      const startTime = Date.now();
      const traceId = ctx.traceId;
      // Create research trace for observability
      const trace = createTrace(traceId, ctx.query);
      const traceLogger = createTraceLogger(traceId, 'LeadResearcherAgent');
      await this.updateThinking(ctx, 'Planning research strategy');
      traceLogger.info('Starting research', {
        queryLength: ctx.query.length,
        classification: classification?.category,
        spanId: ctx.spanId,
      });
      try {
        const env = this.env;
        const provider = config.createProvider(env);
        // Step 1: Estimate effort level
        const effortEstimate = this.estimateEffort(ctx.query, classification);
        const effortConfig = getEffortConfigFromEstimate(effortEstimate);
        traceLogger.info('Effort estimated', {
          level: effortEstimate.level,
          recommendedSubagents: effortEstimate.recommendedSubagents,
          maxToolCalls: effortEstimate.maxToolCalls,
        });
        // Step 2: Create research plan
        const plan = await this.createResearchPlan(
          ctx.query,
          effortEstimate,
          effortConfig,
          provider,
          traceId
        );
        // Update state with current plan
        this.setState({
          ...this.state,
          currentPlan: plan,
          sessionId: this.state.sessionId || ctx.chatId.toString() || traceId,
          updatedAt: Date.now(),
        });
        await this.updateThinking(ctx, 'Executing research plan');
        traceLogger.info('Research plan created', {
          planId: plan.planId,
          subagentCount: plan.subagentTasks.length,
          spanId: ctx.spanId,
        });
        // Update trace with plan info
        trace.subagentCount = plan.subagentTasks.length;
        // Step 3: Run subagents in parallel
        const subagentResults = await this.runSubagents(plan, ctx, effortConfig, traceId, env);
        // Track subagent results in trace
        trace.totalToolCalls = subagentResults.reduce((sum, r) => sum + r.toolCallCount, 0);
        // Step 4: Synthesize results
        await this.updateThinking(ctx, 'Synthesizing findings');
        const researchResult = await this.synthesizeResults(
          plan,
          subagentResults,
          provider,
          startTime,
          traceId
        );
        const durationMs = Date.now() - startTime;
        // Update history
        this.updateHistory(plan, researchResult);
        // Record execution span in debug
        this.recordExecution(ctx, 'lead-researcher-agent', durationMs);
        // Complete trace for observability recording
        trace.endTime = Date.now();
        trace.durationMs = trace.endTime - trace.startTime;
        trace.succeeded = true;
        trace.subagentMetrics = subagentResults.map((r) => {
          const duration = r.durationMs || 0;
          const metrics = {
            id: r.taskId,
            startTime: startTime + duration / 2, // Approximate start time
            endTime: startTime + duration,
            durationMs: r.durationMs,
            toolCalls: r.toolCallCount,
            status: r.success ? 'success' : 'failed',
          };
          if (r.tokensUsed !== undefined) {
            metrics.tokensUsed = r.tokensUsed;
          }
          if (r.error !== undefined) {
            metrics.error = r.error;
          }
          return metrics;
        });
        // Record trace for performance monitoring
        globalPerformanceMonitor.recordTrace(trace);
        traceLogger.info('Research completed', {
          planId: plan.planId,
          durationMs,
          successCount: researchResult.summary.successCount,
          failureCount: researchResult.summary.failureCount,
          parallelEfficiency: `${(researchResult.summary.parallelEfficiency * 100).toFixed(1)}%`,
          totalToolCalls: trace.totalToolCalls,
          spanId: ctx.spanId,
        });
        return createSuccessResult(researchResult.response, durationMs, {
          data: {
            planId: plan.planId,
            summary: researchResult.summary,
            citations: researchResult.citations,
            traceId, // Include trace ID for correlation
          },
          nextAction: 'complete',
        });
      } catch (err) {
        const durationMs = Date.now() - startTime;
        const error = err instanceof Error ? err : new Error(String(err));
        // Record execution span in debug
        this.recordExecution(ctx, 'lead-researcher-agent', durationMs);
        // Record failed trace
        trace.endTime = Date.now();
        trace.durationMs = trace.endTime - trace.startTime;
        trace.succeeded = false;
        trace.error = error.message;
        globalPerformanceMonitor.recordTrace(trace);
        traceLogger.error('Research failed', error, {
          durationMs,
          spanId: ctx.spanId,
        });
        return createErrorResult(error, durationMs);
      }
    }
    /**
     * Estimate effort level based on query and classification
     */
    estimateEffort(query, classification) {
      const complexity = classification?.complexity ?? 'medium';
      const category = classification?.category ?? 'general';
      return estimateEffortLevel(complexity, category, query.length);
    }
    /**
     * Create a research plan by decomposing the query
     *
     * Uses the LLM to analyze the query and create a decomposed plan
     * with parallel subagent tasks.
     *
     * @param query - Research query to decompose
     * @param effortEstimate - Estimated effort level for this query
     * @param effortConfig - Effort configuration constraints
     * @param provider - LLM provider for planning
     * @param traceId - Trace ID for observability
     * @returns ResearchPlan with decomposed tasks
     */
    async createResearchPlan(query, effortEstimate, effortConfig, provider, traceId) {
      const planId = `plan_${randomUUID()}`;
      // Use LLM to decompose the query into parallel tasks
      const planningPrompt = this.buildPlanningPrompt(query, effortEstimate, effortConfig);
      const response = await provider.chat([
        {
          role: 'system',
          content: this.getPlanningSystemPrompt(),
        },
        { role: 'user', content: planningPrompt },
      ]);
      // Parse the plan from LLM response
      const tasks = this.parsePlanResponse(response.content, effortConfig, traceId);
      return {
        planId,
        query,
        strategy: this.extractStrategy(response.content),
        subagentTasks: tasks,
        synthesisInstructions: this.extractSynthesisInstructions(response.content),
        effortEstimate,
        createdAt: Date.now(),
      };
    }
    /**
     * Get system prompt for planning
     */
    getPlanningSystemPrompt() {
      return `You are a research planning specialist. Your role is to decompose complex queries into parallel tasks that can be run by specialized subagents.

Available subagent types:
- research: Web search, documentation lookup, fact-finding
- code: Code analysis, generation, review
- github: GitHub operations (PRs, issues, comments)
- general: General purpose tasks

Output format (JSON):
{
  "strategy": "Brief description of the overall approach",
  "tasks": [
    {
      "id": "unique_task_id",
      "type": "research|code|github|general",
      "objective": "Clear, specific objective for this task",
      "outputFormat": "text|structured|code|citations|actions",
      "priority": 1-10,
      "dependsOn": ["task_id_1", "task_id_2"],
      "successCriteria": "How to determine if this task succeeded"
    }
  ],
  "synthesisInstructions": "How to combine the results from all tasks"
}

Guidelines:
1. Maximize parallelism - minimize dependencies between tasks
2. Each task should be independently runnable
3. Keep tasks focused and specific
4. Consider which tasks can run simultaneously
5. Higher priority tasks should be more critical to the final answer`;
    }
    /**
     * Build the planning prompt
     */
    buildPlanningPrompt(query, effortEstimate, effortConfig) {
      return `## Query
${query}

## Resource Constraints
- Maximum subagents: ${effortConfig.maxSubagents}
- Maximum total tool calls: ${effortConfig.maxToolCalls}
- Effort level: ${effortEstimate.level}
- Expected duration: ${effortEstimate.expectedDuration}

## Instructions
Create a research plan that:
1. Decomposes this query into ${Math.min(effortConfig.maxSubagents, 5)} or fewer parallel tasks
2. Maximizes information gathering within the tool call budget
3. Ensures tasks can be synthesized into a comprehensive answer

Respond with a JSON object following the specified format.`;
    }
    /**
     * Parse LLM response into subagent tasks
     */
    parsePlanResponse(response, effortConfig, traceId) {
      try {
        // Extract JSON from response
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
          return this.createFallbackTasks(effortConfig);
        }
        const parsed = JSON.parse(jsonMatch[0]);
        const tasks = [];
        for (const task of parsed.tasks || []) {
          const subagentType = this.validateSubagentType(task.type);
          const outputFormat = this.validateOutputFormat(task.outputFormat);
          tasks.push({
            id: task.id || `task_${randomUUID()}`,
            type: subagentType,
            objective: task.objective || 'Complete the assigned task',
            outputFormat,
            toolGuidance: getDefaultToolGuidance(subagentType),
            boundaries: getDefaultBoundaries(subagentType),
            maxToolCalls: Math.min(task.maxToolCalls || 10, effortConfig.maxToolCallsPerSubagent),
            priority: Math.max(1, Math.min(10, task.priority || 5)),
            dependsOn: Array.isArray(task.dependsOn) ? task.dependsOn : [],
            successCriteria: task.successCriteria || 'Task completed successfully',
          });
        }
        // Enforce subagent limit
        return tasks.slice(0, effortConfig.maxSubagents);
      } catch (error) {
        logger.error('[LeadResearcherAgent] Failed to parse plan', {
          traceId,
          error: error instanceof Error ? error.message : String(error),
        });
        return this.createFallbackTasks(effortConfig);
      }
    }
    /**
     * Create fallback tasks when planning fails
     *
     * Returns a single general-purpose task when LLM plan parsing fails.
     *
     * @param effortConfig - Effort configuration for resource limits
     * @returns Array with single fallback task
     */
    createFallbackTasks(effortConfig) {
      return [
        {
          id: `task_${randomUUID()}`,
          type: 'general',
          objective: "Complete the user's request to the best of your ability",
          outputFormat: 'text',
          toolGuidance: getDefaultToolGuidance('general'),
          boundaries: getDefaultBoundaries('general'),
          maxToolCalls: effortConfig.maxToolCallsPerSubagent,
          priority: 5,
          dependsOn: [],
          successCriteria: 'User request addressed',
        },
      ];
    }
    /**
     * Validate and normalize subagent type
     */
    validateSubagentType(type) {
      const valid = ['research', 'code', 'github', 'general'];
      return valid.includes(type) ? type : 'general';
    }
    /**
     * Validate and normalize output format
     */
    validateOutputFormat(format) {
      const valid = ['text', 'structured', 'code', 'citations', 'actions'];
      return valid.includes(format) ? format : 'text';
    }
    /**
     * Extract strategy from plan response
     */
    extractStrategy(response) {
      try {
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          return parsed.strategy || 'Run tasks and synthesize results';
        }
      } catch {
        // Ignore parsing errors
      }
      return 'Run tasks and synthesize results';
    }
    /**
     * Extract synthesis instructions from plan response
     */
    extractSynthesisInstructions(response) {
      try {
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          return parsed.synthesisInstructions || 'Combine results into a comprehensive response';
        }
      } catch {
        // Ignore parsing errors
      }
      return 'Combine results into a comprehensive response';
    }
    /**
     * Run subagents in parallel based on dependencies
     *
     * Executes research subagent tasks, respecting task dependencies.
     * Tasks are grouped by dependency level and executed sequentially at each level,
     * with parallelism within each level.
     *
     * @param plan - Research plan with tasks to execute
     * @param parentCtx - Parent ExecutionContext for tracing
     * @param _effortConfig - Effort configuration (currently unused)
     * @param traceId - Trace ID for observability
     * @param env - Environment bindings for subagent access
     * @returns Array of subagent results
     */
    async runSubagents(plan, parentCtx, _effortConfig, traceId, env) {
      const results = new Map();
      const tasksByLevel = this.groupTasksByDependencyLevel(plan.subagentTasks);
      logger.debug('[LeadResearcherAgent] Running subagents', {
        traceId,
        spanId: parentCtx.spanId,
        levelCount: tasksByLevel.length,
        taskCounts: tasksByLevel.map((l) => l.length),
      });
      // Run each level sequentially, tasks within level in parallel
      for (const levelTasks of tasksByLevel) {
        // Build dependency context for this level
        const previousResults = new Map();
        for (const [taskId, result] of results) {
          const entry = {
            success: result.success,
          };
          if (result.content !== undefined) {
            entry.content = result.content;
          }
          if (result.data !== undefined) {
            entry.data = result.data;
          }
          previousResults.set(taskId, entry);
        }
        // Run all tasks in this level in parallel with child contexts
        const levelPromises = levelTasks.map((task) => {
          const childCtx = this.createChildContext(parentCtx);
          return this.runSubagent(task, previousResults, childCtx, traceId, env);
        });
        const levelResults = await Promise.allSettled(levelPromises);
        // Collect results
        for (let i = 0; i < levelTasks.length; i++) {
          const task = levelTasks[i];
          const result = levelResults[i];
          if (!task || !result) {
            continue;
          }
          if (result.status === 'fulfilled') {
            results.set(task.id, result.value);
          } else {
            results.set(task.id, {
              taskId: task.id,
              success: false,
              content: undefined,
              data: undefined,
              error: result.reason?.message || 'Task failed',
              citations: [],
              toolCallCount: 0,
              durationMs: 0,
              tokensUsed: undefined,
            });
          }
        }
      }
      return Array.from(results.values());
    }
    /**
     * Group tasks by dependency level for parallel running
     */
    groupTasksByDependencyLevel(tasks) {
      const levels = [];
      const processed = new Set();
      while (processed.size < tasks.length) {
        const level = [];
        for (const task of tasks) {
          if (processed.has(task.id)) {
            continue;
          }
          // Check if all dependencies are processed
          const depsProcessed = task.dependsOn.every((dep) => processed.has(dep));
          if (depsProcessed) {
            level.push(task);
          }
        }
        if (level.length === 0 && processed.size < tasks.length) {
          // Circular dependency or missing dependency - add remaining tasks
          for (const task of tasks) {
            if (!processed.has(task.id)) {
              level.push(task);
            }
          }
        }
        for (const task of level) {
          processed.add(task.id);
        }
        if (level.length > 0) {
          levels.push(level);
        }
      }
      return levels;
    }
    /**
     * Run a single subagent
     *
     * Executes a single research task, either by delegating to a Durable Object
     * subagent namespace or by running inline with the LLM.
     *
     * @param task - Subagent task to execute
     * @param previousResults - Results from dependencies (if any)
     * @param childCtx - Child ExecutionContext for tracing
     * @param traceId - Trace ID for observability
     * @param env - Environment bindings for subagent access
     * @returns SubagentResult with execution details
     */
    async runSubagent(task, previousResults, childCtx, traceId, env) {
      const startTime = Date.now();
      try {
        // Build delegation context
        const delegationContext = {
          objective: task.objective,
          outputFormat: task.outputFormat,
          toolList: this.getToolsForType(task.type),
          toolGuidance: task.toolGuidance,
          mustDo: [task.successCriteria],
          mustNotDo: task.boundaries,
          scopeLimit: `Maximum ${task.maxToolCalls} tool calls`,
          successCriteria: task.successCriteria,
          previousContext: formatDependencyContext(previousResults),
        };
        // Get the appropriate subagent namespace
        const namespace = this.getSubagentNamespace(env, task.type);
        if (namespace) {
          // Via Durable Object subagent
          const subagentId = `${traceId}_${task.id}`;
          const subagent = await getAgentByName(namespace, subagentId);
          const result = await subagent.perform(delegationContext, childCtx);
          return {
            ...result,
            taskId: task.id,
            durationMs: Date.now() - startTime,
          };
        }
        // Fallback: inline with LLM
        return this.runSubagentInline(task, delegationContext, childCtx, traceId, env, startTime);
      } catch (error) {
        return {
          taskId: task.id,
          success: false,
          content: undefined,
          data: undefined,
          error: error instanceof Error ? error.message : String(error),
          citations: [],
          toolCallCount: 0,
          durationMs: Date.now() - startTime,
          tokensUsed: undefined,
        };
      }
    }
    /**
     * Run subagent inline when Durable Object is not available
     *
     * Falls back to executing the subagent task inline with the LLM provider
     * when a Durable Object namespace is not configured.
     *
     * @param task - Subagent task to execute
     * @param delegationContext - Task context and constraints
     * @param _childCtx - Child ExecutionContext (unused in inline mode)
     * @param _traceId - Trace ID (unused in inline mode)
     * @param env - Environment bindings for LLM provider
     * @param startTime - Task start time for duration calculation
     * @returns SubagentResult from inline execution
     */
    async runSubagentInline(task, delegationContext, _childCtx, _traceId, env, startTime) {
      const provider = config.createProvider(env);
      const { systemPrompt, userPrompt } = buildSubagentPrompt(task.type, delegationContext);
      const response = await provider.chat([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ]);
      // Extract citations if output format is citations
      const citations =
        task.outputFormat === 'citations' ? this.extractCitations(response.content) : [];
      return {
        taskId: task.id,
        success: true,
        content: response.content,
        data: undefined,
        error: undefined,
        citations,
        toolCallCount: 0, // No tool calls in inline mode
        durationMs: Date.now() - startTime,
        tokensUsed: undefined, // Local LLMResponse doesn't include usage
      };
    }
    /**
     * Get subagent namespace by type
     */
    getSubagentNamespace(env, type) {
      switch (type) {
        case 'research':
          return env.ResearchSubagent;
        case 'code':
          return env.CodeSubagent;
        case 'github':
          return env.GitHubSubagent;
        case 'general':
          return env.GeneralSubagent;
        default:
          return undefined;
      }
    }
    /**
     * Get available tools for a subagent type
     */
    getToolsForType(type) {
      switch (type) {
        case 'research':
          return ['web_search', 'fetch_url', 'read_documentation'];
        case 'code':
          return ['read_file', 'write_file', 'run_command', 'git'];
        case 'github':
          return ['get_pr', 'create_comment', 'get_issue', 'list_files', 'get_diff'];
        case 'general':
          return ['web_search', 'fetch_url'];
        default:
          return [];
      }
    }
    /**
     * Extract citations from response content
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
      // Match source definitions
      const sourceRegex = /\[(\d+)\]\s*([^\n]+)/g;
      let match = sourceRegex.exec(content);
      while (match !== null) {
        const num = match[1];
        const source = match[2];
        if (num && source && refNumbers.has(num)) {
          citations.push({
            id: `cite_${randomUUID()}`,
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
     * Synthesize results from all subagents
     */
    async synthesizeResults(plan, subagentResults, provider, startTime, _traceId) {
      // Calculate statistics
      const successCount = subagentResults.filter((r) => r.success).length;
      const failureCount = subagentResults.length - successCount;
      const totalToolCalls = subagentResults.reduce((sum, r) => sum + r.toolCallCount, 0);
      const totalDurationMs = Date.now() - startTime;
      // Calculate parallel efficiency
      const sequentialEstimate = subagentResults.reduce((sum, r) => sum + r.durationMs, 0);
      const parallelEfficiency = sequentialEstimate > 0 ? totalDurationMs / sequentialEstimate : 1;
      // Aggregate citations
      const citations = [];
      for (const result of subagentResults) {
        citations.push(...result.citations);
      }
      // Synthesize response using LLM
      const synthesisPrompt = this.buildSynthesisPrompt(plan, subagentResults, citations);
      const response = await provider.chat([
        {
          role: 'system',
          content: `You are synthesizing research results from multiple subagents.
Combine their findings into a comprehensive, well-structured response.
${plan.synthesisInstructions}

Guidelines:
- Include all relevant information from subagents
- Maintain citations from the original results
- Highlight key findings and conclusions
- Note any conflicts or uncertainties
- Be comprehensive but concise`,
        },
        { role: 'user', content: synthesisPrompt },
      ]);
      return {
        planId: plan.planId,
        response: response.content,
        summary: {
          subagentCount: subagentResults.length,
          successCount,
          failureCount,
          totalToolCalls,
          totalDurationMs,
          parallelEfficiency,
        },
        subagentResults,
        citations,
        errors: subagentResults.filter((r) => r.error).map((r) => r.error),
      };
    }
    /**
     * Build synthesis prompt
     */
    buildSynthesisPrompt(plan, results, citations) {
      const parts = [`## Original Query\n${plan.query}`, `## Research Strategy\n${plan.strategy}`];
      // Add subagent results
      parts.push('## Subagent Results');
      for (const result of results) {
        const task = plan.subagentTasks.find((t) => t.id === result.taskId);
        const status = result.success ? 'SUCCESS' : 'FAILED';
        parts.push(`### ${task?.objective || result.taskId} [${status}]`);
        if (result.success && result.content) {
          parts.push(result.content);
        } else if (result.error) {
          parts.push(`Error: ${result.error}`);
        }
      }
      // Add citations if any
      if (citations.length > 0) {
        parts.push('## Sources');
        citations.forEach((c, i) => {
          parts.push(`[${i + 1}] ${c.source}`);
        });
      }
      parts.push(
        '## Instructions\nSynthesize the above results into a comprehensive response to the original query.'
      );
      return parts.join('\n\n');
    }
    /**
     * Update research history
     */
    updateHistory(plan, result) {
      this.setState({
        ...this.state,
        currentPlan: undefined,
        researchHistory: [
          ...this.state.researchHistory.slice(-(maxHistory - 1)),
          {
            planId: plan.planId,
            query: plan.query,
            summary: result.summary,
            timestamp: Date.now(),
          },
        ],
        updatedAt: Date.now(),
      });
    }
    /**
     * Get current research plan
     */
    getCurrentPlan() {
      return this.state.currentPlan;
    }
    /**
     * Get research statistics
     */
    getStats() {
      const history = this.state.researchHistory;
      if (history.length === 0) {
        return {
          totalResearched: 0,
          avgSubagentCount: 0,
          avgDurationMs: 0,
          parallelEfficiency: 0,
        };
      }
      const totalSubagents = history.reduce((sum, h) => sum + h.summary.subagentCount, 0);
      const totalDuration = history.reduce((sum, h) => sum + h.summary.totalDurationMs, 0);
      const totalEfficiency = history.reduce((sum, h) => sum + h.summary.parallelEfficiency, 0);
      return {
        totalResearched: history.length,
        avgSubagentCount: totalSubagents / history.length,
        avgDurationMs: totalDuration / history.length,
        parallelEfficiency: totalEfficiency / history.length,
      };
    }
    /**
     * Clear research history
     */
    clearHistory() {
      this.setState({
        ...this.state,
        researchHistory: [],
        currentPlan: undefined,
        updatedAt: Date.now(),
      });
    }
  };
  return AgentClass;
}
