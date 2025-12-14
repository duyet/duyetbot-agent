import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test';
import { StepProgressTracker } from '../../workflow/step-tracker.js';

describe('StepProgressTracker', () => {
  let mockOnUpdate: ReturnType<typeof mock>;
  let tracker: StepProgressTracker;

  beforeEach(() => {
    mockOnUpdate = mock(async () => {});
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
    it('should handle thinking step', async () => {
      await tracker.addStep({ type: 'thinking' });

      // Claude Code style with * prefix and ellipsis character
      expect(mockOnUpdate).toHaveBeenCalledWith(expect.stringMatching(/^\* \w+…$/));
      expect(tracker.getExecutionPath()).toContain('thinking');
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
      // Should show Claude Code style thinking
      expect(lastMessage).toMatch(/^\* \w+…$/);
    });

    it('should handle preparing step', async () => {
      await tracker.addStep({ type: 'preparing' });

      // New format: * Preparing response… (running step with * prefix)
      expect(mockOnUpdate).toHaveBeenCalledWith('* Preparing response…');
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
      // First call should be Claude Code style
      const firstCall = mockOnUpdate.mock.calls[0][0] as string;
      expect(firstCall).toMatch(/^\* \w+…$/);

      // Wait for rotation (allow some buffer)
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(mockOnUpdate.mock.calls.length).toBeGreaterThan(initialCallCount);

      // All calls should be Claude Code style with rotating verbs
      const calls = mockOnUpdate.mock.calls.map((c) => c[0] as string);
      for (const call of calls) {
        expect(call).toMatch(/^\* \w+…/);
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
      const failingUpdate = mock(async () => {
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
});
