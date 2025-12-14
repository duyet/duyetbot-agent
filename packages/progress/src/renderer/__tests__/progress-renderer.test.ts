import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  LlmIterationStep,
  PreparingStep,
  RoutingStep,
  StepCollection,
  ThinkingStep,
  ToolCompleteStep,
  ToolErrorStep,
  ToolStartStep,
} from '../../types.js';
import { ProgressRenderer } from '../progress-renderer.js';

describe('ProgressRenderer', () => {
  let renderer: ProgressRenderer;

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
    if (renderer) {
      renderer.destroy();
    }
  });

  function createCollection(steps: StepCollection['steps'] = []): StepCollection {
    return {
      steps,
      startedAt: new Date().toISOString(),
    };
  }

  function createThinkingStep(thinking?: string): ThinkingStep {
    return {
      type: 'thinking',
      iteration: 1,
      timestamp: new Date().toISOString(),
      durationMs: 0,
      thinking,
    };
  }

  function createRoutingStep(agentName: string): RoutingStep {
    return {
      type: 'routing',
      iteration: 1,
      timestamp: new Date().toISOString(),
      durationMs: 100,
      agentName,
    };
  }

  function createToolStartStep(toolName: string, args: Record<string, unknown>): ToolStartStep {
    return {
      type: 'tool_start',
      iteration: 1,
      timestamp: new Date().toISOString(),
      durationMs: 0,
      toolName,
      args,
    };
  }

  function createToolCompleteStep(
    toolName: string,
    args: Record<string, unknown>,
    result: string
  ): ToolCompleteStep {
    return {
      type: 'tool_complete',
      iteration: 1,
      timestamp: new Date().toISOString(),
      durationMs: 150,
      toolName,
      args,
      result,
    };
  }

  function createToolErrorStep(
    toolName: string,
    args: Record<string, unknown>,
    error: string
  ): ToolErrorStep {
    return {
      type: 'tool_error',
      iteration: 1,
      timestamp: new Date().toISOString(),
      durationMs: 50,
      toolName,
      args,
      error,
    };
  }

  function createPreparingStep(): PreparingStep {
    return {
      type: 'preparing',
      iteration: 1,
      timestamp: new Date().toISOString(),
      durationMs: 0,
    };
  }

  function createLlmIterationStep(iteration: number, maxIterations: number): LlmIterationStep {
    return {
      type: 'llm_iteration',
      iteration,
      timestamp: new Date().toISOString(),
      durationMs: 0,
      maxIterations,
    };
  }

  describe('basic rendering', () => {
    it('empty collection renders thinking message', () => {
      renderer = new ProgressRenderer();
      const collection = createCollection([]);

      const output = renderer.render(collection);

      expect(output).toMatch(/^\* .+$/);
      expect(output).toContain('...');
    });

    it('single thinking step renders with * prefix', () => {
      renderer = new ProgressRenderer();
      const collection = createCollection([createThinkingStep('Analyzing code')]);

      const output = renderer.render(collection);

      expect(output).toMatch(/^\* .+$/);
    });

    it('completed thinking step renders with ⏺ prefix', () => {
      renderer = new ProgressRenderer();
      const collection = createCollection([
        createThinkingStep('Analyzing code'),
        createRoutingStep('CodeAgent'),
      ]);

      const output = renderer.render(collection);

      expect(output).toContain('⏺ Analyzing code');
    });

    it('completed routing step renders with ⏺ prefix', () => {
      renderer = new ProgressRenderer();
      const collection = createCollection([createRoutingStep('CodeAgent')]);

      const output = renderer.render(collection);

      expect(output).toContain('⏺ Router → CodeAgent');
    });

    it('preparing step renders correctly', () => {
      renderer = new ProgressRenderer();
      const collection = createCollection([createPreparingStep()]);

      const output = renderer.render(collection);

      expect(output).toContain('⏺ Preparing response');
    });

    it('llm iteration step renders correctly', () => {
      renderer = new ProgressRenderer();
      const collection = createCollection([createLlmIterationStep(2, 5)]);

      const output = renderer.render(collection);

      expect(output).toContain('⏺ LLM iteration 2/5');
    });

    it('llm iteration step with iteration 1 is skipped', () => {
      renderer = new ProgressRenderer();
      const collection = createCollection([createLlmIterationStep(1, 5)]);

      const output = renderer.render(collection);

      // Should show default thinking message instead
      expect(output).toMatch(/^\* .+$/);
      expect(output).not.toContain('iteration');
    });
  });

  describe('tool rendering', () => {
    it('tool start renders with * prefix and Running…', () => {
      renderer = new ProgressRenderer();
      const collection = createCollection([createToolStartStep('bash', { command: 'ls -la' })]);

      const output = renderer.render(collection);

      expect(output).toContain('* bash(command: "ls -la")');
      expect(output).toContain('⎿ Running…');
    });

    it('tool complete renders with ⏺ prefix and result', () => {
      renderer = new ProgressRenderer();
      const collection = createCollection([
        createToolCompleteStep('bash', { command: 'echo hello' }, 'hello\n'),
      ]);

      const output = renderer.render(collection);

      expect(output).toContain('⏺ bash(command: "echo hello")');
      expect(output).toContain('⎿ hello');
    });

    it('tool error renders with ⏺ prefix and ❌ error', () => {
      renderer = new ProgressRenderer();
      const collection = createCollection([
        createToolErrorStep('bash', { command: 'invalid' }, 'Command not found'),
      ]);

      const output = renderer.render(collection);

      expect(output).toContain('⏺ bash(command: "invalid")');
      expect(output).toContain('⎿ ❌ Command not found');
    });

    it('tool args are formatted with priority', () => {
      renderer = new ProgressRenderer();
      const collection = createCollection([
        createToolStartStep('git', {
          action: 'commit',
          message: 'test',
          files: ['file.ts'],
        }),
      ]);

      const output = renderer.render(collection);

      expect(output).toContain('git(');
      // formatToolArgs now prioritizes 'message' key
      expect(output).toContain('message: "test"');
      // Other args are not shown (only priority arg is displayed)
      expect(output).not.toContain('action: "commit"');
      expect(output).not.toContain('files: ["file.ts"]');
    });

    it('tool results are truncated', () => {
      renderer = new ProgressRenderer({ maxResultPreview: 20 });
      const longResult = 'x'.repeat(100);
      const collection = createCollection([
        createToolCompleteStep('bash', { command: 'test' }, longResult),
      ]);

      const output = renderer.render(collection);

      expect(output).toContain('⎿');
      expect(output).not.toContain('x'.repeat(100));
      expect(output).toContain('...');
    });
  });

  describe('multiple steps', () => {
    it('multiple completed steps accumulate', () => {
      renderer = new ProgressRenderer();
      const collection = createCollection([
        createRoutingStep('CodeAgent'),
        createToolCompleteStep('bash', { command: 'ls' }, 'file.ts'),
        createToolCompleteStep('git', { action: 'status' }, 'clean'),
      ]);

      const output = renderer.render(collection);

      expect(output).toContain('⏺ Router → CodeAgent');
      expect(output).toContain('⏺ bash(command: "ls")');
      expect(output).toContain('⏺ git(action: "status")');
    });

    it('current step shows after completed steps', () => {
      renderer = new ProgressRenderer();
      const collection = createCollection([
        createRoutingStep('CodeAgent'),
        createToolCompleteStep('bash', { command: 'ls' }, 'file.ts'),
        createToolStartStep('git', { action: 'commit' }),
      ]);

      const output = renderer.render(collection);

      expect(output).toContain('⏺ Router → CodeAgent');
      expect(output).toContain('⏺ bash(command: "ls")');
      expect(output).toContain('* git(action: "commit")');
      expect(output).toContain('⎿ Running…');
    });

    it('mixed steps render correctly', () => {
      renderer = new ProgressRenderer();
      const collection = createCollection([
        createThinkingStep('Analyzing'),
        createRoutingStep('CodeAgent'),
        createToolStartStep('bash', { command: 'pwd' }),
      ]);

      const output = renderer.render(collection);

      expect(output).toContain('⏺ Analyzing');
      expect(output).toContain('⏺ Router → CodeAgent');
      expect(output).toContain('* bash(command: "pwd")');
    });
  });

  describe('rotation', () => {
    it('rotation starts and calls onUpdate', async () => {
      renderer = new ProgressRenderer({ rotationInterval: 100 });
      const onUpdate = vi.fn().mockResolvedValue(undefined);

      renderer.startRotation(onUpdate);

      expect(onUpdate).not.toHaveBeenCalled();

      // Advance time to trigger rotation
      await vi.advanceTimersByTimeAsync(100);

      // Should not call onUpdate directly - consumer renders themselves
      expect(onUpdate).not.toHaveBeenCalled();
    });

    it('rotation can be stopped', async () => {
      renderer = new ProgressRenderer({ rotationInterval: 100 });
      const onUpdate = vi.fn().mockResolvedValue(undefined);

      renderer.startRotation(onUpdate);
      renderer.stopRotation();

      // Advance time - should not trigger rotation
      await vi.advanceTimersByTimeAsync(500);

      expect(onUpdate).not.toHaveBeenCalled();
    });

    it('waitForPending waits for callbacks', async () => {
      renderer = new ProgressRenderer({ rotationInterval: 100 });
      let resolveCallback: (() => void) | null = null;
      const pendingPromise = new Promise<void>((resolve) => {
        resolveCallback = resolve;
      });
      const onUpdate = vi.fn().mockReturnValue(pendingPromise);

      renderer.startRotation(onUpdate);

      // Trigger rotation
      await vi.advanceTimersByTimeAsync(100);

      // Stop rotation to prevent infinite loop
      renderer.stopRotation();

      // Start waiting (don't await yet)
      const waitPromise = renderer.waitForPending();

      // Should not resolve yet
      let resolved = false;
      void waitPromise.then(() => {
        resolved = true;
      });

      // Try to advance - should still be pending
      await Promise.resolve();
      expect(resolved).toBe(false);

      // Resolve the callback
      resolveCallback?.();
      await waitPromise;
      expect(resolved).toBe(true);
    });

    it('destroy cleans up', async () => {
      renderer = new ProgressRenderer({ rotationInterval: 100 });
      const onUpdate = vi.fn().mockResolvedValue(undefined);

      renderer.startRotation(onUpdate);
      renderer.destroy();

      // Should not crash
      const collection = createCollection([]);
      const output = renderer.render(collection);
      expect(output).toBe('');

      // Advance time - should not trigger rotation
      await vi.advanceTimersByTimeAsync(500);
      expect(onUpdate).not.toHaveBeenCalled();
    });
  });

  describe('edge cases', () => {
    it('handles empty args', () => {
      renderer = new ProgressRenderer();
      const collection = createCollection([createToolStartStep('bash', {})]);

      const output = renderer.render(collection);

      expect(output).toContain('bash()');
    });

    it('handles empty result', () => {
      renderer = new ProgressRenderer();
      const collection = createCollection([createToolCompleteStep('bash', {}, '')]);

      const output = renderer.render(collection);

      expect(output).toContain('⏺ bash()');
      expect(output).not.toContain('⎿ ');
    });

    it('handles multiline result', () => {
      renderer = new ProgressRenderer({ maxResultPreview: 100 });
      const collection = createCollection([
        createToolCompleteStep('bash', {}, 'line1\nline2\nline3'),
      ]);

      const output = renderer.render(collection);

      // Should truncate to first line
      expect(output).toContain('⎿ line1');
    });

    it('handles custom rotation interval', () => {
      renderer = new ProgressRenderer({ rotationInterval: 5000 });
      expect(renderer).toBeDefined();
    });

    it('handles custom maxResultPreview', () => {
      renderer = new ProgressRenderer({ maxResultPreview: 30 });
      const longResult = 'x'.repeat(100);
      const collection = createCollection([createToolCompleteStep('bash', {}, longResult)]);

      const output = renderer.render(collection);

      // Result should be truncated to ~30 chars
      const resultLine = output.split('\n').find((line) => line.includes('⎿'));
      expect(resultLine!.length).toBeLessThan(50);
    });

    it('thinking step without thinking text shows default', () => {
      renderer = new ProgressRenderer();
      const collection = createCollection([createThinkingStep()]);

      const output = renderer.render(collection);

      expect(output).toMatch(/^\* .+$/);
    });

    it('multiple tool errors accumulate', () => {
      renderer = new ProgressRenderer();
      const collection = createCollection([
        createToolErrorStep('bash', {}, 'Error 1'),
        createToolErrorStep('git', {}, 'Error 2'),
      ]);

      const output = renderer.render(collection);

      expect(output).toContain('⏺ bash()');
      expect(output).toContain('⎿ ❌ Error 1');
      expect(output).toContain('⏺ git()');
      expect(output).toContain('⎿ ❌ Error 2');
    });
  });
});
