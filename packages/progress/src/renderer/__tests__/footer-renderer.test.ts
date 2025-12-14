import { describe, expect, it } from 'vitest';
import type { Step, StepCollection } from '../../types.js';
import { FooterRenderer } from '../footer-renderer.js';

describe('FooterRenderer', () => {
  const createCollection = (steps: Step[], options?: Partial<StepCollection>): StepCollection => ({
    steps,
    startedAt: '2024-01-01T00:00:00Z',
    durationMs: 7600,
    tokenUsage: {
      input: 4000,
      output: 1400,
      total: 5400,
    },
    model: 'anthropic/claude-3-5-sonnet-20241022',
    traceId: 'trace-123',
    ...options,
  });

  describe('render', () => {
    it('returns null for empty collection', () => {
      const renderer = new FooterRenderer();
      const collection = createCollection([]);

      expect(renderer.render(collection)).toBeNull();
    });

    it('returns null for collection with no steps', () => {
      const renderer = new FooterRenderer();
      const collection = createCollection([]);

      expect(renderer.render(collection)).toBeNull();
    });

    it('render returns non-null for collection with steps', () => {
      const renderer = new FooterRenderer();
      const collection = createCollection([
        {
          type: 'thinking',
          thinking: 'Let me think...',
          iteration: 1,
          timestamp: '2024-01-01T00:00:00Z',
          durationMs: 100,
        },
      ]);

      expect(renderer.render(collection)).not.toBeNull();
    });

    it('render with format=html uses blockquote wrapper', () => {
      const renderer = new FooterRenderer({ format: 'html' });
      const collection = createCollection([
        {
          type: 'thinking',
          thinking: 'Thinking',
          iteration: 1,
          timestamp: '2024-01-01T00:00:00Z',
          durationMs: 100,
        },
      ]);

      const result = renderer.render(collection);
      expect(result).toContain('<blockquote expandable>');
      expect(result).toContain('</blockquote>');
    });

    it('render with format=markdownV2 uses expandable quote', () => {
      const renderer = new FooterRenderer({ format: 'markdownV2' });
      const collection = createCollection([
        {
          type: 'thinking',
          thinking: 'Thinking',
          iteration: 1,
          timestamp: '2024-01-01T00:00:00Z',
          durationMs: 100,
        },
      ]);

      const result = renderer.render(collection);
      expect(result).toContain('**>');
      expect(result).toContain('||');
    });

    it('render with format=markdown uses details/summary', () => {
      const renderer = new FooterRenderer({ format: 'markdown' });
      const collection = createCollection([
        {
          type: 'thinking',
          thinking: 'Thinking',
          iteration: 1,
          timestamp: '2024-01-01T00:00:00Z',
          durationMs: 100,
        },
      ]);

      const result = renderer.render(collection);
      expect(result).toContain('<details>');
      expect(result).toContain('<summary>Debug Info</summary>');
      expect(result).toContain('```');
      expect(result).toContain('</details>');
    });

    it('render with format=plain has no wrapper', () => {
      const renderer = new FooterRenderer({ format: 'plain' });
      const collection = createCollection([
        {
          type: 'thinking',
          thinking: 'Thinking',
          iteration: 1,
          timestamp: '2024-01-01T00:00:00Z',
          durationMs: 100,
        },
      ]);

      const result = renderer.render(collection);
      expect(result).not.toContain('<');
      expect(result).not.toContain('**>');
    });

    it('HTML format escapes content', () => {
      const renderer = new FooterRenderer({ format: 'html' });
      const collection = createCollection([
        {
          type: 'thinking',
          thinking: '<script>alert("xss")</script>',
          iteration: 1,
          timestamp: '2024-01-01T00:00:00Z',
          durationMs: 100,
        },
      ]);

      const result = renderer.render(collection);
      expect(result).toContain('&lt;script&gt;');
      expect(result).toContain('&quot;xss&quot;');
      expect(result).not.toContain('<script>');
    });

    it('MarkdownV2 format escapes content', () => {
      const renderer = new FooterRenderer({ format: 'markdownV2' });
      const collection = createCollection([
        {
          type: 'thinking',
          thinking: 'Cost: $1.50',
          iteration: 1,
          timestamp: '2024-01-01T00:00:00Z',
          durationMs: 100,
        },
      ]);

      const result = renderer.render(collection);
      expect(result).toContain('\\.');
    });
  });

  describe('renderChain', () => {
    it('formats thinking step', () => {
      const renderer = new FooterRenderer({ format: 'plain' });
      const steps: Step[] = [
        {
          type: 'thinking',
          thinking: 'Let me analyze this request...',
          iteration: 1,
          timestamp: '2024-01-01T00:00:00Z',
          durationMs: 100,
        },
      ];

      const result = renderer.renderChain(steps);
      expect(result).toContain('⏺ Let me analyze this request...');
    });

    it('formats thinking step without text', () => {
      const renderer = new FooterRenderer({ format: 'plain' });
      const steps: Step[] = [
        {
          type: 'thinking',
          iteration: 1,
          timestamp: '2024-01-01T00:00:00Z',
          durationMs: 100,
        },
      ];

      const result = renderer.renderChain(steps);
      expect(result).toContain('⏺ Thinking about the request...');
    });

    it('formats tool complete step', () => {
      const renderer = new FooterRenderer({ format: 'plain' });
      const steps: Step[] = [
        {
          type: 'tool_complete',
          toolName: 'get_posts',
          args: { limit: 5 },
          result: 'Found 5 posts',
          iteration: 1,
          timestamp: '2024-01-01T00:00:00Z',
          durationMs: 200,
        },
      ];

      const result = renderer.renderChain(steps);
      expect(result).toContain('⏺ get_posts(limit: 5)');
      expect(result).toContain('⎿ Found 5 posts');
    });

    it('formats tool error step', () => {
      const renderer = new FooterRenderer({ format: 'plain' });
      const steps: Step[] = [
        {
          type: 'tool_error',
          toolName: 'api_call',
          args: { endpoint: '/test' },
          error: 'Network timeout after 30s',
          iteration: 1,
          timestamp: '2024-01-01T00:00:00Z',
          durationMs: 30000,
        },
      ];

      const result = renderer.renderChain(steps);
      expect(result).toContain('⏺ api_call(endpoint: "/test")');
      expect(result).toContain('⎿ ❌ Network timeout after 30s');
    });

    it('formats routing step', () => {
      const renderer = new FooterRenderer({ format: 'plain' });
      const steps: Step[] = [
        {
          type: 'routing',
          agentName: 'simple-agent',
          iteration: 1,
          timestamp: '2024-01-01T00:00:00Z',
          durationMs: 50,
        },
      ];

      const result = renderer.renderChain(steps);
      expect(result).toContain('⏺ Routing to simple-agent');
    });

    it('formats multiple steps', () => {
      const renderer = new FooterRenderer({ format: 'plain' });
      const steps: Step[] = [
        {
          type: 'thinking',
          thinking: 'Analyzing...',
          iteration: 1,
          timestamp: '2024-01-01T00:00:00Z',
          durationMs: 100,
        },
        {
          type: 'tool_complete',
          toolName: 'search',
          args: { query: 'test' },
          result: 'Found results',
          iteration: 1,
          timestamp: '2024-01-01T00:00:01Z',
          durationMs: 200,
        },
      ];

      const result = renderer.renderChain(steps);
      expect(result).toContain('⏺ Analyzing...');
      expect(result).toContain('⏺ search(query: "test")');
      expect(result).toContain('⎿ Found results');
    });

    it('tool results are truncated', () => {
      const renderer = new FooterRenderer({ format: 'plain', maxResultPreview: 20 });
      const steps: Step[] = [
        {
          type: 'tool_complete',
          toolName: 'get_data',
          args: {},
          result:
            'This is a very long result that should be truncated because it exceeds the limit',
          iteration: 1,
          timestamp: '2024-01-01T00:00:00Z',
          durationMs: 100,
        },
      ];

      const result = renderer.renderChain(steps);
      expect(result).toContain('...');
      expect(result.length).toBeLessThan(100);
    });
  });

  describe('renderSummary', () => {
    it('includes duration', () => {
      const renderer = new FooterRenderer({ format: 'plain', showDuration: true });
      const collection = createCollection([], { durationMs: 7600 });

      const result = renderer.renderSummary(collection);
      expect(result).toContain('⏱️');
      expect(result).toContain('7.60s');
    });

    it('includes token count', () => {
      const renderer = new FooterRenderer({ format: 'plain', showTokens: true });
      const collection = createCollection([]);

      const result = renderer.renderSummary(collection);
      expect(result).toContain('📊');
      expect(result).toContain('5.4k tokens');
    });

    it('includes model name', () => {
      const renderer = new FooterRenderer({ format: 'plain', showModel: true });
      const collection = createCollection([]);

      const result = renderer.renderSummary(collection);
      expect(result).toContain('🤖');
      expect(result).toContain('sonnet-3.5');
    });

    it('respects showTokens=false', () => {
      const renderer = new FooterRenderer({ format: 'plain', showTokens: false });
      const collection = createCollection([]);

      const result = renderer.renderSummary(collection);
      expect(result).not.toContain('📊');
      expect(result).not.toContain('tokens');
    });

    it('respects showModel=false', () => {
      const renderer = new FooterRenderer({ format: 'plain', showModel: false });
      const collection = createCollection([]);

      const result = renderer.renderSummary(collection);
      expect(result).not.toContain('🤖');
      expect(result).not.toContain('sonnet');
    });

    it('respects showDuration=false', () => {
      const renderer = new FooterRenderer({ format: 'plain', showDuration: false });
      const collection = createCollection([]);

      const result = renderer.renderSummary(collection);
      expect(result).not.toContain('⏱️');
      expect(result).not.toContain('7.60s');
    });
  });

  describe('parallel_tools step rendering', () => {
    it('renders parallel tools with tree structure', () => {
      const renderer = new FooterRenderer({ format: 'plain' });
      const collection = createCollection([
        {
          type: 'parallel_tools',
          iteration: 1,
          timestamp: '2024-01-01T00:00:00Z',
          durationMs: 5000,
          tools: [
            {
              id: 'tool-1',
              toolName: 'research',
              args: { query: 'Home Depot' },
              status: 'completed',
              result: 'Search Results (current events)',
              durationMs: 2300,
            },
            {
              id: 'tool-2',
              toolName: 'Explore',
              args: { architecture: true },
              status: 'completed',
              result: 'Found 15 relevant files...',
              durationMs: 5100,
            },
            {
              id: 'tool-3',
              toolName: 'research',
              args: { query: 'https://example.com' },
              status: 'running',
            },
          ],
        },
      ]);

      const result = renderer.renderChain(collection.steps);

      expect(result).toContain('Running 3 tools in parallel');
      expect(result).toContain('├─ research(query: "Home Depot")');
      expect(result).toContain('2.30s');
      expect(result).toContain('🔍 Search Results (current events)');
      expect(result).toContain('├─ Explore(architecture: true)');
      expect(result).toContain('5.10s');
      expect(result).toContain('└─ research(query: "https://example.com")');
    });

    it('renders parallel tools with errors', () => {
      const renderer = new FooterRenderer({ format: 'plain' });
      const collection = createCollection([
        {
          type: 'parallel_tools',
          iteration: 1,
          timestamp: '2024-01-01T00:00:00Z',
          durationMs: 1000,
          tools: [
            {
              id: 'tool-1',
              toolName: 'bash',
              args: { command: 'invalid-cmd' },
              status: 'error',
              error: 'Command not found: invalid-cmd',
            },
          ],
        },
      ]);

      const result = renderer.renderChain(collection.steps);

      expect(result).toContain('bash(command: "invalid-cmd")');
      expect(result).toContain('❌');
      expect(result).toContain('Command not found');
    });
  });

  describe('subagent step rendering', () => {
    it('renders completed subagent with stats', () => {
      const renderer = new FooterRenderer({ format: 'plain' });
      const collection = createCollection([
        {
          type: 'subagent',
          id: 'sub-1',
          iteration: 1,
          timestamp: '2024-01-01T00:00:00Z',
          durationMs: 118000,
          agentName: 'Plan',
          description: 'Design cloudflare-agent refactoring',
          status: 'completed',
          toolUses: 20,
          tokenCount: 119100,
        },
      ]);

      const result = renderer.renderChain(collection.steps);

      expect(result).toContain('Plan(Design cloudflare-agent refactoring)');
      expect(result).toContain('Done');
      expect(result).toContain('20 tool uses');
      expect(result).toContain('119.1k tokens');
      expect(result).toContain('1m 58s');
    });

    it('renders subagent with error', () => {
      const renderer = new FooterRenderer({ format: 'plain' });
      const collection = createCollection([
        {
          type: 'subagent',
          id: 'sub-2',
          iteration: 1,
          timestamp: '2024-01-01T00:00:00Z',
          durationMs: 5000,
          agentName: 'Research',
          description: 'Search for documentation',
          status: 'error',
          error: 'API rate limit exceeded',
        },
      ]);

      const result = renderer.renderChain(collection.steps);

      expect(result).toContain('Research(Search for documentation)');
      expect(result).toContain('❌');
      expect(result).toContain('API rate limit exceeded');
    });

    it('truncates long descriptions', () => {
      const renderer = new FooterRenderer({ format: 'plain' });
      const collection = createCollection([
        {
          type: 'subagent',
          id: 'sub-3',
          iteration: 1,
          timestamp: '2024-01-01T00:00:00Z',
          durationMs: 5000,
          agentName: 'Analyze',
          description:
            'This is a very long description that should be truncated to fit the display',
          status: 'completed',
        },
      ]);

      const result = renderer.renderChain(collection.steps);

      expect(result).toContain('Analyze(');
      expect(result).toContain('...');
      // Should be truncated to 40 chars
      expect(result).not.toContain(
        'This is a very long description that should be truncated to fit the display'
      );
    });
  });
});
