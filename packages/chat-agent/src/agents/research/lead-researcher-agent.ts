/**
 * Lead Researcher Agent
 *
 * Orchestrates multi-agent research by:
 * 1. Analyzing query complexity and determining effort level
 * 2. Creating a research plan with parallel subagent tasks
 * 3. Spawning and coordinating subagents
 * 4. Synthesizing results with source attribution
 *
 * Based on Anthropic's multi-agent research system architecture:
 * https://www.anthropic.com/engineering/multi-agent-research-system
 */

import { logger } from '@duyetbot/hono-middleware';
import { Agent, type AgentNamespace, type Connection, getAgentByName } from 'agents';
import {
  type EffortConfig,
  type EffortEstimate,
  estimateEffortLevel,
  getEffortConfigFromEstimate,
} from '../../config/effort-config.js';
import type { QueryClassification } from '../../routing/schemas.js';
import type { LLMProvider } from '../../types.js';
import { type AgentContext, AgentMixin, type AgentResult } from '../base-agent.js';
import {
  buildSubagentPrompt,
  formatDependencyContext,
  getDefaultBoundaries,
  getDefaultToolGuidance,
} from './delegation-templates.js';
import {
  type ExecutionMetrics,
  createTrace,
  createTraceLogger,
  globalPerformanceMonitor,
} from './observability.js';
import type {
  Citation,
  DelegationContext,
  LeadResearcherState,
  ResearchPlan,
  ResearchResult,
  SubagentResult,
  SubagentTask,
  SubagentType,
} from './types.js';

/**
 * Environment bindings for lead researcher agent
 */
export interface LeadResearcherEnv {
  /** LLM provider configuration */
  AI_GATEWAY_ACCOUNT_ID?: string;
  AI_GATEWAY_ID?: string;
  ANTHROPIC_API_KEY?: string;
  OPENROUTER_API_KEY?: string;

  /** Subagent bindings */
  ResearchSubagent?: AgentNamespace<Agent<LeadResearcherEnv, unknown>>;
  CodeSubagent?: AgentNamespace<Agent<LeadResearcherEnv, unknown>>;
  GitHubSubagent?: AgentNamespace<Agent<LeadResearcherEnv, unknown>>;
  GeneralSubagent?: AgentNamespace<Agent<LeadResearcherEnv, unknown>>;
}

/**
 * Configuration for lead researcher agent
 */
export interface LeadResearcherConfig<TEnv extends LeadResearcherEnv> {
  /** Function to create LLM provider from env */
  createProvider: (env: TEnv) => LLMProvider;
  /** Maximum research history to keep */
  maxHistory?: number;
  /** Enable detailed logging */
  debug?: boolean;
  /** Default effort level if estimation fails */
  defaultEffortLevel?: 'minimal' | 'standard' | 'thorough' | 'exhaustive';
}

/**
 * Methods exposed by LeadResearcherAgent
 */
export interface LeadResearcherMethods {
  research(
    query: string,
    context: AgentContext,
    classification?: QueryClassification
  ): Promise<AgentResult>;
  getCurrentPlan(): ResearchPlan | undefined;
  getStats(): {
    totalResearched: number;
    avgSubagentCount: number;
    avgDurationMs: number;
    parallelEfficiency: number;
  };
  clearHistory(): void;
}

/**
 * Type for LeadResearcherAgent class
 */
export type LeadResearcherAgentClass<TEnv extends LeadResearcherEnv> = typeof Agent<
  TEnv,
  LeadResearcherState
> & {
  new (
    ...args: ConstructorParameters<typeof Agent<TEnv, LeadResearcherState>>
  ): Agent<TEnv, LeadResearcherState> & LeadResearcherMethods;
};

/**
 * Create a Lead Researcher Agent class
 */
