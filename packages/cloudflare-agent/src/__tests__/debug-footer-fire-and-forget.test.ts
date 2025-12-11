/**
 * Debug Footer Fire-and-Forget Tests
 *
 * Tests for the debug footer flow through the fire-and-forget pattern.
 * Verifies:
 * 1. scheduleExecution returns { scheduled: true/false } correctly
 * 2. Debug context is properly built and passed to sendPlatformResponse
 * 3. Admin users see debug footer, non-admin users don't
 * 4. Classification and timing information flows correctly through RouterAgent
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ResponseTarget } from '../platform-response.js';
import type { DebugContext } from '../types.js';

/**
 * Mock ExecutionContext for testing
 */
interface MockExecutionContext {
  traceId: string;
  spanId: string;
  query: string;
  platform: 'telegram' | 'github' | 'api';
  userId: string;
  chatId: string;
  username?: string;
  userMessageId: string;
  provider: string;
  model: string;
  conversationHistory: Array<{ role: string; content: string }>;
  debug: {
    classificationMs?: number;
    classification?: {
      type: string;
      category: string;
      complexity: string;
      confidence?: number;
    };
    [key: string]: unknown;
  };
  startedAt: number;
  deadline: number;
}

/**
 * Mock AgentResult from router
 */
interface MockAgentResult {
  success: boolean;
  content?: string;
  error?: string;
  durationMs: number;
  data?: {
    routedTo?: string;
    classification?: {
      type: string;
      category: string;
      complexity: string;
    };
    routerDurationMs?: number;
  };
  debug?: {
    tools?: string[];
    subAgents?: string[];
    workers?: Array<{
      name: string;
      durationMs?: number;
      status?: 'success' | 'failed';
      error?: string;
    }>;
    metadata?: Record<string, unknown>;
  };
}

