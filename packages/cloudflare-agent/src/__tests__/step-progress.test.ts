import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createStepProgressTracker, StepProgressTracker } from '../step-progress.js';

describe('StepProgressTracker', () => {
  let mockOnUpdate: ReturnType<typeof vi.fn>;
  let tracker: StepProgressTracker;

  beforeEach(() => {
    vi.useFakeTimers();
    mockOnUpdate = vi.fn().mockResolvedValue(undefined);
    tracker = new StepProgressTracker(mockOnUpdate);
  });

  afterEach(() => {
    tracker.destroy();
    vi.useRealTimers();
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

      expect(mockOnUpdate).toHaveBeenCalledWith('🔄 Thinking. ...');
      expect(tracker.getExecutionPath()).toContain('thinking');
    });

    it('should handle routing step', async () => {
      await tracker.addStep({ type: 'routing', agentName: 'SimpleAgent' });

      expect(mockOnUpdate).toHaveBeenCalledWith('📡 Router → SimpleAgent');
      expect(tracker.getExecutionPath()).toContain('routing:SimpleAgent');
    });

    it('should handle tool_start step', async () => {
      await tracker.addStep({ type: 'tool_start', toolName: 'get_posts' });

      expect(mockOnUpdate).toHaveBeenCalledWith('⚙️ get_posts running. ...');
      expect(tracker.getExecutionPath()).toContain('tool:get_posts:start');
    });

    it('should handle tool_complete step', async () => {
      await tracker.addStep({
        type: 'tool_complete',
        toolName: 'get_posts',
        result: 'a'.repeat(1000), // 1KB
      });

      expect(mockOnUpdate).toHaveBeenCalledWith(expect.stringContaining('✅ get_posts returned'));
      expect(tracker.getExecutionPath()).toContain('tool:get_posts:complete');
    });

    it('should handle tool_error step', async () => {
      await tracker.addStep({
        type: 'tool_error',
        toolName: 'get_posts',
        error: 'Connection failed',
      });

      expect(mockOnUpdate).toHaveBeenCalledWith(
        expect.stringContaining('❌ get_posts: Connection failed')
      );
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

      // Second iteration shows progress
      await tracker.addStep({
        type: 'llm_iteration',
        iteration: 2,
        maxIterations: 5,
      });

      expect(mockOnUpdate).toHaveBeenCalledWith(expect.stringContaining('🔄 Processing (2/5)'));
    });

    it('should handle preparing step', async () => {
      await tracker.addStep({ type: 'preparing' });

      expect(mockOnUpdate).toHaveBeenCalledWith('📦 Preparing response. ...');
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

      // Should show both steps
      const lastCall = mockOnUpdate.mock.calls[0]![0] as string;
      expect(lastCall).toContain('📡 Router → SimpleAgent');
      expect(lastCall).toContain('✅ get_posts returned');
    });

    it('should show current step with rotating suffix', async () => {
      await tracker.addStep({ type: 'routing', agentName: 'SimpleAgent' });
      mockOnUpdate.mockClear();

      await tracker.addStep({ type: 'tool_start', toolName: 'get_posts' });

      // Should show completed routing + current tool running
      const lastCall = mockOnUpdate.mock.calls[0]![0] as string;
      expect(lastCall).toContain('📡 Router → SimpleAgent');
      expect(lastCall).toContain('⚙️ get_posts running. ...');
    });
  });

  describe('rotation', () => {
    it('should rotate suffix after interval', async () => {
      await tracker.addStep({ type: 'thinking' });

      expect(mockOnUpdate).toHaveBeenLastCalledWith('🔄 Thinking. ...');

      // Advance timer to trigger rotation
      await vi.advanceTimersByTime(5000);

      // Should have rotated to a different suffix
      expect(mockOnUpdate).toHaveBeenLastCalledWith(
        expect.stringMatching(/🔄 Thinking\. .+\.\.\./)
      );
    });

    it('should stop rotation when destroyed', async () => {
      await tracker.addStep({ type: 'thinking' });
      const callCount = mockOnUpdate.mock.calls.length;

      tracker.destroy();

      // Advance timer - should not trigger more updates
      await vi.advanceTimersByTime(10000);

      expect(mockOnUpdate.mock.calls.length).toBe(callCount);
    });

    it('should stop rotation when step changes', async () => {
      await tracker.addStep({ type: 'thinking' });

      // Add a completed step (stops rotation)
      await tracker.addStep({ type: 'routing', agentName: 'SimpleAgent' });
      const callCount = mockOnUpdate.mock.calls.length;

      // Advance timer - rotation should be stopped
      await vi.advanceTimersByTime(10000);

      // No additional calls from rotation
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
      mockOnUpdate.mockRejectedValueOnce(new Error('Edit failed'));

      // Should not throw
      await expect(tracker.addStep({ type: 'thinking' })).resolves.not.toThrow();
    });

    it('should not update after destroyed', async () => {
      tracker.destroy();
      mockOnUpdate.mockClear();

      await tracker.addStep({ type: 'thinking' });

      expect(mockOnUpdate).not.toHaveBeenCalled();
    });
  });

  describe('createStepProgressTracker helper', () => {
    it('should create a tracker', () => {
      const helper = createStepProgressTracker(mockOnUpdate);
      expect(helper).toBeInstanceOf(StepProgressTracker);
      helper.destroy();
    });

    it('should accept config', () => {
      const helper = createStepProgressTracker(mockOnUpdate, {
        rotationInterval: 3000,
      });
      expect(helper).toBeInstanceOf(StepProgressTracker);
      helper.destroy();
    });
  });
});