export function createLeadResearcherAgent<TEnv extends LeadResearcherEnv>(
  config: LeadResearcherConfig<TEnv>
): LeadResearcherAgentClass<TEnv> {
  const maxHistory = config.maxHistory ?? 50;
  const debug = config.debug ?? false;

  const AgentClass = class LeadResearcherAgent extends Agent<TEnv, LeadResearcherState> {
    override initialState: LeadResearcherState = {
      sessionId: '',
      currentPlan: undefined,
      researchHistory: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    override onStateUpdate(state: LeadResearcherState, source: 'server' | Connection): void {
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
     */
    async research(
      query: string,
      context: AgentContext,
      classification?: QueryClassification
    ): Promise<AgentResult> {
      const startTime = Date.now();
      const traceId = context.traceId ?? AgentMixin.generateId('trace');

      // Create research trace for observability
      const trace = createTrace(traceId, query);
      const traceLogger = createTraceLogger(traceId, 'LeadResearcherAgent');

      traceLogger.info('Starting research', {
        queryLength: query.length,
        classification: classification?.category,
      });

      try {
        const env = (this as unknown as { env: TEnv }).env;
        const provider = config.createProvider(env);

        // Step 1: Estimate effort level
        const effortEstimate = this.estimateEffort(query, classification);
        const effortConfig = getEffortConfigFromEstimate(effortEstimate);

        traceLogger.info('Effort estimated', {
          level: effortEstimate.level,
          recommendedSubagents: effortEstimate.recommendedSubagents,
          maxToolCalls: effortEstimate.maxToolCalls,
        });

        // Step 2: Create research plan
        const plan = await this.createResearchPlan(
          query,
          effortEstimate,
          effortConfig,
          provider,
          traceId
        );

        // Update state with current plan
        this.setState({
          ...this.state,
          currentPlan: plan,
          sessionId: this.state.sessionId || context.chatId?.toString() || traceId,
          updatedAt: Date.now(),
        });

        traceLogger.info('Research plan created', {
          planId: plan.planId,
          subagentCount: plan.subagentTasks.length,
        });

        // Update trace with plan info
        trace.subagentCount = plan.subagentTasks.length;

        // Step 3: Run subagents in parallel
        const subagentResults = await this.runSubagents(plan, context, effortConfig, traceId, env);

        // Track subagent results in trace
        trace.totalToolCalls = subagentResults.reduce((sum, r) => sum + r.toolCallCount, 0);

        // Step 4: Synthesize results
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

        // Complete trace for observability recording
        trace.endTime = Date.now();
        trace.durationMs = trace.endTime - trace.startTime;
        trace.succeeded = true;
        trace.subagentMetrics = subagentResults.map((r) => {
          const duration = r.durationMs || 0;
          const metrics: ExecutionMetrics = {
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
        });

        return AgentMixin.createResult(true, researchResult.response, durationMs, {
          data: {
            planId: plan.planId,
            summary: researchResult.summary,
            citations: researchResult.citations,
            traceId, // Include trace ID for correlation
          },
          nextAction: 'complete',
        });
      } catch (error) {
        const durationMs = Date.now() - startTime;

        // Record failed trace
        trace.endTime = Date.now();
        trace.durationMs = trace.endTime - trace.startTime;
        trace.succeeded = false;
        trace.error = error instanceof Error ? error.message : String(error);
        globalPerformanceMonitor.recordTrace(trace);

        traceLogger.error('Research failed', error, {
          durationMs,
        });

        return AgentMixin.createErrorResult(error, durationMs);
      }
    }

    /**
     * Estimate effort level based on query and classification
     */
    private estimateEffort(query: string, classification?: QueryClassification): EffortEstimate {
      const complexity = classification?.complexity ?? 'medium';
      const category = classification?.category ?? 'general';

      return estimateEffortLevel(complexity, category, query.length);
    }

    /**
     * Create a research plan with subagent tasks
     */
    private async createResearchPlan(
      query: string,
      effortEstimate: EffortEstimate,
      effortConfig: EffortConfig,
      provider: LLMProvider,
      traceId: string
    ): Promise<ResearchPlan> {
      const planId = AgentMixin.generateId('plan');

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
    private getPlanningSystemPrompt(): string {
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
    private buildPlanningPrompt(
      query: string,
      effortEstimate: EffortEstimate,
      effortConfig: EffortConfig
    ): string {
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
    private parsePlanResponse(
      response: string,
      effortConfig: EffortConfig,
      traceId: string
    ): SubagentTask[] {
      try {
        // Extract JSON from response
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
          return this.createFallbackTasks(effortConfig);
        }

        const parsed = JSON.parse(jsonMatch[0]);
        const tasks: SubagentTask[] = [];

        for (const task of parsed.tasks || []) {
          const subagentType = this.validateSubagentType(task.type);
          const outputFormat = this.validateOutputFormat(task.outputFormat);

          tasks.push({
            id: task.id || AgentMixin.generateId('task'),
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
        AgentMixin.logError('LeadResearcherAgent', 'Failed to parse plan', error, { traceId });
        return this.createFallbackTasks(effortConfig);
      }
    }

    /**
     * Create fallback tasks when planning fails
     */
    private createFallbackTasks(effortConfig: EffortConfig): SubagentTask[] {
      return [
        {
          id: AgentMixin.generateId('task'),
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
    private validateSubagentType(type: string): SubagentType {
      const valid: SubagentType[] = ['research', 'code', 'github', 'general'];
      return valid.includes(type as SubagentType) ? (type as SubagentType) : 'general';
    }

    /**
     * Validate and normalize output format
     */
    private validateOutputFormat(
      format: string
    ): 'text' | 'structured' | 'code' | 'citations' | 'actions' {
      const valid = ['text', 'structured', 'code', 'citations', 'actions'];
      return valid.includes(format)
        ? (format as 'text' | 'structured' | 'code' | 'citations' | 'actions')
        : 'text';
    }

    /**
     * Extract strategy from plan response
     */
    private extractStrategy(response: string): string {
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
    private extractSynthesisInstructions(response: string): string {
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
     */
    private async runSubagents(
      plan: ResearchPlan,
      context: AgentContext,
      _effortConfig: EffortConfig,
      traceId: string,
      env: TEnv
    ): Promise<SubagentResult[]> {
      const results: Map<string, SubagentResult> = new Map();
      const tasksByLevel = this.groupTasksByDependencyLevel(plan.subagentTasks);

      AgentMixin.log('LeadResearcherAgent', 'Running subagents', {
        traceId,
        levelCount: tasksByLevel.length,
        taskCounts: tasksByLevel.map((l) => l.length),
      });

      // Run each level sequentially, tasks within level in parallel
      for (const levelTasks of tasksByLevel) {
        // Build dependency context for this level
        const previousResults = new Map<
          string,
          { success: boolean; content?: string; data?: unknown }
        >();
        for (const [taskId, result] of results) {
          const entry: { success: boolean; content?: string; data?: unknown } = {
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

        // Run all tasks in this level in parallel
        const levelPromises = levelTasks.map((task) =>
          this.runSubagent(task, previousResults, context, traceId, env)
        );

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
              error: (result as PromiseRejectedResult).reason?.message || 'Task failed',
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
    private groupTasksByDependencyLevel(tasks: SubagentTask[]): SubagentTask[][] {
      const levels: SubagentTask[][] = [];
      const processed = new Set<string>();

      while (processed.size < tasks.length) {
        const level: SubagentTask[] = [];

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
     */
    private async runSubagent(
      task: SubagentTask,
      previousResults: Map<string, { success: boolean; content?: string; data?: unknown }>,
      context: AgentContext,
      traceId: string,
      env: TEnv
    ): Promise<SubagentResult> {
      const startTime = Date.now();

      try {
        // Build delegation context
        const delegationContext: DelegationContext = {
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

          const result = await (
            subagent as unknown as {
              perform: (
                delegationContext: DelegationContext,
                context: AgentContext
              ) => Promise<SubagentResult>;
            }
          ).perform(delegationContext, context);

          return {
            ...result,
            taskId: task.id,
            durationMs: Date.now() - startTime,
          };
        }
        // Fallback: inline with LLM
        return this.runSubagentInline(task, delegationContext, context, traceId, env, startTime);
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
     * Run subagent inline when DO is not available
     */
    private async runSubagentInline(
      task: SubagentTask,
      delegationContext: DelegationContext,
      _context: AgentContext,
      _traceId: string,
      env: TEnv,
      startTime: number
    ): Promise<SubagentResult> {
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
    private getSubagentNamespace(
      env: TEnv,
      type: SubagentType
    ): AgentNamespace<Agent<TEnv, unknown>> | undefined {
      switch (type) {
        case 'research':
          return env.ResearchSubagent as AgentNamespace<Agent<TEnv, unknown>> | undefined;
        case 'code':
          return env.CodeSubagent as AgentNamespace<Agent<TEnv, unknown>> | undefined;
        case 'github':
          return env.GitHubSubagent as AgentNamespace<Agent<TEnv, unknown>> | undefined;
        case 'general':
          return env.GeneralSubagent as AgentNamespace<Agent<TEnv, unknown>> | undefined;
        default:
          return undefined;
      }
    }

    /**
     * Get available tools for a subagent type
     */
    private getToolsForType(type: SubagentType): string[] {
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

      // Match source definitions
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
     * Synthesize results from all subagents
     */
    private async synthesizeResults(
      plan: ResearchPlan,
      subagentResults: SubagentResult[],
      provider: LLMProvider,
      startTime: number,
      _traceId: string
    ): Promise<ResearchResult> {
      // Calculate statistics
      const successCount = subagentResults.filter((r) => r.success).length;
      const failureCount = subagentResults.length - successCount;
      const totalToolCalls = subagentResults.reduce((sum, r) => sum + r.toolCallCount, 0);
      const totalDurationMs = Date.now() - startTime;

      // Calculate parallel efficiency
      const sequentialEstimate = subagentResults.reduce((sum, r) => sum + r.durationMs, 0);
      const parallelEfficiency = sequentialEstimate > 0 ? totalDurationMs / sequentialEstimate : 1;

      // Aggregate citations
      const citations: Citation[] = [];
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
        errors: subagentResults.filter((r) => r.error).map((r) => r.error as string),
      };
    }

    /**
     * Build synthesis prompt
     */
    private buildSynthesisPrompt(
      plan: ResearchPlan,
      results: SubagentResult[],
      citations: Citation[]
    ): string {
      const parts: string[] = [
        `## Original Query\n${plan.query}`,
        `## Research Strategy\n${plan.strategy}`,
      ];

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
    private updateHistory(plan: ResearchPlan, result: ResearchResult): void {
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
    getCurrentPlan(): ResearchPlan | undefined {
      return this.state.currentPlan;
    }

    /**
     * Get research statistics
     */
    getStats(): {
      totalResearched: number;
      avgSubagentCount: number;
      avgDurationMs: number;
      parallelEfficiency: number;
    } {
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
    clearHistory(): void {
      this.setState({
        ...this.state,
        researchHistory: [],
        currentPlan: undefined,
        updatedAt: Date.now(),
      });
    }
  };

  return AgentClass as LeadResearcherAgentClass<TEnv>;
}

/**
 * Type for lead researcher agent instance
 */
export type LeadResearcherAgentInstance<TEnv extends LeadResearcherEnv> = InstanceType<
  ReturnType<typeof createLeadResearcherAgent<TEnv>>
>;
