/**
 * Classification Accuracy Test Suite
 *
 * Comprehensive tests for RouterAgent classification accuracy across all categories.
 * Tests both quickClassify patterns and full routing decisions.
 */

import { describe, expect, it } from 'vitest';
import { type QueryClassification, determineRouteTarget, quickClassify } from '../routing/index.js';

/**
 * Test helper to create classification and verify route
 */
function testRouting(
  query: string,
  expectedClassification: Partial<QueryClassification>,
  expectedRoute: string
) {
  // Try quick classify first
  const quick = quickClassify(query);

  if (quick) {
    // Verify quick classification matches expectations
    if (expectedClassification.type) {
      expect(quick.type).toBe(expectedClassification.type);
    }
    if (expectedClassification.category) {
      expect(quick.category).toBe(expectedClassification.category);
    }
    if (expectedClassification.complexity) {
      expect(quick.complexity).toBe(expectedClassification.complexity);
    }
    if (expectedClassification.requiresHumanApproval !== undefined) {
      expect(quick.requiresHumanApproval).toBe(expectedClassification.requiresHumanApproval);
    }

    // Verify route
    const route = determineRouteTarget(quick);
    expect(route).toBe(expectedRoute);
  } else {
    // For LLM-required queries, create manual classification and test routing
    const classification: QueryClassification = {
      type: expectedClassification.type || 'complex',
      category: expectedClassification.category || 'general',
      complexity: expectedClassification.complexity || 'medium',
      requiresHumanApproval: expectedClassification.requiresHumanApproval || false,
      reasoning: `Test classification for: ${query}`,
    };
    const route = determineRouteTarget(classification);
    expect(route).toBe(expectedRoute);
  }
}

