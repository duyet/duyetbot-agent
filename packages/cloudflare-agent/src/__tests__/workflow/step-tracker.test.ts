import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { StepProgressTracker } from '../../workflow/step-tracker.js';

describe('StepProgressTracker', () => {
  let mockOnUpdate: ReturnType<typeof vi.fn>;
  let tracker: StepProgressTracker;

  beforeEach(() => {
    mockOnUpdate = vi.fn(async () => {});
    tracker = new StepProgressTracker(mockOnUpdate);
  });

  afterEach(() => {
    tracker.destroy();
  });

  describe('constructor', () => {
    it('should create a tracker with default config', () => {
      expect(tracker).toBeInstanceOf(StepProgressTracker);
      expect(tracker.destroyed).toBe(false);
    });

    it('should accept custom config', () => {
      const customTracker = new StepProgressTracker(mockOnUpdate, {
        rotationInterval: 3000,
        maxResultPreview: 100,
      });
      expect(customTracker).toBeInstanceOf(StepProgressTracker);
      customTracker.destroy();
    });
  });

  describe('addStep', () => {
    it('should handle thinking step with random verb', async () => {
      await tracker.addStep({ type: 'thinking' });

      // Random thinking verbs already include "..." suffix
      expect(mockOnUpdate).toHaveBeenCalledWith(expect.stringMatching(/^\* .+\.{3}$/));
      expect(tracker.getExecutionPath()).toContain('thinking');
    });

    it('should handle thinking step with actual LLM content', async () => {
      await tracker.addStep({
        type: 'thinking',
        thinking: 'I will analyze the codebase first to understand the structure.',
      });

      // Should show actual thinking text without ellipsis
      expect(mockOnUpdate).toHaveBeenCalledWith(
        '* I will analyze the codebase first to understand the structure.'
      );
      expect(tracker.getExecutionPath()).toContain('thinking');
    });

    it('should truncate long thinking text', async () => {
      const longText = 'A'.repeat(150);
      await tracker.addStep({
        type: 'thinking',
        thinking: longText,
      });

      // Should truncate to ~100 chars with "..." suffix
      const call = mockOnUpdate.mock.calls[0][0] as string;
      expect(call).toMatch(/^\* A{97}\.\.\.$/);
    });

    it('should handle routing step', async () => {
      await tracker.addStep({ type: 'routing', agentName: 'SimpleAgent' });

      // New format: ⏺ Router → AgentName (completed step in chain)
      expect(mockOnUpdate).toHaveBeenCalledWith('⏺ Router → SimpleAgent');
      expect(tracker.getExecutionPath()).toContain('routing:SimpleAgent');
    });

    it('should handle tool_start step', async () => {
      await tracker.addStep({ type: 'tool_start', toolName: 'get_posts' });

      // New format: * toolname()\n  ⎿ Running… (running step with * prefix)
      const lastCall = mockOnUpdate.mock.calls[0][0] as string;
      expect(lastCall).toContain('* get_posts()');
      expect(lastCall).toContain('⎿ Running…');
      expect(tracker.getExecutionPath()).toContain('tool:get_posts:start');
    });

    it('should handle tool_complete step', async () => {
      await tracker.addStep({
        type: 'tool_complete',
        toolName: 'get_posts',
        result: 'a'.repeat(1000), // 1KB
      });

      // Tool complete shows as "⏺ toolname" in completed steps
      const lastCall = mockOnUpdate.mock.calls[0][0] as string;
      expect(lastCall).toContain('⏺ get_posts');
      expect(tracker.getExecutionPath()).toContain('tool:get_posts:complete');
    });

    it('should handle tool_error step', async () => {
      await tracker.addStep({
        type: 'tool_error',
        toolName: 'get_posts',
        error: 'Connection failed',
      });

      const lastCall = mockOnUpdate.mock.calls[0][0] as string;
      // New format: ⏺ toolname()\n  ⎿ ❌ error message (completed with error)
      expect(lastCall).toContain('⏺ get_posts()');
      expect(lastCall).toContain('⎿ ❌ Connection failed');
      expect(tracker.getExecutionPath()).toContain('tool:get_posts:error');
    });

    it('should handle llm_iteration step', async () => {
      // First iteration doesn't show progress indicator
      await tracker.addStep({
        type: 'llm_iteration',
        iteration: 1,
        maxIterations: 5,
      });

      expect(tracker.getExecutionPath()).toContain('llm:1/5');

      // Second iteration shows progress with Claude Code style
      await tracker.addStep({
        type: 'llm_iteration',
        iteration: 2,
        maxIterations: 5,
      });

      const lastCalls = mockOnUpdate.mock.calls;
      const lastMessage = lastCalls[lastCalls.length - 1][0] as string;
      // Random thinking verbs already include "..." suffix
      expect(lastMessage).toMatch(/^\* .+\.{3}$/);
    });

    it('should handle preparing step', async () => {
      await tracker.addStep({ type: 'preparing' });

      // Preparing message includes "..." suffix
      expect(mockOnUpdate).toHaveBeenCalledWith('* Preparing response...');
      expect(tracker.getExecutionPath()).toContain('preparing');
    });
  });

  describe('step accumulation', () => {
    it('should accumulate completed steps', async () => {
      await tracker.addStep({ type: 'routing', agentName: 'SimpleAgent' });
      mockOnUpdate.mockClear();

      await tracker.addStep({
        type: 'tool_complete',
        toolName: 'get_posts',
        result: 'data',
      });

      // New format: shows completed routing + completed tool with ⏺ prefix
      const lastCall = mockOnUpdate.mock.calls[0][0] as string;
      expect(lastCall).toContain('⏺ Router → SimpleAgent');
      expect(lastCall).toContain('⏺ get_posts()');
    });

    it('should show current step with rotating suffix', async () => {
      await tracker.addStep({ type: 'routing', agentName: 'SimpleAgent' });
      mockOnUpdate.mockClear();

      await tracker.addStep({ type: 'tool_start', toolName: 'get_posts' });

      // New format: completed routing (⏺) + running tool (* prefix)
      const lastCall = mockOnUpdate.mock.calls[0][0] as string;
      expect(lastCall).toContain('⏺ Router → SimpleAgent');
      expect(lastCall).toContain('* get_posts()');
      expect(lastCall).toContain('⎿ Running…');
    });
  });

  describe('rotation', () => {
    it('should rotate suffix after interval', async () => {
      // Create tracker with very fast rotation
      tracker.destroy();
      tracker = new StepProgressTracker(mockOnUpdate, { rotationInterval: 10 });

      await tracker.addStep({ type: 'thinking' });

      const initialCallCount = mockOnUpdate.mock.calls.length;
      // First call should be random thinking verb with "..." suffix
      const firstCall = mockOnUpdate.mock.calls[0][0] as string;
      expect(firstCall).toMatch(/^\* .+\.{3}$/);

      // Wait for rotation (allow some buffer)
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(mockOnUpdate.mock.calls.length).toBeGreaterThan(initialCallCount);

      // All calls should be random thinking verbs with "..." suffix
      const calls = mockOnUpdate.mock.calls.map((c) => c[0] as string);
      for (const call of calls) {
        expect(call).toMatch(/^\* .+\.{3}/);
      }
    });

    it('should stop rotation when destroyed', async () => {
      tracker.destroy();
      tracker = new StepProgressTracker(mockOnUpdate, { rotationInterval: 10 });
      await tracker.addStep({ type: 'thinking' });

      const callCount = mockOnUpdate.mock.calls.length;

      tracker.destroy();

      // Wait - should not trigger more updates
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(mockOnUpdate.mock.calls.length).toBe(callCount);
    });

    it('should stop rotation when step changes', async () => {
      tracker.destroy();
      tracker = new StepProgressTracker(mockOnUpdate, { rotationInterval: 10 });
      await tracker.addStep({ type: 'thinking' });

      // Add a completed step (stops rotation)
      await tracker.addStep({ type: 'routing', agentName: 'SimpleAgent' });
      const callCount = mockOnUpdate.mock.calls.length;

      // Wait - rotation should be stopped
      await new Promise((resolve) => setTimeout(resolve, 50));

      // No additional calls from rotation (only the calls from addStep itself)
      // Note: addStep calls update(), so callCount tracks that.
      // Rotation would add MORE calls if it was running.
      expect(mockOnUpdate.mock.calls.length).toBe(callCount);
    });
  });

  describe('execution path', () => {
    it('should track full execution path', async () => {
      await tracker.addStep({ type: 'thinking' });
      await tracker.addStep({ type: 'routing', agentName: 'SimpleAgent' });
      await tracker.addStep({ type: 'tool_start', toolName: 'get_posts' });
      await tracker.addStep({
        type: 'tool_complete',
        toolName: 'get_posts',
        result: 'data',
      });
      await tracker.addStep({ type: 'preparing' });

      const path = tracker.getExecutionPath();
      expect(path).toEqual([
        'thinking',
        'routing:SimpleAgent',
        'tool:get_posts:start',
        'tool:get_posts:complete',
        'preparing',
      ]);
    });

    it('should format execution path as string', async () => {
      await tracker.addStep({ type: 'thinking' });
      await tracker.addStep({ type: 'routing', agentName: 'SimpleAgent' });
      await tracker.addStep({
        type: 'tool_complete',
        toolName: 'get_posts',
        result: 'data',
      });

      const pathStr = tracker.getExecutionPathString();
      expect(pathStr).toBe('thinking → SimpleAgent → get_posts');
    });
  });

  describe('error handling', () => {
    it('should not throw when update callback fails', async () => {
      // Create a tracker where onUpdate rejected
      const failingUpdate = vi.fn(async () => {
        throw new Error('Edit failed');
      });
      const failingTracker = new StepProgressTracker(failingUpdate);

      // Should not throw
      try {
        await failingTracker.addStep({ type: 'thinking' });
      } catch (e) {
        expect(e).toBeUndefined();
      }
      failingTracker.destroy();
    });

    it('should not update after destroyed', async () => {
      tracker.destroy();
      mockOnUpdate.mockClear();

      await tracker.addStep({ type: 'thinking' });

      expect(mockOnUpdate).not.toHaveBeenCalled();
    });
  });

  describe('parallel tools tracking', () => {
    it('should track parallel tools execution', async () => {
      const tools = [
        { id: 'tool1', toolName: 'get_user', args: { id: '123' } },
        { id: 'tool2', toolName: 'get_posts', args: { userId: '123' } },
      ];

      const groupId = await tracker.addParallelTools(tools);

      expect(groupId).toBeTruthy();
      const lastCall = mockOnUpdate.mock.calls[0][0] as string;
      expect(lastCall).toContain('Parallel execution');
      expect(lastCall).toContain('get_user, get_posts');
      expect(tracker.getExecutionPath()).toContain('parallel_tools');
    });

    it('should update individual tool in parallel group', async () => {
      const tools = [
        { id: 'tool1', toolName: 'get_user', args: { id: '123' } },
        { id: 'tool2', toolName: 'get_posts', args: { userId: '123' } },
      ];

      await tracker.addParallelTools(tools);
      mockOnUpdate.mockClear();

      await tracker.updateParallelTool('tool1', {
        status: 'completed',
        result: 'User data',
        durationMs: 100,
      });

      // Should trigger update
      expect(mockOnUpdate).toHaveBeenCalled();
    });

    it('should handle parallel tool errors', async () => {
      const tools = [{ id: 'tool1', toolName: 'get_user', args: { id: '123' } }];

      await tracker.addParallelTools(tools);
      mockOnUpdate.mockClear();

      await tracker.updateParallelTool('tool1', {
        status: 'error',
        error: 'Connection timeout',
        durationMs: 5000,
      });

      expect(mockOnUpdate).toHaveBeenCalled();
    });
  });

  describe('sub-agent tracking', () => {
    it('should track sub-agent execution', async () => {
      const subAgentId = await tracker.addSubAgent('Plan', 'Create implementation plan');

      expect(subAgentId).toBeTruthy();
      const lastCall = mockOnUpdate.mock.calls[0][0] as string;
      expect(lastCall).toContain('Sub-agent: Plan');
      expect(tracker.getExecutionPath()).toContain('subagent:Plan');
    });

    it('should complete sub-agent execution', async () => {
      const subAgentId = await tracker.addSubAgent('Explore', 'Explore codebase');
      mockOnUpdate.mockClear();

      await tracker.completeSubAgent(subAgentId, {
        toolUses: 5,
        tokenCount: 1000,
        durationMs: 2000,
        result: 'Found 3 relevant files',
      });

      expect(mockOnUpdate).toHaveBeenCalled();
    });

    it('should handle sub-agent errors', async () => {
      const subAgentId = await tracker.addSubAgent('Research', 'Research topic');
      mockOnUpdate.mockClear();

      await tracker.completeSubAgent(subAgentId, {
        error: 'API rate limit exceeded',
        durationMs: 1000,
      });

      expect(mockOnUpdate).toHaveBeenCalled();
    });
  });
});
