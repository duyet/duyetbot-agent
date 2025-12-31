/**
 * Unit tests for observability types and utilities
 *
 * Test Categories:
 * 1. debugContextToAgentSteps function
 * 2. Type compatibility and conversions
 * 3. Token count aggregations
 */

import { describe, expect, it } from 'vitest';
import {
  debugContextToAgentSteps,
  type AgentStep,
  type ChatMessageRole,
  type DebugContext,
  type TokenCounts,
  type TokenUsage,
} from '../types';

describe('debugContextToAgentSteps', () => {
  it('converts empty routing flow to empty array', () => {
    const debugContext: DebugContext = {
      routingFlow: [],
    };

    const result = debugContextToAgentSteps(debugContext);

    expect(result).toEqual([]);
  });

  it('converts single agent step without token usage', () => {
    const debugContext: DebugContext = {
      routingFlow: [
        {
          agent: 'router',
          durationMs: 100,
        },
      ],
    };

    const result = debugContextToAgentSteps(debugContext);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      name: 'router',
      type: 'agent',
      duration_ms: 100,
      input_tokens: 0,
      output_tokens: 0,
    });
  });

  it('converts single agent step with full token usage', () => {
    const debugContext: DebugContext = {
      routingFlow: [
        {
          agent: 'simple-agent',
          durationMs: 500,
          tokenUsage: {
            inputTokens: 100,
            outputTokens: 200,
            totalTokens: 300,
            cachedTokens: 50,
            reasoningTokens: 25,
          },
        },
      ],
    };

    const result = debugContextToAgentSteps(debugContext);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      name: 'simple-agent',
      type: 'agent',
      duration_ms: 500,
      input_tokens: 100,
      output_tokens: 200,
      cached_tokens: 50,
      reasoning_tokens: 25,
    });
  });

  it('converts multiple agent steps', () => {
    const debugContext: DebugContext = {
      routingFlow: [
        {
          agent: 'router',
          durationMs: 50,
          tokenUsage: {
            inputTokens: 50,
            outputTokens: 20,
            totalTokens: 70,
          },
        },
        {
          agent: 'simple-agent',
          durationMs: 300,
          tokenUsage: {
            inputTokens: 150,
            outputTokens: 250,
            totalTokens: 400,
          },
        },
      ],
    };

    const result = debugContextToAgentSteps(debugContext);

    expect(result).toHaveLength(2);
    expect(result[0].name).toBe('router');
    expect(result[1].name).toBe('simple-agent');
  });

  it('includes error when present in flow step', () => {
    const debugContext: DebugContext = {
      routingFlow: [
        {
          agent: 'failing-agent',
          durationMs: 1000,
          error: 'TimeoutError: Request exceeded 30s limit',
        },
      ],
    };

    const result = debugContextToAgentSteps(debugContext);

    expect(result).toHaveLength(1);
    expect(result[0].error).toBe('TimeoutError: Request exceeded 30s limit');
  });

  it('nests workers under orchestrator when orchestrator exists', () => {
    const debugContext: DebugContext = {
      routingFlow: [
        {
          agent: 'orchestrator',
          durationMs: 2000,
          tokenUsage: {
            inputTokens: 200,
            outputTokens: 100,
            totalTokens: 300,
          },
        },
      ],
      workers: [
        {
          name: 'bash-worker',
          durationMs: 500,
          tokenUsage: {
            inputTokens: 50,
            outputTokens: 30,
            totalTokens: 80,
          },
        },
        {
          name: 'git-worker',
          durationMs: 300,
          tokenUsage: {
            inputTokens: 40,
            outputTokens: 20,
            totalTokens: 60,
          },
        },
      ],
    };

    const result = debugContextToAgentSteps(debugContext);

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('orchestrator');
    expect(result[0].workers).toHaveLength(2);
    expect(result[0].workers?.[0].name).toBe('bash-worker');
    expect(result[0].workers?.[1].name).toBe('git-worker');
  });

  it('adds workers as top-level steps when orchestrator not found', () => {
    const debugContext: DebugContext = {
      routingFlow: [
        {
          agent: 'router',
          durationMs: 50,
        },
      ],
      workers: [
        {
          name: 'bash-worker',
          durationMs: 500,
        },
      ],
    };

    const result = debugContextToAgentSteps(debugContext);

    expect(result).toHaveLength(2);
    expect(result[0].name).toBe('router');
    expect(result[1].name).toBe('bash-worker');
    expect(result[1].type).toBe('worker');
  });

  it('handles orchestrator-agent variant name', () => {
    const debugContext: DebugContext = {
      routingFlow: [
        {
          agent: 'orchestrator-agent',
          durationMs: 1000,
        },
      ],
      workers: [
        {
          name: 'worker-1',
          durationMs: 200,
        },
      ],
    };

    const result = debugContextToAgentSteps(debugContext);

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('orchestrator-agent');
    expect(result[0].workers).toHaveLength(1);
  });

  it('handles workers with full token usage', () => {
    const debugContext: DebugContext = {
      routingFlow: [
        {
          agent: 'orchestrator',
          durationMs: 1000,
        },
      ],
      workers: [
        {
          name: 'research-worker',
          durationMs: 800,
          tokenUsage: {
            inputTokens: 500,
            outputTokens: 1000,
            totalTokens: 1500,
            cachedTokens: 200,
            reasoningTokens: 100,
          },
        },
      ],
    };

    const result = debugContextToAgentSteps(debugContext);

    expect(result[0].workers?.[0]).toEqual({
      name: 'research-worker',
      type: 'worker',
      duration_ms: 800,
      input_tokens: 500,
      output_tokens: 1000,
      cached_tokens: 200,
      reasoning_tokens: 100,
    });
  });
});

describe('Token Usage Type Compatibility', () => {
  it('TokenUsage has all required fields', () => {
    const tokenUsage: TokenUsage = {
      inputTokens: 100,
      outputTokens: 200,
      totalTokens: 300,
    };

    expect(tokenUsage.inputTokens).toBe(100);
    expect(tokenUsage.outputTokens).toBe(200);
    expect(tokenUsage.totalTokens).toBe(300);
  });

  it('TokenUsage includes optional fields', () => {
    const tokenUsage: TokenUsage = {
      inputTokens: 100,
      outputTokens: 200,
      totalTokens: 300,
      cachedTokens: 50,
      reasoningTokens: 25,
    };

    expect(tokenUsage.cachedTokens).toBe(50);
    expect(tokenUsage.reasoningTokens).toBe(25);
  });

  it('TokenCounts structure matches expected fields', () => {
    const counts: TokenCounts = {
      input: 100,
      output: 200,
      cached: 50,
      reasoning: 25,
    };

    expect(counts.input).toBe(100);
    expect(counts.output).toBe(200);
  });
});

describe('ChatMessageRole Type', () => {
  it('accepts all valid role types', () => {
    const roles: ChatMessageRole[] = ['user', 'assistant', 'system', 'tool'];

    expect(roles).toHaveLength(4);
    expect(roles).toContain('user');
    expect(roles).toContain('assistant');
    expect(roles).toContain('system');
    expect(roles).toContain('tool');
  });
});