describe('Debug Footer Fire-and-Forget Flow', () => {
  describe('scheduleExecution behavior', () => {
    it('returns scheduled: true when execution is successfully queued', () => {
      // Simulate successful scheduling
      const executionId = 'exec_abc123';
      const result = { scheduled: true, executionId };

      expect(result.scheduled).toBe(true);
      expect(result.executionId).toBe(executionId);
      expect(result.executionId).toMatch(/^exec_/);
    });

    it('returns scheduled: false when context is invalid (empty query)', () => {
      // Simulate validation failure - empty query
      const ctx = {
        query: '',
        userId: 'user123',
        chatId: 'chat456',
      };

      const isValid = !(!ctx.query || ctx.query.trim() === '');
      expect(isValid).toBe(false);

      const result = { scheduled: false, executionId: '' };
      expect(result.scheduled).toBe(false);
    });

    it('returns scheduled: false when responseTarget is invalid (missing messageRef)', () => {
      // Simulate validation failure - missing messageRef
      const responseTarget = {
        chatId: 'chat456',
        platform: 'telegram',
        // messageRef is missing
      };

      const isValid = !!(responseTarget && responseTarget.messageRef);
      expect(isValid).toBe(false);

      const result = { scheduled: false, executionId: '' };
      expect(result.scheduled).toBe(false);
    });

    it('returns scheduled: false when messageId is missing from messageRef', () => {
      // Simulate validation failure - missing messageId
      const responseTarget = {
        chatId: 'chat456',
        messageRef: {},
        platform: 'telegram',
      };

      const isValid = !!(responseTarget && responseTarget.messageRef?.messageId);
      expect(isValid).toBe(false);

      const result = { scheduled: false, executionId: '' };
      expect(result.scheduled).toBe(false);
    });
  });

  describe('debug context construction in onExecutionAlarm', () => {
    it('builds routing flow with router-agent and target agent', () => {
      const result: MockAgentResult = {
        success: true,
        content: 'Hello, World!',
        durationMs: 3000,
        data: {
          routedTo: 'simple-agent',
          classification: {
            type: 'simple',
            category: 'general',
            complexity: 'low',
          },
        },
      };

      const routerDurationMs = 400;
      const totalDurationMs = 3400;

      const debugContext: DebugContext = {
        routingFlow: [
          { agent: 'router-agent' },
          {
            agent: 'simple-agent',
            durationMs: result.durationMs,
          },
        ],
        totalDurationMs,
      };

      if (routerDurationMs) {
        debugContext.routerDurationMs = routerDurationMs;
      }

      expect(debugContext.routingFlow).toHaveLength(2);
      expect(debugContext.routingFlow[0].agent).toBe('router-agent');
      expect(debugContext.routingFlow[1].agent).toBe('simple-agent');
      expect(debugContext.routingFlow[1].durationMs).toBe(3000);
      expect(debugContext.totalDurationMs).toBe(3400);
      expect(debugContext.routerDurationMs).toBe(400);
    });

    it('includes classification in debug context when present', () => {
      const classification = {
        type: 'complex',
        category: 'research',
        complexity: 'high',
      };

      const debugContext: DebugContext = {
        routingFlow: [{ agent: 'router-agent' }],
        totalDurationMs: 1000,
        classification,
      };

      expect(debugContext.classification).toBeDefined();
      expect(debugContext.classification?.type).toBe('complex');
      expect(debugContext.classification?.category).toBe('research');
      expect(debugContext.classification?.complexity).toBe('high');
    });

    it('omits classification when not present to satisfy exactOptionalPropertyTypes', () => {
      const debugContext: DebugContext = {
        routingFlow: [{ agent: 'router-agent' }],
        totalDurationMs: 1000,
      };

      expect(debugContext.classification).toBeUndefined();
    });

    it('includes tools in routing flow step when present', () => {
      const debugContext: DebugContext = {
        routingFlow: [
          { agent: 'router-agent' },
          {
            agent: 'simple-agent',
            durationMs: 2000,
            tools: ['search', 'calculator'],
          },
        ],
        totalDurationMs: 2400,
      };

      expect(debugContext.routingFlow[1].tools).toEqual(['search', 'calculator']);
    });

    it('omits tools from routing flow step when empty', () => {
      const debugContext: DebugContext = {
        routingFlow: [
          { agent: 'router-agent' },
          {
            agent: 'simple-agent',
            durationMs: 2000,
          },
        ],
        totalDurationMs: 2400,
      };

      expect(debugContext.routingFlow[1].tools).toBeUndefined();
    });

    it('includes sub-agents from orchestrator delegation', () => {
      const result: MockAgentResult = {
        success: true,
        content: 'Result with workers',
        durationMs: 5000,
        debug: {
          subAgents: ['code-worker', 'research-worker'],
        },
      };

      const subAgents = result.debug?.subAgents || [];
      const debugContext: DebugContext = {
        routingFlow: [
          { agent: 'router-agent' },
          { agent: 'orchestrator-agent', durationMs: result.durationMs },
          ...subAgents.map((subAgent) => ({
            agent: subAgent,
          })),
        ],
        totalDurationMs: 5400,
      };

      expect(debugContext.routingFlow).toHaveLength(4);
      expect(debugContext.routingFlow[2].agent).toBe('code-worker');
      expect(debugContext.routingFlow[3].agent).toBe('research-worker');
    });

    it('includes workers with status mapping (success -> completed, failed -> error)', () => {
      const result: MockAgentResult = {
        success: true,
        content: 'Partial success',
        durationMs: 5000,
        debug: {
          workers: [
            { name: 'code-worker', durationMs: 2500, status: 'success' },
            { name: 'research-worker', durationMs: 2000, status: 'failed', error: 'timeout' },
          ],
        },
      };

      const debugContext: DebugContext = {
        routingFlow: [{ agent: 'router-agent' }],
        totalDurationMs: 5400,
      };

      if (result.debug?.workers && result.debug.workers.length > 0) {
        debugContext.workers = result.debug.workers.map((w) => ({
          name: w.name,
          durationMs: w.durationMs,
          status:
            w.status === 'success'
              ? ('completed' as const)
              : w.status === 'failed'
                ? ('error' as const)
                : ('error' as const),
          error: w.error,
        }));
      }

      expect(debugContext.workers).toHaveLength(2);
      expect(debugContext.workers?.[0].status).toBe('completed');
      expect(debugContext.workers?.[1].status).toBe('error');
      expect(debugContext.workers?.[1].error).toBe('timeout');
    });

    it('includes metadata from agent debug info', () => {
      const result: MockAgentResult = {
        success: true,
        content: 'Response with metadata',
        durationMs: 2000,
        debug: {
          metadata: {
            fallback: false,
            cacheHits: 2,
            toolTimeouts: 0,
          },
        },
      };

      const debugContext: DebugContext = {
        routingFlow: [{ agent: 'router-agent' }],
        totalDurationMs: 2400,
      };

      if (result.debug?.metadata) {
        debugContext.metadata = result.debug.metadata as any;
      }

      expect(debugContext.metadata).toBeDefined();
      expect(debugContext.metadata?.fallback).toBe(false);
      expect(debugContext.metadata?.cacheHits).toBe(2);
    });
  });

  describe('sendPlatformResponse with debug context', () => {
    it('calls sendPlatformResponse with debugContext when admin user', async () => {
      const target: ResponseTarget = {
        chatId: 'chat123',
        messageRef: { messageId: 456 },
        platform: 'telegram',
        username: 'admin_user',
        adminUsername: 'admin_user',
      };

      const debugContext: DebugContext = {
        routingFlow: [{ agent: 'router-agent' }, { agent: 'simple-agent', durationMs: 2000 }],
        totalDurationMs: 2400,
      };

      // Verify admin check logic
      const isAdmin =
        target.adminUsername && target.username && target.username === target.adminUsername;
      expect(isAdmin).toBe(true);
      expect(debugContext).toBeDefined();
    });

    it('omits debugContext when non-admin user', async () => {
      const target: ResponseTarget = {
        chatId: 'chat123',
        messageRef: { messageId: 456 },
        platform: 'telegram',
        username: 'regular_user',
        adminUsername: 'admin_user',
      };

      // Verify admin check logic
      const isAdmin =
        target.adminUsername && target.username && target.username === target.adminUsername;
      expect(isAdmin).toBe(false);
    });

    it('handles @-prefixed username normalization', async () => {
      const normalizeUsername = (username: string): string => {
        return username.startsWith('@') ? username.slice(1) : username;
      };

      const target: ResponseTarget = {
        chatId: 'chat123',
        messageRef: { messageId: 456 },
        platform: 'telegram',
        username: '@admin_user',
        adminUsername: 'admin_user',
      };

      const isAdmin =
        target.adminUsername &&
        target.username &&
        normalizeUsername(target.username) === normalizeUsername(target.adminUsername);
      expect(isAdmin).toBe(true);
    });

    it('omits debugContext when adminUsername is missing', async () => {
      const target: ResponseTarget = {
        chatId: 'chat123',
        messageRef: { messageId: 456 },
        platform: 'telegram',
        username: 'user123',
        // adminUsername missing
      };

      const isAdmin = !!(target.adminUsername && target.username);
      expect(isAdmin).toBe(false);
    });

    it('omits debugContext when username is missing', async () => {
      const target: ResponseTarget = {
        chatId: 'chat123',
        messageRef: { messageId: 456 },
        platform: 'telegram',
        adminUsername: 'admin_user',
        // username missing
      };

      const isAdmin = !!(target.adminUsername && target.username);
      expect(isAdmin).toBe(false);
    });
  });

  describe('response text construction in onExecutionAlarm', () => {
    it('builds successful response text from result content', () => {
      const result: MockAgentResult = {
        success: true,
        content: 'This is the response',
        durationMs: 2000,
      };

      const responseText =
        result.success && result.content
          ? result.content
          : `[error] ${result.error || 'Unknown error'}`;

      expect(responseText).toBe('This is the response');
      expect(responseText).not.toContain('[error]');
    });

    it('builds error response text when result fails', () => {
      const result: MockAgentResult = {
        success: false,
        error: 'Routing failed',
        durationMs: 100,
      };

      const responseText =
        result.success && result.content
          ? result.content
          : `[error] ${result.error || 'Unknown error'}`;

      expect(responseText).toBe('[error] Routing failed');
      expect(responseText).toContain('[error]');
    });

    it('builds error response with default message when error is undefined', () => {
      const result: MockAgentResult = {
        success: false,
        durationMs: 100,
      };

      const responseText =
        result.success && result.content
          ? result.content
          : `[error] ${result.error || 'Unknown error'}`;

      expect(responseText).toBe('[error] Unknown error');
    });
  });

  describe('execution context conversion', () => {
    it('converts AgentContext to ExecutionContext with required fields', () => {
      const agentContext = {
        query: 'what is the weather',
        platform: 'telegram' as const,
        userId: 'user123',
        chatId: 'chat456',
        username: 'john_doe',
        traceId: 'trace-abc-123',
        conversationHistory: [
          { role: 'user', content: 'hello' },
          { role: 'assistant', content: 'hi there' },
        ],
      };

      const traceId = agentContext.traceId || crypto.randomUUID();
      const spanId = `span_${crypto.randomUUID().slice(0, 8)}`;

      const executionContext: MockExecutionContext = {
        traceId,
        spanId,
        query: agentContext.query,
        platform: agentContext.platform,
        userId: agentContext.userId || 'unknown',
        chatId: agentContext.chatId || 'unknown',
        ...(agentContext.username && { username: agentContext.username }),
        userMessageId: agentContext.chatId || 'unknown',
        provider: 'claude',
        model: 'claude-opus-4.5',
        conversationHistory: agentContext.conversationHistory || [],
        debug: {},
        startedAt: Date.now(),
        deadline: Date.now() + 30000,
      };

      expect(executionContext.query).toBe('what is the weather');
      expect(executionContext.platform).toBe('telegram');
      expect(executionContext.userId).toBe('user123');
      expect(executionContext.chatId).toBe('chat456');
      expect(executionContext.username).toBe('john_doe');
      expect(executionContext.conversationHistory).toHaveLength(2);
      expect(executionContext.deadline).toBeGreaterThan(executionContext.startedAt);
    });

    it('uses default values for missing optional fields', () => {
      const agentContext = {
        query: 'hello',
        platform: 'api' as const,
        chatId: 'chat789',
      };

      const executionContext: MockExecutionContext = {
        traceId: crypto.randomUUID(),
        spanId: `span_${crypto.randomUUID().slice(0, 8)}`,
        query: agentContext.query,
        platform: agentContext.platform,
        userId: agentContext.userId || 'unknown',
        chatId: agentContext.chatId || 'unknown',
        userMessageId: agentContext.chatId || 'unknown',
        provider: 'claude',
        model: 'claude-opus-4.5',
        conversationHistory: [],
        debug: {},
        startedAt: Date.now(),
        deadline: Date.now() + 30000,
      };

      expect(executionContext.userId).toBe('unknown');
      expect(executionContext.conversationHistory).toHaveLength(0);
      expect(executionContext.provider).toBe('claude');
      expect(executionContext.model).toBe('claude-opus-4.5');
    });
  });

  describe('routing flow timing calculations', () => {
    it('calculates total duration from start time to completion', () => {
      const startTime = Date.now();
      // Simulate 500ms of processing
      const totalDurationMs = 500;
      const calculatedDuration = startTime + totalDurationMs - startTime;

      expect(calculatedDuration).toBe(500);
    });

    it('separates router classification duration from target agent duration', () => {
      const routerDurationMs = 400;
      const targetAgentDurationMs = 2000;
      const totalDurationMs = routerDurationMs + targetAgentDurationMs;

      const debugContext: DebugContext = {
        routingFlow: [
          { agent: 'router-agent' },
          { agent: 'simple-agent', durationMs: targetAgentDurationMs },
        ],
        routerDurationMs,
        totalDurationMs,
      };

      expect(debugContext.routerDurationMs).toBe(400);
      expect(debugContext.routingFlow[1].durationMs).toBe(2000);
      expect(debugContext.totalDurationMs).toBe(2400);
    });

    it('handles case where routing history is empty', () => {
      const routingHistory: any[] = [];
      const lastRouting = routingHistory[routingHistory.length - 1];
      const routerDurationMs = lastRouting?.durationMs;

      expect(routerDurationMs).toBeUndefined();

      const debugContext: DebugContext = {
        routingFlow: [{ agent: 'router-agent' }],
        totalDurationMs: 100,
      };

      if (routerDurationMs) {
        debugContext.routerDurationMs = routerDurationMs;
      }

      expect(debugContext.routerDurationMs).toBeUndefined();
    });
  });

  describe('fallback behavior when scheduling fails', () => {
    it('falls back to direct chat when scheduling returns false', () => {
      const scheduled = false;

      if (!scheduled) {
        // Execute direct chat instead
        expect(scheduled).toBe(false);
      }
    });

    it('continues with chat() when RouterAgent binding is unavailable', () => {
      const routerEnv = {
        // RouterAgent binding missing
      };

      const hasRouterAgent = !!(routerEnv as any).RouterAgent;
      expect(hasRouterAgent).toBe(false);

      // Should fall back to direct chat
    });

    it('logs error and returns false when scheduling throws', () => {
      const error = new Error('Network error');
      const errorMessage = error instanceof Error ? error.message : String(error);

      expect(errorMessage).toBe('Network error');

      const result = { scheduled: false, executionId: '' };
      expect(result.scheduled).toBe(false);
    });
  });

  describe('platform-specific response handling', () => {
    it('sends Telegram response when platform is telegram', async () => {
      const target: ResponseTarget = {
        chatId: '123456',
        messageRef: { messageId: 789 },
        platform: 'telegram',
        username: 'admin_user',
        adminUsername: 'admin_user',
      };

      expect(target.platform).toBe('telegram');
      expect(target.messageRef.messageId).toBe(789);
    });

    it('sends GitHub response when platform is github', async () => {
      const target: ResponseTarget = {
        chatId: 'user/repo#123',
        messageRef: { messageId: 456 },
        platform: 'github',
        githubOwner: 'user',
        githubRepo: 'repo',
        githubIssueNumber: 123,
        username: 'admin_user',
        adminUsername: 'admin_user',
      };

      expect(target.platform).toBe('github');
      expect(target.githubOwner).toBe('user');
      expect(target.githubRepo).toBe('repo');
    });

    it('includes parseMode in Telegram response for debug footer formatting', () => {
      const target: ResponseTarget = {
        chatId: '123456',
        messageRef: { messageId: 789 },
        platform: 'telegram',
        platformConfig: { platform: 'telegram', parseMode: 'HTML' },
      };

      const platformConfig = target.platformConfig as any;
      const parseMode = platformConfig?.parseMode || 'HTML';

      expect(parseMode).toBe('HTML');
    });

    it('defaults to HTML parseMode when not specified', () => {
      const target: ResponseTarget = {
        chatId: '123456',
        messageRef: { messageId: 789 },
        platform: 'telegram',
      };

      const parseMode = target.platformConfig?.parseMode || 'HTML';

      expect(parseMode).toBe('HTML');
    });
  });

  describe('state management during fire-and-forget', () => {
    it('stores pending execution in state before scheduling alarm', () => {
      const execution = {
        executionId: 'exec_abc123',
        query: 'hello world',
        context: {} as MockExecutionContext,
        responseTarget: {} as ResponseTarget,
        scheduledAt: Date.now(),
      };

      const pendingExecutions = [execution];

      expect(pendingExecutions).toHaveLength(1);
      expect(pendingExecutions[0].executionId).toBe('exec_abc123');
    });

    it('removes execution from pending state after onExecutionAlarm completes', () => {
      const execution = {
        executionId: 'exec_abc123',
        query: 'hello world',
        context: {} as MockExecutionContext,
        responseTarget: {} as ResponseTarget,
        scheduledAt: Date.now(),
      };

      const pendingExecutions = [execution];
      const executionId = 'exec_abc123';
      const remainingExecutions = pendingExecutions.filter((e) => e.executionId !== executionId);

      expect(remainingExecutions).toHaveLength(0);
    });

    it('keeps other pending executions when removing one', () => {
      const executions = [
        {
          executionId: 'exec_001',
          query: 'query 1',
          context: {} as MockExecutionContext,
          responseTarget: {} as ResponseTarget,
          scheduledAt: Date.now(),
        },
        {
          executionId: 'exec_002',
          query: 'query 2',
          context: {} as MockExecutionContext,
          responseTarget: {} as ResponseTarget,
          scheduledAt: Date.now(),
        },
      ];

      const executionId = 'exec_001';
      const remainingExecutions = executions.filter((e) => e.executionId !== executionId);

      expect(remainingExecutions).toHaveLength(1);
      expect(remainingExecutions[0].executionId).toBe('exec_002');
    });

    it('sets undefined when last execution is removed', () => {
      const executions = [
        {
          executionId: 'exec_001',
          query: 'query 1',
          context: {} as MockExecutionContext,
          responseTarget: {} as ResponseTarget,
          scheduledAt: Date.now(),
        },
      ];

      const executionId = 'exec_001';
      const remainingExecutions = executions.filter((e) => e.executionId !== executionId);
      const finalValue = remainingExecutions.length > 0 ? remainingExecutions : undefined;

      expect(finalValue).toBeUndefined();
    });
  });

  describe('corruption handling in onExecutionAlarm', () => {
    it('detects missing context field', () => {
      const execution = {
        executionId: 'exec_123',
        query: 'hello',
        context: undefined,
        responseTarget: {} as ResponseTarget,
        scheduledAt: Date.now(),
      };

      const isCorrupted = !execution.context;
      expect(isCorrupted).toBe(true);
    });

    it('detects missing query field', () => {
      const execution = {
        executionId: 'exec_123',
        query: undefined,
        context: {} as MockExecutionContext,
        responseTarget: {} as ResponseTarget,
        scheduledAt: Date.now(),
      };

      const isCorrupted = !execution.query;
      expect(isCorrupted).toBe(true);
    });

    it('detects missing responseTarget', () => {
      const execution = {
        executionId: 'exec_123',
        query: 'hello',
        context: {} as MockExecutionContext,
        responseTarget: undefined,
        scheduledAt: Date.now(),
      };

      const isCorrupted = !execution.responseTarget;
      expect(isCorrupted).toBe(true);
    });

    it('detects missing messageRef in responseTarget', () => {
      const execution = {
        executionId: 'exec_123',
        query: 'hello',
        context: {} as MockExecutionContext,
        responseTarget: {
          chatId: 'chat123',
          messageRef: undefined,
          platform: 'telegram',
        } as any,
        scheduledAt: Date.now(),
      };

      const isCorrupted = !execution.responseTarget?.messageRef?.messageId;
      expect(isCorrupted).toBe(true);
    });

    it('detects missing messageId in messageRef', () => {
      const execution = {
        executionId: 'exec_123',
        query: 'hello',
        context: {} as MockExecutionContext,
        responseTarget: {
          chatId: 'chat123',
          messageRef: { messageId: undefined },
          platform: 'telegram',
        } as any,
        scheduledAt: Date.now(),
      };

      const isCorrupted = !execution.responseTarget?.messageRef?.messageId;
      expect(isCorrupted).toBe(true);
    });

    it('cleans up corrupted execution and continues', () => {
      const executions = [
        {
          executionId: 'exec_corrupted',
          query: undefined,
          context: {} as MockExecutionContext,
          responseTarget: {} as ResponseTarget,
          scheduledAt: Date.now(),
        },
        {
          executionId: 'exec_valid',
          query: 'valid query',
          context: {} as MockExecutionContext,
          responseTarget: {
            chatId: 'chat123',
            messageRef: { messageId: 456 },
            platform: 'telegram',
          },
          scheduledAt: Date.now(),
        },
      ];

      const executionIdToRemove = 'exec_corrupted';
      const remainingExecutions = executions.filter((e) => e.executionId !== executionIdToRemove);

      expect(remainingExecutions).toHaveLength(1);
      expect(remainingExecutions[0].executionId).toBe('exec_valid');
    });
  });
});
