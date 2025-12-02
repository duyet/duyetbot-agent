import { beforeEach, describe, expect, it } from 'vitest';
import { EventCollector } from '../collector.js';
import type { AgentStep } from '../types.js';

describe('EventCollector', () => {
  let collector: EventCollector;
  const baseInit = {
    eventId: 'test-event-123',
    appSource: 'telegram-webhook' as const,
    eventType: 'message',
    triggeredAt: 1700000000000,
    requestId: 'req-123',
  };

  beforeEach(() => {
    collector = new EventCollector(baseInit);
  });

  describe('constructor', () => {
    it('should initialize with provided values', () => {
      const event = collector.toEvent();
      expect(event.eventId).toBe('test-event-123');
      expect(event.appSource).toBe('telegram-webhook');
      expect(event.eventType).toBe('message');
      expect(event.triggeredAt).toBe(1700000000000);
      expect(event.requestId).toBe('req-123');
      expect(event.status).toBe('pending');
      expect(event.agents).toEqual([]);
    });
  });

  describe('setContext', () => {
    it('should set trigger context', () => {
      collector.setContext({
        userId: 'user-456',
        username: 'testuser',
        chatId: 'chat-789',
      });

      const event = collector.toEvent();
      expect(event.userId).toBe('user-456');
      expect(event.username).toBe('testuser');
      expect(event.chatId).toBe('chat-789');
    });

    it('should set repo for GitHub events', () => {
      collector.setContext({
        repo: 'owner/repo',
      });

      const event = collector.toEvent();
      expect(event.repo).toBe('owner/repo');
    });
  });

  describe('setInput', () => {
    it('should set full input text', () => {
      collector.setInput('Hello, this is a test message');

      const event = collector.toEvent();
      expect(event.inputText).toBe('Hello, this is a test message');
    });
  });

  describe('addAgent', () => {
    it('should add agent step to chain', () => {
      const agentStep: AgentStep = {
        name: 'router',
        type: 'agent',
        duration_ms: 50,
        input_tokens: 100,
        output_tokens: 20,
      };

      collector.addAgent(agentStep);

      const event = collector.toEvent();
      expect(event.agents).toHaveLength(1);
      expect(event.agents[0]).toEqual(agentStep);
    });

    it('should support nested workers', () => {
      const orchestrator: AgentStep = {
        name: 'orchestrator',
        type: 'agent',
        duration_ms: 200,
        input_tokens: 300,
        output_tokens: 80,
        workers: [
          {
            name: 'code-worker',
            type: 'worker',
            duration_ms: 150,
            input_tokens: 500,
            output_tokens: 100,
          },
        ],
      };

      collector.addAgent(orchestrator);

      const event = collector.toEvent();
      expect(event.agents[0].workers).toHaveLength(1);
      expect(event.agents[0].workers![0].name).toBe('code-worker');
    });
  });

  describe('updateAgentTokens', () => {
    it('should update tokens for existing agent', () => {
      collector.addAgent({
        name: 'simple-agent',
        type: 'agent',
        duration_ms: 100,
        input_tokens: 0,
        output_tokens: 0,
      });

      collector.updateAgentTokens('simple-agent', {
        input: 500,
        output: 150,
        cached: 100,
      });

      const event = collector.toEvent();
      expect(event.agents[0].input_tokens).toBe(500);
      expect(event.agents[0].output_tokens).toBe(150);
      expect(event.agents[0].cached_tokens).toBe(100);
    });

    it('should not crash for non-existent agent', () => {
      collector.updateAgentTokens('non-existent', {
        input: 100,
        output: 50,
      });

      const event = collector.toEvent();
      expect(event.agents).toHaveLength(0);
    });
  });

  describe('addWorkerToAgent', () => {
    it('should add worker to parent agent', () => {
      collector.addAgent({
        name: 'orchestrator',
        type: 'agent',
        duration_ms: 100,
        input_tokens: 200,
        output_tokens: 50,
      });

      collector.addWorkerToAgent('orchestrator', {
        name: 'research-worker',
        type: 'worker',
        duration_ms: 80,
        input_tokens: 300,
        output_tokens: 100,
      });

      const event = collector.toEvent();
      expect(event.agents[0].workers).toHaveLength(1);
      expect(event.agents[0].workers![0].name).toBe('research-worker');
    });
  });

  describe('setClassification', () => {
    it('should set classification from router', () => {
      collector.setClassification({
        type: 'simple',
        category: 'general',
        complexity: 'low',
      });

      const event = collector.toEvent();
      expect(event.classification).toEqual({
        type: 'simple',
        category: 'general',
        complexity: 'low',
      });
    });
  });

  describe('complete', () => {
    it('should complete with success', () => {
      collector.complete({
        status: 'success',
        responseText: 'Here is the response',
      });

      const event = collector.toEvent();
      expect(event.status).toBe('success');
      expect(event.responseText).toBe('Here is the response');
      expect(event.completedAt).toBeDefined();
      expect(event.durationMs).toBeDefined();
    });

    it('should complete with error', () => {
      collector.complete({
        status: 'error',
        error: new TypeError('Something went wrong'),
      });

      const event = collector.toEvent();
      expect(event.status).toBe('error');
      expect(event.errorType).toBe('TypeError');
      expect(event.errorMessage).toBe('Something went wrong');
    });
  });

  describe('token aggregation', () => {
    it('should calculate token totals from all agents', () => {
      collector.addAgent({
        name: 'router',
        type: 'agent',
        duration_ms: 50,
        input_tokens: 100,
        output_tokens: 20,
        cached_tokens: 50,
      });

      collector.addAgent({
        name: 'simple-agent',
        type: 'agent',
        duration_ms: 200,
        input_tokens: 500,
        output_tokens: 150,
        reasoning_tokens: 100,
      });

      const event = collector.toEvent();
      expect(event.inputTokens).toBe(600); // 100 + 500
      expect(event.outputTokens).toBe(170); // 20 + 150
      expect(event.totalTokens).toBe(770); // 600 + 170
      expect(event.cachedTokens).toBe(50);
      expect(event.reasoningTokens).toBe(100);
    });

    it('should include nested worker tokens in totals', () => {
      collector.addAgent({
        name: 'orchestrator',
        type: 'agent',
        duration_ms: 100,
        input_tokens: 200,
        output_tokens: 50,
        workers: [
          {
            name: 'code-worker',
            type: 'worker',
            duration_ms: 80,
            input_tokens: 300,
            output_tokens: 100,
          },
          {
            name: 'research-worker',
            type: 'worker',
            duration_ms: 120,
            input_tokens: 400,
            output_tokens: 150,
          },
        ],
      });

      const event = collector.toEvent();
      expect(event.inputTokens).toBe(900); // 200 + 300 + 400
      expect(event.outputTokens).toBe(300); // 50 + 100 + 150
      expect(event.totalTokens).toBe(1200);
    });
  });

  describe('isCompleted', () => {
    it('should return false initially', () => {
      expect(collector.isCompleted()).toBe(false);
    });

    it('should return true after complete with success', () => {
      collector.complete({ status: 'success' });
      expect(collector.isCompleted()).toBe(true);
    });

    it('should return true after complete with error', () => {
      collector.complete({ status: 'error' });
      expect(collector.isCompleted()).toBe(true);
    });
  });

  describe('getEventId', () => {
    it('should return the event ID', () => {
      expect(collector.getEventId()).toBe('test-event-123');
    });
  });
});
