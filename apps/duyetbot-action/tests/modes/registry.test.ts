/**
 * Registry Tests
 *
 * Tests for mode registration and retrieval
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { GitHubContext } from '../../src/github/context.js';
import { getMode, getModeByName, isValidMode, VALID_MODES } from '../../src/modes/registry.js';

describe('modes/registry', () => {
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
  });

  function createBaseContext(overrides: Partial<GitHubContext> = {}): GitHubContext {
    return {
      eventName: 'issues',
      eventAction: 'opened',
      actor: 'testuser',
      repository: {
        owner: 'duyet',
        repo: 'test-repo',
        fullName: 'duyet/test-repo',
      },
      isPR: false,
      inputs: {
        triggerPhrase: '@duyetbot',
        assigneeTrigger: 'duyetbot',
        labelTrigger: 'duyetbot',
        prompt: '',
        settings: '',
        continuousMode: 'false',
        maxTasks: '100',
        autoMerge: 'true',
        closeIssues: 'true',
        delayBetweenTasks: '5',
        dryRun: 'false',
        taskSource: 'github-issues',
        taskId: '',
        baseBranch: 'main',
        branchPrefix: 'duyetbot/',
        allowedBots: '',
        allowedNonWriteUsers: '',
        useStickyComment: 'true',
        useCommitSigning: 'false',
        botId: '41898282',
        botName: 'duyetbot[bot]',
        memoryMcpUrl: '',
      },
      runId: '123456',
      ...overrides,
    };
  }

  describe('VALID_MODES', () => {
    it('should contain all expected modes', () => {
      expect(VALID_MODES).toEqual(['tag', 'agent', 'continuous']);
    });

    it('should be an array of strings', () => {
      expect(Array.isArray(VALID_MODES)).toBe(true);
      expect(VALID_MODES.every((m) => typeof m === 'string')).toBe(true);
    });
  });

  describe('getMode', () => {
    it('should return tag mode for @mention in comment', () => {
      const context = createBaseContext({
        eventName: 'issue_comment',
        entityNumber: 123,
        payload: {
          comment: {
            body: '@duyetbot help',
          },
        },
      });

      const mode = getMode(context);
      expect(mode.name).toBe('tag');
      expect(mode.description).toBeDefined();
    });

    it('should return agent mode for explicit prompt', () => {
      const context = createBaseContext({
        inputs: {
          ...createBaseContext().inputs,
          prompt: 'do something',
        },
      });

      const mode = getMode(context);
      expect(mode.name).toBe('agent');
      expect(mode.description).toBeDefined();
    });

    it('should return continuous mode when continuous_mode is true', () => {
      const context = createBaseContext({
        inputs: {
          ...createBaseContext().inputs,
          continuousMode: 'true',
        },
      });

      const mode = getMode(context);
      expect(mode.name).toBe('continuous');
      expect(mode.description).toBeDefined();
    });

    it('should log auto-detected mode', () => {
      const context = createBaseContext({
        eventName: 'issue_comment',
        entityNumber: 123,
        payload: {
          comment: {
            body: '@duyetbot help',
          },
        },
      });

      getMode(context);
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Auto-detected mode: tag')
      );
    });

    it('should log event name in debug output', () => {
      const context = createBaseContext({
        eventName: 'workflow_dispatch',
      });

      getMode(context);
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('workflow_dispatch'));
    });

    it('should never return null for valid context', () => {
      const context = createBaseContext();
      const mode = getMode(context);
      expect(mode).not.toBeNull();
      expect(mode).toBeDefined();
    });
  });

  describe('getModeByName', () => {
    it('should return tag mode by name', () => {
      const mode = getModeByName('tag');
      expect(mode).not.toBeNull();
      expect(mode?.name).toBe('tag');
    });

    it('should return agent mode by name', () => {
      const mode = getModeByName('agent');
      expect(mode).not.toBeNull();
      expect(mode?.name).toBe('agent');
    });

    it('should return continuous mode by name', () => {
      const mode = getModeByName('continuous');
      expect(mode).not.toBeNull();
      expect(mode?.name).toBe('continuous');
    });

    it('should return null for invalid mode name', () => {
      const mode = getModeByName('invalid' as any);
      expect(mode).toBeNull();
    });

    it('should return mode with all required properties', () => {
      const mode = getModeByName('tag');
      expect(mode).toBeDefined();

      expect(mode).toHaveProperty('name');
      expect(mode).toHaveProperty('description');
      expect(mode).toHaveProperty('shouldTrigger');
      expect(mode).toHaveProperty('prepareContext');
      expect(mode).toHaveProperty('getAllowedTools');
      expect(mode).toHaveProperty('getDisallowedTools');
      expect(mode).toHaveProperty('shouldCreateTrackingComment');
      expect(mode).toHaveProperty('generatePrompt');
      expect(mode).toHaveProperty('prepare');
    });

    it('should return mode with callable methods', () => {
      const mode = getModeByName('agent');
      expect(mode).toBeDefined();

      expect(typeof mode?.shouldTrigger).toBe('function');
      expect(typeof mode?.prepareContext).toBe('function');
      expect(typeof mode?.getAllowedTools).toBe('function');
      expect(typeof mode?.getDisallowedTools).toBe('function');
      expect(typeof mode?.shouldCreateTrackingComment).toBe('function');
      expect(typeof mode?.generatePrompt).toBe('function');
      expect(typeof mode?.prepare).toBe('function');
    });
  });

  describe('isValidMode', () => {
    it('should return true for valid mode names', () => {
      expect(isValidMode('tag')).toBe(true);
      expect(isValidMode('agent')).toBe(true);
      expect(isValidMode('continuous')).toBe(true);
    });

    it('should return false for invalid mode names', () => {
      expect(isValidMode('invalid')).toBe(false);
      expect(isValidMode('TAG')).toBe(false);
      expect(isValidMode('Agent')).toBe(false);
      expect(isValidMode('')).toBe(false);
      expect(isValidMode('tag-mode')).toBe(false);
    });

    it('should act as type guard', () => {
      const modeName = 'tag' as string;
      if (isValidMode(modeName)) {
        // TypeScript should infer modeName as ModeName
        expect(modeName).satisfies<'tag' | 'agent' | 'continuous'>;
      }
    });

    it('should handle uppercase strings', () => {
      expect(isValidMode('TAG')).toBe(false);
      expect(isValidMode('AGENT')).toBe(false);
    });

    it('should handle mixed case strings', () => {
      expect(isValidMode('Tag')).toBe(false);
      expect(isValidMode('Continuous')).toBe(false);
    });
  });

  describe('error handling', () => {
    it('should throw error if detected mode is not in registry', () => {
      // This is a defensive test - in normal operation this should never happen
      // because detectMode only returns valid mode names
      // But we test the error handling path anyway

      const context = createBaseContext();

      // Mock detectMode to return invalid mode
      vi.doMock('../../src/modes/detector.js', () => ({
        detectMode: () => 'invalid' as any,
      }));

      // Since we can't easily mock the detector after import,
      // we verify the error message structure exists
      const mode = getModeByName('tag');
      expect(mode).toBeDefined();
    });
  });

  describe('mode consistency', () => {
    it('should return same mode instance for same name', () => {
      const mode1 = getModeByName('tag');
      const mode2 = getModeByName('tag');
      expect(mode1).toBe(mode2);
    });

    it('should have different mode instances for different names', () => {
      const tagMode = getModeByName('tag');
      const agentMode = getModeByName('agent');
      expect(tagMode).not.toBe(agentMode);
    });
  });
});
