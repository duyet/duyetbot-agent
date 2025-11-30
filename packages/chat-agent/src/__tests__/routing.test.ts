/**
 * Routing Tests
 *
 * Tests for query classification and routing logic.
 *
 * IMPORTANT: Registration data must be imported BEFORE routing functions
 * to populate the agent registry. We use the lightweight registrations.ts
 * file instead of actual agent modules to avoid Cloudflare runtime dependencies.
 */

import { describe, expect, it } from 'vitest';
// Import registrations to populate agent registry (no Cloudflare dependencies)
import '../agents/registrations.js';
// Now import routing functions
import { determineRouteTarget, type QueryClassification, quickClassify } from '../routing/index.js';

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
    it('quick classifies PR review (matches research keyword)', () => {
      // "review" is now matched by lead-researcher-agent patterns
      const result = quickClassify('Can you review this PR for security issues?');
      expect(result).not.toBeNull();
      expect(result?.category).toBe('research');
    });

    it('returns null for code-related queries without patterns', () => {
      // Write function doesn't match any quick patterns
      const result = quickClassify('Write a function to parse JSON');
      expect(result).toBeNull();
    });

    it('quick classifies research queries (matches best practices pattern)', () => {
      // "best practices" is now matched by lead-researcher-agent patterns
      const result = quickClassify('What are the best practices for React hooks?');
      expect(result).not.toBeNull();
      expect(result?.category).toBe('research');
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

  it('routes code queries to orchestrator-agent (which dispatches to CodeWorker)', () => {
    const classification: QueryClassification = {
      type: 'complex',
      category: 'code',
      complexity: 'medium',
      requiresHumanApproval: false,
      reasoning: 'Code analysis task',
    };
    // Workers are dispatched by OrchestratorAgent, not directly by Router
    expect(determineRouteTarget(classification)).toBe('orchestrator-agent');
  });

  it('routes medium complexity research queries to lead-researcher-agent', () => {
    const classification: QueryClassification = {
      type: 'complex',
      category: 'research',
      complexity: 'medium',
      requiresHumanApproval: false,
      reasoning: 'Research task',
    };
    // Medium/high complexity research now goes to lead-researcher-agent (multi-agent research system)
    expect(determineRouteTarget(classification)).toBe('lead-researcher-agent');
  });

  it('routes low complexity research queries to orchestrator-agent (which dispatches to ResearchWorker)', () => {
    const classification: QueryClassification = {
      type: 'complex', // Must be complex to reach category routing (simple+low goes to simple-agent)
      category: 'research',
      complexity: 'low',
      requiresHumanApproval: false,
      reasoning: 'Simple research task',
    };
    // Workers are dispatched by OrchestratorAgent, not directly by Router
    expect(determineRouteTarget(classification)).toBe('orchestrator-agent');
  });

  it('routes github queries to orchestrator-agent (which dispatches to GitHubWorker)', () => {
    const classification: QueryClassification = {
      type: 'complex',
      category: 'github',
      complexity: 'medium',
      requiresHumanApproval: false,
      reasoning: 'GitHub operation',
    };
    // Workers are dispatched by OrchestratorAgent, not directly by Router
    expect(determineRouteTarget(classification)).toBe('orchestrator-agent');
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
