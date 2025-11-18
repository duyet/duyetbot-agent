import { Agent } from '@/agent/core';
import { InMemorySessionManager } from '@/agent/session';
import { ClaudeProvider } from '@/providers/claude';
import { ToolRegistry } from '@/tools/registry';
import { sleepTool } from '@/tools/sleep';
import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('Agent Core', () => {
  let agent: Agent;
  let sessionManager: InMemorySessionManager;
  let provider: ClaudeProvider;
  let toolRegistry: ToolRegistry;

  beforeEach(() => {
    sessionManager = new InMemorySessionManager();
    provider = new ClaudeProvider();
    toolRegistry = new ToolRegistry();

    // Register basic tool
    toolRegistry.register(sleepTool);

    // Configure provider
    provider.configure({
      provider: 'claude',
      model: 'claude-3-5-sonnet-20241022',
      apiKey: 'test-api-key',
    });

    agent = new Agent({
      provider,
      sessionManager,
      toolRegistry,
    });
  });

  describe('initialization', () => {
    it('should create agent with required dependencies', () => {
      expect(agent).toBeInstanceOf(Agent);
    });

    it('should have access to provider', () => {
      const config = agent.getProvider().getConfig?.();
      expect(config).toBeDefined();
      expect(config!.provider).toBe('claude');
    });

    it('should have access to session manager', () => {
      expect(agent.getSessionManager()).toBe(sessionManager);
    });

    it('should have access to tool registry', () => {
      expect(agent.getToolRegistry()).toBe(toolRegistry);
    });
  });

  describe('session management', () => {
    it('should create new session', async () => {
      const session = await agent.createSession({
        metadata: { userId: 'user-123' },
      });

      expect(session.id).toBeDefined();
      expect(session.state).toBe('active');
      expect(session.metadata?.userId).toBe('user-123');
    });

    it('should get existing session', async () => {
      const created = await agent.createSession({});
      const retrieved = await agent.getSession(created.id);

      expect(retrieved?.id).toBe(created.id);
    });

    it('should list sessions', async () => {
      await agent.createSession({ metadata: { type: 'test1' } });
      await agent.createSession({ metadata: { type: 'test2' } });

      const sessions = await agent.listSessions();
      expect(sessions.length).toBeGreaterThanOrEqual(2);
    });

    it('should delete session', async () => {
      const session = await agent.createSession({});
      await agent.deleteSession(session.id);

      const retrieved = await agent.getSession(session.id);
      expect(retrieved).toBeUndefined();
    });
  });

  describe('message handling', () => {
    it('should send message to LLM', async () => {
      const session = await agent.createSession({});

      const messages = [{ role: 'user' as const, content: 'Hello!' }];

      // Mock the provider query
      vi.spyOn(provider, 'query').mockImplementation(async function* () {
        yield {
          content: 'Hi there!',
          model: 'claude-3-5-sonnet-20241022',
          provider: 'claude',
          usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
        };
      });

      const responses: string[] = [];
      for await (const response of agent.sendMessage(session.id, messages)) {
        if (response.content) {
          responses.push(response.content);
        }
      }

      expect(responses.length).toBeGreaterThan(0);
    });

    it('should accumulate messages in session', async () => {
      const session = await agent.createSession({});

      await agent.addMessage(session.id, { role: 'user', content: 'Hello' });
      await agent.addMessage(session.id, { role: 'assistant', content: 'Hi' });

      const updated = await agent.getSession(session.id);
      expect(updated?.messages?.length).toBe(2);
    });

    it('should support system messages', async () => {
      const session = await agent.createSession({});

      await agent.addMessage(session.id, {
        role: 'system',
        content: 'You are a helpful assistant',
      });
      await agent.addMessage(session.id, { role: 'user', content: 'Hello' });

      const updated = await agent.getSession(session.id);
      expect(updated).toBeDefined();
      expect(updated!.messages![0]!.role).toBe('system');
    });
  });

  describe('tool execution', () => {
    it('should have access to registered tools', () => {
      const tools = agent.getToolRegistry().list();
      expect(tools.includes('sleep')).toBe(true);
    });

    it('should execute tool directly', async () => {
      const result = await agent.executeTool('sleep', { duration: 10 });

      expect(result.status).toBe('success');
    });

    it('should handle tool execution errors', async () => {
      await expect(agent.executeTool('non-existent', {})).rejects.toThrow();
    });

    it('should track tool results in session', async () => {
      const session = await agent.createSession({});

      await agent.executeToolInSession(session.id, 'sleep', { duration: 10 });

      const updated = await agent.getSession(session.id);
      expect(updated).toBeDefined();
      expect(updated!.toolResults!.length).toBe(1);
      expect(updated!.toolResults![0]!.toolName).toBe('sleep');
    });
  });

  describe('session state transitions', () => {
    it('should pause active session', async () => {
      const session = await agent.createSession({});
      const paused = await agent.pauseSession(session.id);

      expect(paused.state).toBe('paused');
    });

    it('should resume paused session', async () => {
      const session = await agent.createSession({});
      await agent.pauseSession(session.id);

      const resumed = await agent.resumeSession(session.id);

      expect(resumed.state).toBe('active');
    });

    it('should complete session', async () => {
      const session = await agent.createSession({});
      const completed = await agent.completeSession(session.id);

      expect(completed.state).toBe('completed');
      expect(completed.completedAt).toBeInstanceOf(Date);
    });

    it('should fail session with error', async () => {
      const session = await agent.createSession({});
      const failed = await agent.failSession(session.id, {
        message: 'Test error',
        code: 'TEST_ERROR',
      });

      expect(failed.state).toBe('failed');
      expect(failed.error?.message).toBe('Test error');
    });

    it('should cancel session', async () => {
      const session = await agent.createSession({});
      const cancelled = await agent.cancelSession(session.id);

      expect(cancelled.state).toBe('cancelled');
    });
  });

  describe('provider configuration', () => {
    it('should use configured provider', () => {
      const config = agent.getProvider().getConfig?.();
      expect(config).toBeDefined();
      expect(config!.model).toBe('claude-3-5-sonnet-20241022');
    });

    it('should allow provider override per session', async () => {
      const session = await agent.createSession({
        provider: {
          provider: 'claude',
          model: 'claude-3-5-haiku-20241022',
          apiKey: 'test-key',
        },
      });

      expect(session.provider?.model).toBe('claude-3-5-haiku-20241022');
    });
  });

  describe('error handling', () => {
    it('should handle session not found', async () => {
      await expect(agent.getSession('non-existent')).resolves.toBeUndefined();
    });

    it('should handle invalid session operations', async () => {
      const session = await agent.createSession({});
      await agent.completeSession(session.id);

      await expect(agent.pauseSession(session.id)).rejects.toThrow();
    });
  });

  describe('metadata management', () => {
    it('should store session metadata', async () => {
      const session = await agent.createSession({
        metadata: {
          userId: 'user-123',
          taskId: 'task-456',
          custom: { nested: 'value' },
        },
      });

      expect(session.metadata?.userId).toBe('user-123');
      expect(session.metadata?.taskId).toBe('task-456');
    });

    it('should update session metadata', async () => {
      const session = await agent.createSession({ metadata: { key1: 'value1' } });

      await agent.updateSessionMetadata(session.id, { key2: 'value2' });

      const updated = await agent.getSession(session.id);
      expect(updated?.metadata?.key2).toBe('value2');
    });
  });
});
