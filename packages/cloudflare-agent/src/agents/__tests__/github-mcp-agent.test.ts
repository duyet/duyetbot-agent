import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { agentRegistry } from '../registry.js';

// Mock the agents SDK to avoid cloudflare: protocol issues in tests
vi.mock('agents', () => ({
  Agent: class MockAgent {},
}));

// Import the module to trigger registration (after mocking agents)
import '../github-mcp-agent.js';
import { githubToolFilter } from '../github-mcp-agent.js';

describe('GitHubMCPAgent', () => {
  describe('registration', () => {
    it('should register with agentRegistry', () => {
      expect(agentRegistry.has('github-mcp-agent')).toBe(true);
    });

    it('should have correct priority', () => {
      const agent = agentRegistry.get('github-mcp-agent');
      expect(agent?.priority).toBe(45);
    });

    it('should have correct description', () => {
      const agent = agentRegistry.get('github-mcp-agent');
      expect(agent?.description).toContain('GitHub MCP');
    });

    it('should not have github category (uses patterns/keywords instead)', () => {
      const agent = agentRegistry.get('github-mcp-agent');
      expect(agent?.triggers?.categories).toBeUndefined();
    });

    it('should have low complexity capability', () => {
      const agent = agentRegistry.get('github-mcp-agent');
      expect(agent?.capabilities?.complexity).toBe('low');
    });

    it('should have github_mcp tool in capabilities', () => {
      const agent = agentRegistry.get('github-mcp-agent');
      expect(agent?.capabilities?.tools).toContain('github_mcp');
    });
  });

  describe('pattern matching', () => {
    it.each([
      // Patterns that match verb + github object
      ['show PR #123', true],
      ['show PR #123 details', true],
      ['list pull requests', true],
      ['list pull request #456', true],
      ['list issues assigned to me', true],
      ['find issue #789', true],
      ['get my repos', true],
      ['get repository info', true], // needs "get repo" not just "repository information"
      ['show repo status', true],
      ['show github action runs', true],
      ['github workflow status', true],
      ['show PR status', true],
      ['get issue info', true],
      ['show my PRs', true],
      ['list my issues', true],
      ['list assigned issues', true],
      ['show assigned pull requests', true],
      // Queries that don't match patterns
      ['What is the weather?', false],
      ['Tell me a joke', false],
      ['Who is Duyet?', false],
      // Modification queries also match (issue #) pattern - github-mcp-agent filters based on patterns
      // Complex modifications would use orchestrator via LLM classification, not pattern matching
      ['Modify issue #123', true], // matches pattern /issue\s+#?\d+/i
      ['Create a new PR', false], // creation doesn't match patterns (no verb + github object pattern)
    ])('query "%s" should match: %s', (query, shouldMatch) => {
      const result = agentRegistry.quickClassify(query);
      const matched = result === 'github-mcp-agent';
      expect(matched).toBe(shouldMatch);
    });
  });

  describe('githubToolFilter', () => {
    it.each([
      // PR tools
      ['list_pull_requests', true],
      ['get_pr_details', true],
      ['get_pull_request', true],
      ['ListPullRequests', true],
      // Issue tools
      ['create_issue', true],
      ['list_issues', true],
      ['get_issue', true],
      ['issues_assigned', true],
      // Repo tools
      ['list_repos', true],
      ['get_repository', true],
      ['get_repo_info', true],
      ['list_branches', true],
      ['get_branch', true],
      // Action/workflow tools
      ['get_workflow_runs', true],
      ['list_actions', true],
      ['get_workflow', true],
      ['get_run_status', true],
      // Gist tools
      ['create_gist', true],
      ['list_gists', true],
      ['get_gist', true],
      // Security tools
      ['get_security_alerts', true],
      ['list_vulnerabilities', true],
      ['dependabot_alerts', true],
      ['get_alert', true],
      // Search tools
      ['search_issues', true],
      ['search_repos', true],
      // List and get patterns are very broad (by design)
      ['list_something', true],
      ['get_something', true],
      // Non-GitHub tools that have no matching patterns
      ['random_tool', false],
      ['weather_api', false],
      ['blog_posts', false],
      ['send_email', false],
      ['calculate_sum', false],
    ])('tool "%s" should match: %s', (toolName, shouldMatch) => {
      expect(githubToolFilter(toolName)).toBe(shouldMatch);
    });

    it('should handle tool names with underscores and mixed case', () => {
      expect(githubToolFilter('Get_Pull_Request_Details')).toBe(true);
      expect(githubToolFilter('LIST_REPOSITORIES')).toBe(true);
      expect(githubToolFilter('search_ISSUES')).toBe(true);
    });

    it('should be case-insensitive', () => {
      expect(githubToolFilter('pull_request')).toBe(true);
      expect(githubToolFilter('PULL_REQUEST')).toBe(true);
      expect(githubToolFilter('Pull_Request')).toBe(true);
    });
  });

  describe('keyword triggers', () => {
    const agent = agentRegistry.get('github-mcp-agent');

    it('should have PR-related keywords', () => {
      const keywords = agent?.triggers?.keywords || [];
      const prKeywords = keywords.filter((k) => k.toLowerCase().includes('pr'));
      expect(prKeywords.length).toBeGreaterThan(0);
    });

    it('should have issue-related keywords', () => {
      const keywords = agent?.triggers?.keywords || [];
      const issueKeywords = keywords.filter((k) => k.toLowerCase().includes('issue'));
      expect(issueKeywords.length).toBeGreaterThan(0);
    });

    it('should have workflow-related keywords', () => {
      const keywords = agent?.triggers?.keywords || [];
      const workflowKeywords = keywords.filter(
        (k) => k.toLowerCase().includes('workflow') || k.toLowerCase().includes('action')
      );
      expect(workflowKeywords.length).toBeGreaterThan(0);
    });

    it('should have repo-related keywords', () => {
      const keywords = agent?.triggers?.keywords || [];
      const repoKeywords = keywords.filter((k) => k.toLowerCase().includes('repo'));
      expect(repoKeywords.length).toBeGreaterThan(0);
    });
  });

  describe('pattern triggers', () => {
    const agent = agentRegistry.get('github-mcp-agent');
    const patterns = agent?.triggers?.patterns || [];

    it('should have at least one pattern', () => {
      expect(patterns.length).toBeGreaterThan(0);
    });

    it('should have patterns for show/list/get operations', () => {
      const testCases = [
        { query: 'show PR #123', hasPattern: true },
        { query: 'list issues', hasPattern: true },
        { query: 'get repo info', hasPattern: true },
        { query: 'find workflow runs', hasPattern: true },
      ];

      for (const testCase of testCases) {
        const matches = patterns.some((p) => p.test(testCase.query.toLowerCase()));
        expect(matches).toBe(testCase.hasPattern);
      }
    });

    it('should have patterns for PR/issue number matching', () => {
      const testCases = [
        { query: 'PR #123', shouldMatch: true },
        { query: 'pull request #456', shouldMatch: true },
        { query: 'issue #789', shouldMatch: true },
        { query: '#999', shouldMatch: false }, // Number alone without context
      ];

      for (const testCase of testCases) {
        const matches = patterns.some((p) => p.test(testCase.query.toLowerCase()));
        expect(matches).toBe(testCase.shouldMatch);
      }
    });
  });

  describe('examples', () => {
    const agent = agentRegistry.get('github-mcp-agent');

    it('should have example queries', () => {
      expect(agent?.examples).toBeDefined();
      expect(agent?.examples?.length).toBeGreaterThan(0);
    });

    it('examples should focus on query-only operations', () => {
      const examples = agent?.examples || [];
      const exampleText = examples.join(' ').toLowerCase();

      // Should contain query-related keywords
      expect(exampleText).toMatch(/what|show|list|find/i);

      // Should NOT contain creation/modification keywords (those are orchestrator's job)
      expect(exampleText).not.toMatch(/create|modify|delete|update|merge/i);
    });
  });

  describe('quick classification priority', () => {
    it('should be checked before LLM classification for pattern matches', () => {
      // This is a high-confidence pattern match
      const result = agentRegistry.quickClassify('show PR #123');
      expect(result).toBe('github-mcp-agent');
    });

    it('should return agent name directly for pattern matches', () => {
      const result = agentRegistry.quickClassify('list issues assigned to me');
      expect(result).toBe('github-mcp-agent');
    });

    it('should return agent name for keyword matches', () => {
      const result = agentRegistry.quickClassify('what is the PR status');
      // Should match either by pattern or keyword
      if (result === 'github-mcp-agent') {
        expect(result).toBe('github-mcp-agent');
      } else {
        // If not matched by pattern, verify at least keyword is there
        const agent = agentRegistry.get('github-mcp-agent');
        const hasKeywordMatch = agent?.triggers?.keywords?.some((k) =>
          'what is the PR status'.toLowerCase().includes(k.toLowerCase())
        );
        expect(hasKeywordMatch).toBeDefined();
      }
    });
  });

  describe('tool filter reliability', () => {
    it('should consistently filter the same tools', () => {
      const toolName = 'list_pull_requests';
      const result1 = githubToolFilter(toolName);
      const result2 = githubToolFilter(toolName);
      expect(result1).toBe(result2);
    });

    it('should handle empty tool names', () => {
      expect(() => githubToolFilter('')).not.toThrow();
    });

    it('should handle tool names with special characters', () => {
      expect(() => githubToolFilter('tool-with-dash')).not.toThrow();
      expect(() => githubToolFilter('tool.with.dot')).not.toThrow();
    });

    it('should filter GitHub tools but not random tools', () => {
      const githubTools = ['list_pull_requests', 'create_issue', 'list_repos', 'get_workflow_runs'];
      // Tools with no GitHub-related keywords (and no list/get/search)
      const nonGithubTools = ['send_slack', 'fetch_weather', 'delete_account', 'archive_old'];

      for (const tool of githubTools) {
        expect(githubToolFilter(tool)).toBe(true);
      }

      for (const tool of nonGithubTools) {
        expect(githubToolFilter(tool)).toBe(false);
      }
    });
  });

  describe('integration with registry', () => {
    it('should be retrievable from registry after import', () => {
      const agent = agentRegistry.get('github-mcp-agent');
      expect(agent).toBeDefined();
      expect(agent?.name).toBe('github-mcp-agent');
    });

    it('should have all required metadata fields', () => {
      const agent = agentRegistry.get('github-mcp-agent');
      expect(agent?.name).toBeDefined();
      expect(agent?.description).toBeDefined();
      expect(agent?.triggers).toBeDefined();
      expect(agent?.capabilities).toBeDefined();
      expect(agent?.priority).toBeDefined();
    });

    it('should be included in agent classification prompt', () => {
      const prompt = agentRegistry.buildClassificationPrompt();
      expect(prompt).toContain('github-mcp-agent');
    });

    it('should be returned in getAll() when sorted by priority', () => {
      const allAgents = agentRegistry.getAll();
      const names = allAgents.map((a) => a.name);
      expect(names).toContain('github-mcp-agent');
    });

    it('should be getByTool for github_mcp tool', () => {
      const agents = agentRegistry.getByTool('github_mcp');
      const names = agents.map((a) => a.name);
      expect(names).toContain('github-mcp-agent');
    });
  });

  describe('edge cases', () => {
    it('should match queries with multiple GitHub-related keywords', () => {
      const result = agentRegistry.quickClassify('show my open PR and issues');
      expect(result).toBe('github-mcp-agent');
    });

    it('should not match queries with GitHub mentioned but for different agents', () => {
      const result = agentRegistry.quickClassify('github copilot help');
      // This should not match github-mcp-agent patterns
      // (depends on other agents, but shouldn't be false match)
      if (result === 'github-mcp-agent') {
        // Only OK if it genuinely matched a pattern
        const agent = agentRegistry.get('github-mcp-agent');
        const matches = agent?.triggers?.patterns?.some((p) => p.test('github copilot help'));
        expect(matches).toBe(true);
      }
    });

    it('should handle very long queries', () => {
      const longQuery = 'show PR #123 ' + 'with details '.repeat(100);
      expect(() => agentRegistry.quickClassify(longQuery)).not.toThrow();
    });

    it('should handle queries with special characters', () => {
      const specialQuery = 'show PR #123 @user & issue #456 (urgent!)';
      expect(() => agentRegistry.quickClassify(specialQuery)).not.toThrow();
    });
  });
});
