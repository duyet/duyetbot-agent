import type { DebugContext } from '@duyetbot/chat-agent';
import { describe, expect, it } from 'vitest';
import {
  formatDebugFooter,
  formatGitHubDebugFooter,
  prepareMessageWithDebug,
} from '../debug-footer.js';
import type { GitHubContext } from '../transport.js';

/**
 * Create a minimal GitHubContext for testing
 */
function createMockContext(overrides: Partial<GitHubContext> = {}): GitHubContext {
  return {
    chatId: 'test-chat-123',
    messageId: 456,
    userId: 'test-user',
    isAdmin: false,
    ...overrides,
  } as GitHubContext;
}

describe('formatGitHubDebugFooter', () => {
  it('returns null when debugContext is undefined', () => {
    expect(formatGitHubDebugFooter(undefined)).toBeNull();
  });

  it('returns null when routingFlow is empty', () => {
    const ctx: DebugContext = { routingFlow: [] };
    expect(formatGitHubDebugFooter(ctx)).toBeNull();
  });

  it('formats basic routing flow with details wrapper', () => {
    const ctx: DebugContext = {
      routingFlow: [{ agent: 'router' }, { agent: 'simple-agent' }],
    };
    const footer = formatGitHubDebugFooter(ctx);

    expect(footer).toContain('<details>');
    expect(footer).toContain('<summary>🔍 Debug Info</summary>');
    expect(footer).toContain('```');
    expect(footer).toContain('🔍 router-agent → simple-agent');
    expect(footer).toContain('</details>');
  });

  it('formats routing flow with per-step duration', () => {
    const ctx: DebugContext = {
      routingFlow: [
        { agent: 'router', durationMs: 120 },
        { agent: 'simple-agent', durationMs: 450 },
      ],
    };
    const footer = formatGitHubDebugFooter(ctx);

    expect(footer).toContain('router-agent (0.12s)');
    expect(footer).toContain('simple-agent (0.45s)');
  });

  it('formats routing flow with classification', () => {
    const ctx: DebugContext = {
      routingFlow: [
        { agent: 'router', durationMs: 100 },
        { agent: 'duyet-info-agent', durationMs: 2500 },
      ],
      classification: {
        type: 'simple',
        category: 'duyet',
        complexity: 'low',
      },
    };
    const footer = formatGitHubDebugFooter(ctx);

    expect(footer).toContain('router-agent (0.10s)');
    expect(footer).toContain('[simple/duyet/low]');
    expect(footer).toContain('duyet-info-agent (2.50s)');
  });

  it('formats nested workers for orchestrator', () => {
    const ctx: DebugContext = {
      routingFlow: [
        { agent: 'router-agent', durationMs: 400 },
        { agent: 'orchestrator-agent', durationMs: 5200 },
      ],
      classification: {
        type: 'complex',
        category: 'research',
        complexity: 'low',
      },
      workers: [
        { name: 'research-worker', durationMs: 2500, status: 'completed' },
        { name: 'code-worker', durationMs: 1200, status: 'completed' },
      ],
    };
    const footer = formatGitHubDebugFooter(ctx);

    expect(footer).toContain('orchestrator-agent (5.20s)');
    expect(footer).toContain('├─ research-worker (2.50s)');
    expect(footer).toContain('└─ code-worker (1.20s)');
  });

  it('displays error metadata', () => {
    const ctx: DebugContext = {
      routingFlow: [{ agent: 'test-agent' }],
      metadata: {
        lastToolError: 'get_posts: Connection timeout after 12000ms',
      },
    };
    const footer = formatGitHubDebugFooter(ctx);

    expect(footer).toContain('⚠️');
    expect(footer).toContain('get_posts');
    expect(footer).toContain('Connection timeout');
  });

  it('formats error state with duration', () => {
    const ctx: DebugContext = {
      routingFlow: [
        { agent: 'router', durationMs: 100 },
        { agent: 'failing-agent', status: 'error', durationMs: 27920 },
      ],
    };
    const footer = formatGitHubDebugFooter(ctx);

    expect(footer).toContain('failing-agent (error, 27.92s)');
  });
});

describe('formatDebugFooter', () => {
  it('returns null for non-admin users', () => {
    const ctx = createMockContext({
      isAdmin: false,
      debugContext: {
        routingFlow: [{ agent: 'router' }, { agent: 'simple-agent' }],
      },
    });

    expect(formatDebugFooter(ctx)).toBeNull();
  });

  it('returns formatted footer for admin users', () => {
    const ctx = createMockContext({
      isAdmin: true,
      debugContext: {
        routingFlow: [
          { agent: 'router', durationMs: 100 },
          { agent: 'simple-agent', durationMs: 450 },
        ],
        classification: {
          type: 'simple',
          category: 'general',
          complexity: 'low',
        },
      },
    });

    const footer = formatDebugFooter(ctx);

    expect(footer).not.toBeNull();
    expect(footer).toContain('<details>');
    expect(footer).toContain('router-agent (0.10s)');
    expect(footer).toContain('[simple/general/low]');
    expect(footer).toContain('simple-agent (0.45s)');
  });

  it('returns null when no debug context', () => {
    const ctx = createMockContext({
      isAdmin: true,
      debugContext: undefined,
    });

    expect(formatDebugFooter(ctx)).toBeNull();
  });
});

describe('prepareMessageWithDebug', () => {
  it('returns message without footer for non-admin users', () => {
    const ctx = createMockContext({
      isAdmin: false,
      debugContext: {
        routingFlow: [{ agent: 'router' }, { agent: 'simple-agent' }],
      },
    });

    const result = prepareMessageWithDebug('Hello, world!', ctx);

    expect(result).toBe('Hello, world!');
    expect(result).not.toContain('<details>');
  });

  it('appends debug footer for admin users', () => {
    const ctx = createMockContext({
      isAdmin: true,
      debugContext: {
        routingFlow: [
          { agent: 'router', durationMs: 100 },
          { agent: 'simple-agent', durationMs: 450 },
        ],
      },
    });

    const result = prepareMessageWithDebug('Hello, world!', ctx);

    expect(result).toContain('Hello, world!');
    expect(result).toContain('<details>');
    expect(result).toContain('router-agent');
    expect(result).toContain('simple-agent');
  });

  it('handles complex orchestrator debug context', () => {
    const ctx = createMockContext({
      isAdmin: true,
      debugContext: {
        routingFlow: [
          { agent: 'router-agent', durationMs: 400 },
          { agent: 'orchestrator-agent', durationMs: 5200 },
        ],
        classification: {
          type: 'complex',
          category: 'research',
          complexity: 'high',
        },
        workers: [
          { name: 'research-worker', durationMs: 2500, status: 'completed' },
          { name: 'code-worker', durationMs: 1200, status: 'completed' },
        ],
      },
    });

    const result = prepareMessageWithDebug('Analysis complete.', ctx);

    expect(result).toContain('Analysis complete.');
    expect(result).toContain('[complex/research/high]');
    expect(result).toContain('├─ research-worker (2.50s)');
    expect(result).toContain('└─ code-worker (1.20s)');
  });
});