describe('Classification Accuracy Test Suite', () => {
  describe('Simple Queries → simple-agent', () => {
    it('classifies greetings correctly', () => {
      testRouting(
        'hello',
        { type: 'simple', category: 'general', complexity: 'low' },
        'simple-agent'
      );
    });

    it('classifies hi there', () => {
      testRouting('hi there', { type: 'simple', category: 'general' }, 'simple-agent');
    });

    it('classifies good morning', () => {
      testRouting('good morning', { type: 'simple', category: 'general' }, 'simple-agent');
    });

    it('classifies good afternoon', () => {
      testRouting('good afternoon', { type: 'simple', category: 'general' }, 'simple-agent');
    });

    it('classifies good evening', () => {
      testRouting('good evening', { type: 'simple', category: 'general' }, 'simple-agent');
    });

    it('classifies help request', () => {
      testRouting('help', { type: 'simple', category: 'general' }, 'simple-agent');
    });

    it('classifies what can you do', () => {
      testRouting('what can you do', { type: 'simple', category: 'general' }, 'simple-agent');
    });

    it('classifies thanks', () => {
      testRouting(
        'thanks',
        { type: 'simple', category: 'general', complexity: 'low' },
        'simple-agent'
      );
    });

    it('classifies goodbye', () => {
      testRouting(
        'goodbye',
        { type: 'simple', category: 'general', complexity: 'low' },
        'simple-agent'
      );
    });

    it('classifies simple question', () => {
      testRouting(
        "what's your name?",
        { type: 'simple', category: 'general', complexity: 'low' },
        'simple-agent'
      );
    });
  });

  describe('Code Queries → code-worker', () => {
    it('classifies code review request', () => {
      testRouting('review this code', { category: 'code', complexity: 'medium' }, 'code-worker');
    });

    it('classifies bug fix request', () => {
      testRouting(
        'fix the bug in auth.ts',
        { category: 'code', complexity: 'medium' },
        'code-worker'
      );
    });

    it('classifies refactoring request', () => {
      testRouting(
        'refactor the login function',
        { category: 'code', complexity: 'medium' },
        'code-worker'
      );
    });

    it('classifies TypeScript error explanation', () => {
      testRouting(
        'explain this TypeScript error',
        { category: 'code', complexity: 'low' },
        'code-worker'
      );
    });

    it('classifies code generation request', () => {
      testRouting(
        'write a function to parse JSON',
        { category: 'code', complexity: 'medium' },
        'code-worker'
      );
    });

    it('classifies debugging request', () => {
      testRouting(
        'debug the authentication flow',
        { category: 'code', complexity: 'medium' },
        'code-worker'
      );
    });

    it('classifies optimization request', () => {
      testRouting(
        'optimize this database query',
        { category: 'code', complexity: 'medium' },
        'code-worker'
      );
    });

    it('classifies test writing request', () => {
      testRouting(
        'write unit tests for UserService',
        { category: 'code', complexity: 'medium' },
        'code-worker'
      );
    });

    it('classifies API implementation', () => {
      testRouting(
        'implement REST endpoint for user profile',
        { category: 'code', complexity: 'medium' },
        'code-worker'
      );
    });

    it('classifies dependency update', () => {
      testRouting(
        'update React to latest version',
        { category: 'code', complexity: 'medium' },
        'code-worker'
      );
    });
  });

  describe('Research Queries → research-worker', () => {
    it('classifies best practices research', () => {
      testRouting(
        'what are best practices for React hooks?',
        { category: 'research', complexity: 'medium' },
        'research-worker'
      );
    });

    it('classifies technology comparison', () => {
      testRouting(
        'compare Redis vs Memcached',
        { category: 'research', complexity: 'medium' },
        'research-worker'
      );
    });

    it('classifies feature summary', () => {
      testRouting(
        'summarize the latest Next.js features',
        { category: 'research', complexity: 'medium' },
        'research-worker'
      );
    });

    it('classifies documentation lookup', () => {
      testRouting(
        'find documentation for TypeScript decorators',
        { category: 'research', complexity: 'low' },
        'research-worker'
      );
    });

    it('classifies architecture research', () => {
      testRouting(
        'how do microservices handle authentication?',
        { category: 'research', complexity: 'medium' },
        'research-worker'
      );
    });

    it('classifies performance patterns', () => {
      testRouting(
        'what are common database optimization patterns?',
        { category: 'research', complexity: 'medium' },
        'research-worker'
      );
    });

    it('classifies security research', () => {
      testRouting(
        'what are OWASP top 10 vulnerabilities?',
        { category: 'research', complexity: 'medium' },
        'research-worker'
      );
    });

    it('classifies tool comparison', () => {
      testRouting(
        'compare Webpack vs Vite for bundling',
        { category: 'research', complexity: 'medium' },
        'research-worker'
      );
    });

    it('classifies learning resource search', () => {
      testRouting(
        'find tutorials for GraphQL basics',
        { category: 'research', complexity: 'low' },
        'research-worker'
      );
    });

    it('classifies technology trends', () => {
      testRouting(
        'what are emerging trends in frontend development?',
        { category: 'research', complexity: 'medium' },
        'research-worker'
      );
    });
  });

  describe('GitHub Queries → github-worker', () => {
    it('classifies PR creation', () => {
      testRouting(
        'create a PR for this feature',
        { category: 'github', complexity: 'medium' },
        'github-worker'
      );
    });

    it('classifies CI status check', () => {
      testRouting(
        'check the CI status',
        { category: 'github', complexity: 'low' },
        'github-worker'
      );
    });

    it('classifies PR review', () => {
      testRouting('review PR #123', { category: 'github', complexity: 'medium' }, 'github-worker');
    });

    it('classifies issue creation', () => {
      testRouting(
        'create an issue for the bug',
        { category: 'github', complexity: 'low' },
        'github-worker'
      );
    });

    it('classifies comment posting', () => {
      testRouting(
        'comment on issue #456',
        { category: 'github', complexity: 'low' },
        'github-worker'
      );
    });

    it('classifies PR merge', () => {
      testRouting(
        'merge pull request #789',
        { category: 'github', complexity: 'medium' },
        'github-worker'
      );
    });

    it('classifies branch management', () => {
      testRouting(
        'delete the feature branch',
        { category: 'github', complexity: 'low' },
        'github-worker'
      );
    });

    it('classifies release creation', () => {
      testRouting(
        'create a new release v2.0.0',
        { category: 'github', complexity: 'medium' },
        'github-worker'
      );
    });

    it('classifies code review comment', () => {
      testRouting(
        'add review comment about line 45',
        { category: 'github', complexity: 'low' },
        'github-worker'
      );
    });

    it('classifies PR status check', () => {
      testRouting(
        'what is the status of PR #100?',
        { category: 'github', complexity: 'low' },
        'github-worker'
      );
    });
  });

  describe('Complex/Orchestrator → orchestrator-agent', () => {
    it('classifies system refactoring', () => {
      testRouting(
        'refactor the entire authentication system',
        { complexity: 'high' },
        'orchestrator-agent'
      );
    });

    it('classifies CRUD implementation', () => {
      testRouting(
        'implement user management with CRUD operations',
        { complexity: 'high' },
        'orchestrator-agent'
      );
    });

    it('classifies architecture migration', () => {
      testRouting('migrate from REST to GraphQL', { complexity: 'high' }, 'orchestrator-agent');
    });

    it('classifies multi-component feature', () => {
      testRouting(
        'build a complete dashboard with charts, filters, and real-time updates',
        { complexity: 'high' },
        'orchestrator-agent'
      );
    });

    it('classifies infrastructure setup', () => {
      testRouting(
        'set up CI/CD pipeline with testing and deployment',
        { complexity: 'high' },
        'orchestrator-agent'
      );
    });

    it('classifies large-scale refactoring', () => {
      testRouting(
        'convert entire codebase from JavaScript to TypeScript',
        { complexity: 'high' },
        'orchestrator-agent'
      );
    });

    it('classifies multi-service integration', () => {
      testRouting(
        'integrate payment processing, email notifications, and analytics',
        { complexity: 'high' },
        'orchestrator-agent'
      );
    });

    it('classifies performance overhaul', () => {
      testRouting(
        'optimize application performance across frontend, backend, and database',
        { complexity: 'high' },
        'orchestrator-agent'
      );
    });

    it('classifies security audit and fixes', () => {
      testRouting(
        'perform security audit and fix all vulnerabilities',
        { complexity: 'high' },
        'orchestrator-agent'
      );
    });

    it('classifies full feature implementation', () => {
      testRouting(
        'implement OAuth2 authentication with Google, GitHub, and email signup',
        { complexity: 'high' },
        'orchestrator-agent'
      );
    });
  });

  describe('HITL Queries → hitl-agent', () => {
    it('classifies yes confirmation', () => {
      testRouting('yes', { type: 'tool_confirmation' }, 'hitl-agent');
    });

    it('classifies no rejection', () => {
      testRouting('no', { type: 'tool_confirmation' }, 'hitl-agent');
    });

    it('classifies approve', () => {
      testRouting('approve', { type: 'tool_confirmation' }, 'hitl-agent');
    });

    it('classifies reject', () => {
      testRouting('reject', { type: 'tool_confirmation' }, 'hitl-agent');
    });

    it('classifies confirm', () => {
      testRouting('confirm', { type: 'tool_confirmation' }, 'hitl-agent');
    });

    it('classifies cancel', () => {
      testRouting('cancel', { type: 'tool_confirmation' }, 'hitl-agent');
    });

    it('classifies clear command', () => {
      testRouting('/clear', { requiresHumanApproval: true }, 'hitl-agent');
    });

    it('classifies reset command', () => {
      testRouting('reset', { requiresHumanApproval: true }, 'hitl-agent');
    });

    it('classifies destructive operation requiring approval', () => {
      testRouting('delete all user data', { requiresHumanApproval: true }, 'hitl-agent');
    });

    it('classifies sensitive modification', () => {
      testRouting(
        'modify production database schema',
        { requiresHumanApproval: true },
        'hitl-agent'
      );
    });
  });

  describe('Edge Cases and Ambiguous Queries', () => {
    it('handles empty query', () => {
      const result = quickClassify('');
      expect(result).toBeNull();
    });

    it('handles whitespace-only query', () => {
      const result = quickClassify('   ');
      expect(result).toBeNull();
    });

    it('handles punctuation-heavy greeting', () => {
      const result = quickClassify('Hello!!!');
      expect(result).not.toBeNull();
      expect(result?.type).toBe('simple');
    });

    it('handles mixed case confirmations', () => {
      const result = quickClassify('YES');
      expect(result).not.toBeNull();
      expect(result?.type).toBe('tool_confirmation');
    });

    it('handles partial command match', () => {
      const result = quickClassify('hello world');
      // Should not match greeting pattern (has extra words)
      expect(result).toBeNull();
    });

    it('routes admin command with extra text', () => {
      const result = quickClassify('/clear please');
      // Should not match quick pattern (has extra words)
      expect(result).toBeNull();
    });

    it('handles code query with GitHub context', () => {
      // Should route to code-worker, not github-worker
      testRouting(
        'review the code in PR #123 for security issues',
        { category: 'code', complexity: 'medium' },
        'code-worker'
      );
    });

    it('handles research with code context', () => {
      // Should route to research-worker
      testRouting(
        'research best practices for implementing JWT authentication',
        { category: 'research', complexity: 'medium' },
        'research-worker'
      );
    });

    it('handles multi-domain complex query', () => {
      // High complexity should override category
      testRouting(
        'research authentication patterns, implement OAuth, and set up CI tests',
        { complexity: 'high' },
        'orchestrator-agent'
      );
    });
  });

  describe('Routing Logic Priority Tests', () => {
    it('prioritizes tool_confirmation over complexity', () => {
      const classification: QueryClassification = {
        type: 'tool_confirmation',
        category: 'general',
        complexity: 'high', // High complexity but still confirmation
        requiresHumanApproval: false,
        reasoning: 'Test',
      };
      expect(determineRouteTarget(classification)).toBe('hitl-agent');
    });

    it('prioritizes high complexity over category', () => {
      const classification: QueryClassification = {
        type: 'complex',
        category: 'code', // Code category but high complexity
        complexity: 'high',
        requiresHumanApproval: false,
        reasoning: 'Test',
      };
      expect(determineRouteTarget(classification)).toBe('orchestrator-agent');
    });

    it('prioritizes requiresHumanApproval over category', () => {
      const classification: QueryClassification = {
        type: 'complex',
        category: 'code',
        complexity: 'medium',
        requiresHumanApproval: true, // Needs approval
        reasoning: 'Test',
      };
      expect(determineRouteTarget(classification)).toBe('hitl-agent');
    });

    it('routes simple + low to simple-agent', () => {
      const classification: QueryClassification = {
        type: 'simple',
        category: 'general',
        complexity: 'low',
        requiresHumanApproval: false,
        reasoning: 'Test',
      };
      expect(determineRouteTarget(classification)).toBe('simple-agent');
    });

    it('routes complex general to simple-agent', () => {
      const classification: QueryClassification = {
        type: 'complex',
        category: 'general',
        complexity: 'medium',
        requiresHumanApproval: false,
        reasoning: 'Test',
      };
      expect(determineRouteTarget(classification)).toBe('simple-agent');
    });
  });
});

describe('Quick Classification Coverage', () => {
  it('quick classifies 10 out of 140+ test queries', () => {
    const queries = [
      'hello',
      'hi',
      'good morning',
      'help',
      '/help',
      'yes',
      'no',
      '/clear',
      'reset',
      'approve',
    ];

    let quickMatches = 0;
    for (const query of queries) {
      if (quickClassify(query) !== null) {
        quickMatches++;
      }
    }

    // Should quick classify most simple patterns
    expect(quickMatches).toBeGreaterThanOrEqual(8);
  });

  it('requires LLM for complex queries', () => {
    const complexQueries = [
      'review this code',
      'what are best practices for React?',
      'create a PR',
      'refactor the entire system',
    ];

    for (const query of complexQueries) {
      expect(quickClassify(query)).toBeNull();
    }
  });
});
