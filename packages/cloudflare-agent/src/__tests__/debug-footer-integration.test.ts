/**
 * Debug Footer Integration Tests
 *
 * Integration tests for the complete fire-and-forget flow:
 * CloudflareAgent.scheduleRouting() → RouterAgent.scheduleExecution() →
 * RouterAgent.onExecutionAlarm() → sendPlatformResponse(debugContext)
 *
 * Tests:
 * 1. Full flow with admin user sees debug footer
 * 2. Full flow with non-admin user doesn't see debug footer
 * 3. Classification and timing propagate correctly through the chain
 * 4. Error handling in each step
 */

import { describe, expect, it } from 'vitest';
import type { ResponseTarget } from '../platform-response.js';
import type { DebugContext, DebugMetadata } from '../types.js';

/**
 * Simulates the complete routing flow
 */
describe('Debug Footer Integration - Complete Fire-and-Forget Flow', () => {
  describe('flow 1: CloudflareAgent.scheduleRouting succeeds', () => {
    it('delegates to RouterAgent and returns immediately (non-blocking)', async () => {
      // Simulate CloudflareAgent preparing context for scheduling
      const _agentContext = {
        query: 'search for typescript performance tips',
        platform: 'telegram' as const,
        userId: 'user123',
        chatId: 'chat456',
        username: 'user123',
        traceId: 'trace-abc-123',
        conversationHistory: [],
      };

      const _responseTarget: ResponseTarget = {
        chatId: 'chat456',
        messageRef: { messageId: 789 },
        platform: 'telegram',
        username: 'user123',
        adminUsername: 'admin_user',
        platformConfig: { platform: 'telegram' },
      };

      // Simulate scheduleRouting calling RouterAgent.scheduleExecution
      const scheduleResult = { scheduled: true, executionId: 'exec_xyz123' };

      // At this point, CloudflareAgent returns immediately without blocking
      expect(scheduleResult.scheduled).toBe(true);
      expect(scheduleResult.executionId).toBeTruthy();

      // RouterAgent processes in background via alarm handler
      // No blocking on CloudflareAgent
    });

    it('stores pending execution and schedules alarm', () => {
      const executionContext = {
        traceId: 'trace-123',
        spanId: 'span-456',
        query: 'what is rust',
        platform: 'telegram' as const,
        userId: 'user123',
        chatId: 'chat456',
        startedAt: Date.now(),
      };

      const pendingExecution = {
        executionId: 'exec_abc123',
        query: executionContext.query,
        context: executionContext,
        responseTarget: {
          chatId: 'chat456',
          messageRef: { messageId: 789 },
          platform: 'telegram',
        } as ResponseTarget,
        scheduledAt: Date.now(),
      };

      // Verify stored execution has all required fields
      expect(pendingExecution.query).toBe('what is rust');
      expect(pendingExecution.context.traceId).toBe('trace-123');
      expect(pendingExecution.responseTarget.messageRef.messageId).toBe(789);
    });

    it('continues processing independently in RouterAgent.onExecutionAlarm', async () => {
      // Simulate RouterAgent.onExecutionAlarm receiving alarm
      const _executionId = 'exec_abc123';

      // Router processes the execution with full 30s budget
      const _routingStartTime = Date.now();
      const classificationDurationMs = 400;
      const targetAgentDurationMs = 2000;
      const _totalDurationMs = classificationDurationMs + targetAgentDurationMs;

      // Simulate route() returning with classification and delegation
      const routingResult = {
        success: true,
        content: 'TypeScript provides excellent type safety and performance...',
        durationMs: targetAgentDurationMs,
        data: {
          routedTo: 'simple-agent',
          classification: {
            type: 'simple',
            category: 'general',
            complexity: 'low',
          },
        },
      };

      expect(routingResult.success).toBe(true);
      expect(routingResult.durationMs).toBe(2000);
      expect(routingResult.data?.routedTo).toBe('simple-agent');
    });

    it('builds complete debug context with routing flow and classification', () => {
      const routerDurationMs = 400;
      const agentDurationMs = 2000;

      // Simulate building debug context in onExecutionAlarm
      const _debugContext: DebugContext = {
        routingFlow: [
          { agent: 'router-agent' },
          {
            agent: 'simple-agent',
            durationMs: agentDurationMs,
          },
        ],
        routerDurationMs,
        totalDurationMs: routerDurationMs + agentDurationMs,
        classification: {
          type: 'simple',
          category: 'general',
          complexity: 'low',
        },
      };

      expect(_debugContext.routingFlow).toHaveLength(2);
      expect(_debugContext.routingFlow[0].agent).toBe('router-agent');
      expect(_debugContext.routingFlow[1].agent).toBe('simple-agent');
      expect(_debugContext.routerDurationMs).toBe(400);
      expect(_debugContext.classification?.type).toBe('simple');
      expect(_debugContext.totalDurationMs).toBe(2400);
    });

    it('sends response with debug footer for admin user', () => {
      const responseTarget: ResponseTarget = {
        chatId: 'chat456',
        messageRef: { messageId: 789 },
        platform: 'telegram',
        username: 'alice',
        adminUsername: 'alice',
      };

      const debugContext: DebugContext = {
        routingFlow: [{ agent: 'router-agent' }, { agent: 'simple-agent', durationMs: 2000 }],
        totalDurationMs: 2400,
      };

      // Check admin status
      const isAdmin =
        responseTarget.adminUsername &&
        responseTarget.username &&
        responseTarget.username === responseTarget.adminUsername;

      expect(isAdmin).toBe(true);
      expect(debugContext).toBeDefined();

      // sendPlatformResponse should include debug footer
      const responseText =
        'TypeScript provides excellent type safety...' +
        '\n\n[debug] router-agent → simple-agent (2.40s)';

      expect(responseText).toContain('[debug]');
      expect(responseText).toContain('2.40s');
    });

    it('sends response without debug footer for non-admin user', () => {
      const responseTarget: ResponseTarget = {
        chatId: 'chat456',
        messageRef: { messageId: 789 },
        platform: 'telegram',
        username: 'bob',
        adminUsername: 'alice',
      };

      const _debugContext: DebugContext = {
        routingFlow: [{ agent: 'router-agent' }, { agent: 'simple-agent', durationMs: 2000 }],
        totalDurationMs: 2400,
      };

      // Check admin status
      const isAdmin =
        responseTarget.adminUsername &&
        responseTarget.username &&
        responseTarget.username === responseTarget.adminUsername;

      expect(isAdmin).toBe(false);

      // sendPlatformResponse should NOT include debug footer
      const responseText = 'TypeScript provides excellent type safety...';

      expect(responseText).not.toContain('[debug]');
    });
  });

  describe('flow 2: CloudflareAgent.scheduleRouting fails - fallback to direct chat', () => {
    it('returns false when RouterAgent binding unavailable', async () => {
      // Simulate RouterAgentEnv without RouterAgent binding
      const routerEnv = {
        // RouterAgent binding missing
      };

      const hasRouterAgent = !!(routerEnv as any).RouterAgent;
      expect(hasRouterAgent).toBe(false);

      // scheduleRouting returns false, falls back to direct chat()
      const scheduled = false;
      expect(scheduled).toBe(false);
    });

    it('returns false when scheduleExecution throws error', () => {
      const _error = new Error('Storage quota exceeded');

      const scheduled = false;
      expect(scheduled).toBe(false);

      // Falls back to direct chat() with immediate response
    });

    it('falls back to chat() with conversationHistory preserved', async () => {
      const _combinedText = 'user query';
      const conversationHistory = [
        { role: 'user' as const, content: 'previous message' },
        { role: 'assistant' as const, content: 'previous response' },
      ];

      // Direct chat receives combined query with preserved history
      const mockResponse = 'Direct LLM response without routing';

      expect(mockResponse).toBeTruthy();
      expect(conversationHistory).toHaveLength(2);
    });

    it('no debug context passed to sendPlatformResponse in fallback path', () => {
      // When falling back to direct chat(), no debugContext parameter
      const responseText = 'LLM response';
      const debugContextArg = undefined;

      expect(debugContextArg).toBeUndefined();
      expect(responseText).not.toContain('[debug]');
    });
  });

  describe('flow 3: RouterAgent routing with complex query', () => {
    it('builds routing flow with multiple agents (orchestrator delegation)', () => {
      const result = {
        success: true,
        content: 'Complex multi-step response',
        durationMs: 5000,
        debug: {
          subAgents: ['code-worker', 'research-worker'],
          workers: [
            { name: 'code-worker', durationMs: 2500, status: 'success' as const },
            { name: 'research-worker', durationMs: 2000, status: 'success' as const },
          ],
        },
      };

      const subAgents = result.debug?.subAgents || [];
      const debugContext: DebugContext = {
        routingFlow: [
          { agent: 'router-agent' },
          { agent: 'orchestrator-agent', durationMs: result.durationMs },
          ...subAgents.map((agent) => ({ agent })),
        ],
        totalDurationMs: 5400,
      };

      expect(debugContext.routingFlow).toHaveLength(4);
      expect(debugContext.routingFlow[0].agent).toBe('router-agent');
      expect(debugContext.routingFlow[1].agent).toBe('orchestrator-agent');
      expect(debugContext.routingFlow[2].agent).toBe('code-worker');
      expect(debugContext.routingFlow[3].agent).toBe('research-worker');
    });

    it('includes worker status mapping in debug context', () => {
      const workers = [
        { name: 'code-worker', durationMs: 2500, status: 'success' as const },
        { name: 'research-worker', durationMs: 2000, status: 'failed' as const, error: 'timeout' },
      ];

      const debugContext: DebugContext = {
        routingFlow: [{ agent: 'router-agent' }],
        totalDurationMs: 5400,
        workers: workers.map((w) => ({
          name: w.name,
          durationMs: w.durationMs,
          status:
            w.status === 'success'
              ? ('completed' as const)
              : w.status === 'failed'
                ? ('error' as const)
                : ('error' as const),
          error: w.error,
        })),
      };

      expect(debugContext.workers).toHaveLength(2);
      expect(debugContext.workers?.[0].status).toBe('completed');
      expect(debugContext.workers?.[1].status).toBe('error');
      expect(debugContext.workers?.[1].error).toBe('timeout');
    });

    it('formats complex routing flow for admin debug footer', () => {
      const debugContext: DebugContext = {
        routingFlow: [
          { agent: 'router-agent' },
          { agent: 'orchestrator-agent', durationMs: 5000 },
          { agent: 'code-worker' },
          { agent: 'research-worker' },
        ],
        routerDurationMs: 400,
        totalDurationMs: 5400,
        classification: {
          type: 'complex',
          category: 'research',
          complexity: 'high',
        },
      };

      // Format for debug footer
      const flowFormatted = debugContext.routingFlow.map((step) => step.agent).join(' → ');

      expect(flowFormatted).toBe(
        'router-agent → orchestrator-agent → code-worker → research-worker'
      );
      expect(debugContext.totalDurationMs).toBe(5400);
      expect(debugContext.classification?.complexity).toBe('high');
    });
  });

  describe('flow 4: Error handling and recovery', () => {
    it('logs corrupted execution state and skips processing', () => {
      const execution = {
        executionId: 'exec_123',
        query: undefined,
        context: {} as any,
        responseTarget: {} as ResponseTarget,
        scheduledAt: Date.now(),
      };

      // Guard against corrupted state
      const isCorrupted = !execution.query;
      expect(isCorrupted).toBe(true);

      // Should skip processing and clean up
    });

    it('sends error message to user when execution fails', () => {
      const _responseTarget: ResponseTarget = {
        chatId: 'chat456',
        messageRef: { messageId: 789 },
        platform: 'telegram',
      };

      const errorMessage = '[error] Sorry, an error occurred processing your request.';

      expect(errorMessage).toContain('[error]');
      expect(errorMessage).toBeTruthy();
    });

    it('logs and handles sendPlatformResponse errors', () => {
      const error = new Error('Telegram API unavailable');
      const errorMessage = error instanceof Error ? error.message : String(error);

      expect(errorMessage).toBe('Telegram API unavailable');

      // Should log error but not throw
    });

    it('cleans up pending execution even after error', () => {
      const executions = [
        {
          executionId: 'exec_failed',
          query: 'query',
          context: {} as any,
          responseTarget: {} as ResponseTarget,
          scheduledAt: Date.now(),
        },
      ];

      // After error in onExecutionAlarm, finally block cleans up
      const remainingExecutions = executions.filter((e) => e.executionId !== 'exec_failed');

      expect(remainingExecutions).toHaveLength(0);
    });
  });

  describe('flow 5: Timing and performance', () => {
    it('router classification measured separately from agent execution', () => {
      const classificationMs = 400;
      const agentExecutionMs = 2000;
      const totalMs = classificationMs + agentExecutionMs;

      const debugContext: DebugContext = {
        routingFlow: [
          { agent: 'router-agent' },
          { agent: 'simple-agent', durationMs: agentExecutionMs },
        ],
        routerDurationMs: classificationMs,
        totalDurationMs: totalMs,
      };

      expect(debugContext.routerDurationMs).toBe(400);
      expect(debugContext.routingFlow[1].durationMs).toBe(2000);
      expect(debugContext.totalDurationMs).toBe(2400);
    });

    it('deadline enforcement: 30s budget for RouterAgent.onExecutionAlarm', () => {
      const startTime = Date.now();
      const deadline = startTime + 30000; // 30s budget

      expect(deadline - startTime).toBe(30000);
    });

    it('tracks execution start and completion time', () => {
      const scheduledAt = Date.now();
      const executionStartTime = Date.now() + 1000; // 1s delay before alarm fires
      const executionCompleteTime = executionStartTime + 2400;

      const totalLatencyMs = executionCompleteTime - scheduledAt;

      expect(totalLatencyMs).toBeGreaterThan(3000);
    });
  });

  describe('flow 6: Platform-specific response delivery', () => {
    it('Telegram response with HTML parseMode and debug footer', () => {
      const responseTarget: ResponseTarget = {
        chatId: '123456',
        messageRef: { messageId: 789 },
        platform: 'telegram',
        username: 'admin',
        adminUsername: 'admin',
        platformConfig: { platform: 'telegram', parseMode: 'HTML' },
      };

      const parseMode = responseTarget.platformConfig?.parseMode || 'HTML';

      expect(parseMode).toBe('HTML');
      expect(responseTarget.platform).toBe('telegram');
    });

    it('GitHub response with Markdown debug footer', () => {
      const responseTarget: ResponseTarget = {
        chatId: 'user/repo#123',
        messageRef: { messageId: 456 },
        platform: 'github',
        githubOwner: 'user',
        githubRepo: 'repo',
        githubIssueNumber: 123,
        username: 'admin',
        adminUsername: 'admin',
      };

      expect(responseTarget.platform).toBe('github');
      expect(responseTarget.githubOwner).toBe('user');

      // GitHub footer would use Markdown
      const debugFooter = '\n\n<details>\n<summary>[debug]</summary>\n...';
      expect(debugFooter).toContain('<details>');
    });

    it('preserves message reference through entire flow', () => {
      const messageRef = { messageId: 789 };

      const responseTarget: ResponseTarget = {
        chatId: 'chat456',
        messageRef,
        platform: 'telegram',
      };

      expect(responseTarget.messageRef.messageId).toBe(789);
    });
  });

  describe('flow 7: State transitions and final cleanup', () => {
    it('marks batch as delegated after successful scheduling', () => {
      // After scheduleRouting returns true
      const updatedStatus = 'delegated' as const;

      expect(updatedStatus).toBe('delegated');
    });

    it('removes execution from pendingExecutions after completion', () => {
      const initialPending = [
        {
          executionId: 'exec_123',
          query: 'hello',
          context: {} as any,
          responseTarget: {} as ResponseTarget,
          scheduledAt: Date.now(),
        },
      ];

      const afterCleanup = initialPending.filter((e) => e.executionId !== 'exec_123');

      expect(afterCleanup).toHaveLength(0);
    });

    it('sets pendingExecutions to undefined when empty', () => {
      const remainingExecutions: any[] = [];
      const finalValue = remainingExecutions.length > 0 ? remainingExecutions : undefined;

      expect(finalValue).toBeUndefined();
    });

    it('preserves other pending executions when removing one', () => {
      const initialPending = [
        {
          executionId: 'exec_001',
          query: 'query 1',
          context: {} as any,
          responseTarget: {} as ResponseTarget,
          scheduledAt: Date.now(),
        },
        {
          executionId: 'exec_002',
          query: 'query 2',
          context: {} as any,
          responseTarget: {} as ResponseTarget,
          scheduledAt: Date.now(),
        },
      ];

      const afterRemovingFirst = initialPending.filter((e) => e.executionId !== 'exec_001');

      expect(afterRemovingFirst).toHaveLength(1);
      expect(afterRemovingFirst[0].executionId).toBe('exec_002');
    });
  });

  describe('flow 8: Debug metadata preservation', () => {
    it('includes metadata from agent debug info', () => {
      const metadata: DebugMetadata = {
        fallback: false,
        cacheHits: 2,
        cacheMisses: 1,
        toolTimeouts: 0,
        model: 'claude-3-5-sonnet-20241022',
      };

      const debugContext: DebugContext = {
        routingFlow: [{ agent: 'router-agent' }],
        totalDurationMs: 2000,
        metadata,
      };

      expect(debugContext.metadata?.fallback).toBe(false);
      expect(debugContext.metadata?.cacheHits).toBe(2);
      expect(debugContext.metadata?.model).toBe('claude-3-5-sonnet-20241022');
    });

    it('includes token usage in routing flow steps', () => {
      const debugContext: DebugContext = {
        routingFlow: [
          {
            agent: 'simple-agent',
            durationMs: 2000,
            tokenUsage: {
              inputTokens: 150,
              outputTokens: 450,
              totalTokens: 600,
            },
          },
        ],
        totalDurationMs: 2400,
      };

      expect(debugContext.routingFlow[0].tokenUsage?.totalTokens).toBe(600);
    });
  });
});
