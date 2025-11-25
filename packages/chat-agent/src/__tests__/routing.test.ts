/**
 * Routing Tests
 *
 * Tests for query classification and routing logic.
 */

import { describe, expect, it } from 'vitest';
import { type QueryClassification, determineRouteTarget, quickClassify } from '../routing/index.js';

describe('quickClassify', () => {
  describe('greetings', () => {
    it('classifies simple greetings', () => {
      const result = quickClassify('hi');
      expect(result).not.toBeNull();
      expect(result?.type).toBe('simple');
      expect(result?.category).toBe('general');
      expect(result?.complexity).toBe('low');
    });

    it('classifies hello with punctuation', () => {
      const result = quickClassify('Hello!');
      expect(result).not.toBeNull();
      expect(result?.type).toBe('simple');
    });

    it('classifies good morning', () => {
      const result = quickClassify('Good morning');
      expect(result).not.toBeNull();
      expect(result?.type).toBe('simple');
      expect(result?.category).toBe('general');
    });
  });

  describe('help commands', () => {
    it('classifies help request', () => {
      const result = quickClassify('help');
      expect(result).not.toBeNull();
      expect(result?.type).toBe('simple');
      expect(result?.category).toBe('general');
    });

    it('classifies /help command', () => {
      const result = quickClassify('/help');
      expect(result).not.toBeNull();
      expect(result?.type).toBe('simple');
    });
  });

  describe('admin commands', () => {
    it('classifies clear command as needing approval', () => {
      const result = quickClassify('/clear');
      expect(result).not.toBeNull();
      expect(result?.type).toBe('simple');
      expect(result?.category).toBe('admin');
      expect(result?.requiresHumanApproval).toBe(true);
    });

    it('classifies reset command as needing approval', () => {
      const result = quickClassify('reset');
      expect(result).not.toBeNull();
      expect(result?.requiresHumanApproval).toBe(true);
    });
  });

  describe('tool confirmations', () => {
    it('classifies yes as tool confirmation', () => {
      const result = quickClassify('yes');
      expect(result).not.toBeNull();
      expect(result?.type).toBe('tool_confirmation');
    });

    it('classifies no as tool confirmation', () => {
      const result = quickClassify('no');
      expect(result).not.toBeNull();
      expect(result?.type).toBe('tool_confirmation');
    });

    it('classifies approve as tool confirmation', () => {
      const result = quickClassify('approve');
      expect(result).not.toBeNull();
      expect(result?.type).toBe('tool_confirmation');
    });

    it('classifies reject as tool confirmation', () => {
      const result = quickClassify('reject');
      expect(result).not.toBeNull();
      expect(result?.type).toBe('tool_confirmation');
    });
  });

  describe('complex queries', () => {
    it('returns null for complex queries requiring LLM', () => {
      const result = quickClassify('Can you review this PR for security issues?');
      expect(result).toBeNull();
    });

    it('returns null for code-related queries', () => {
      const result = quickClassify('Write a function to parse JSON');
      expect(result).toBeNull();
    });

    it('returns null for research queries', () => {
      const result = quickClassify('What are the best practices for React hooks?');
      expect(result).toBeNull();
    });
  });
});

describe('determineRouteTarget', () => {
  it('routes tool_confirmation to hitl-agent', () => {
    const classification: QueryClassification = {
      type: 'tool_confirmation',
      category: 'general',
      complexity: 'low',
      requiresHumanApproval: false,
      reasoning: 'Tool confirmation response',
    };
    expect(determineRouteTarget(classification)).toBe('hitl-agent');
  });

  it('routes high complexity to orchestrator-agent', () => {
    const classification: QueryClassification = {
      type: 'complex',
      category: 'code',
      complexity: 'high',
      requiresHumanApproval: false,
      reasoning: 'Complex multi-step task',
    };
    expect(determineRouteTarget(classification)).toBe('orchestrator-agent');
  });

  it('routes queries requiring approval to hitl-agent', () => {
    const classification: QueryClassification = {
      type: 'simple',
      category: 'admin',
      complexity: 'low',
      requiresHumanApproval: true,
      reasoning: 'Destructive operation',
    };
    expect(determineRouteTarget(classification)).toBe('hitl-agent');
  });

  it('routes simple general queries to simple-agent', () => {
    const classification: QueryClassification = {
      type: 'simple',
      category: 'general',
      complexity: 'low',
      requiresHumanApproval: false,
      reasoning: 'Simple greeting',
    };
    expect(determineRouteTarget(classification)).toBe('simple-agent');
  });

  it('routes code queries to code-worker', () => {
    const classification: QueryClassification = {
      type: 'complex',
      category: 'code',
      complexity: 'medium',
      requiresHumanApproval: false,
      reasoning: 'Code analysis task',
    };
    expect(determineRouteTarget(classification)).toBe('code-worker');
  });

  it('routes research queries to research-worker', () => {
    const classification: QueryClassification = {
      type: 'complex',
      category: 'research',
      complexity: 'medium',
      requiresHumanApproval: false,
      reasoning: 'Research task',
    };
    expect(determineRouteTarget(classification)).toBe('research-worker');
  });

  it('routes github queries to github-worker', () => {
    const classification: QueryClassification = {
      type: 'complex',
      category: 'github',
      complexity: 'medium',
      requiresHumanApproval: false,
      reasoning: 'GitHub operation',
    };
    expect(determineRouteTarget(classification)).toBe('github-worker');
  });

  it('routes general medium complexity to simple-agent', () => {
    const classification: QueryClassification = {
      type: 'complex',
      category: 'general',
      complexity: 'medium',
      requiresHumanApproval: false,
      reasoning: 'General question',
    };
    expect(determineRouteTarget(classification)).toBe('simple-agent');
  });
});
