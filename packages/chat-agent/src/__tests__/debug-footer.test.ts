import { describe, expect, it } from 'vitest';
import { escapeHtml, formatDebugFooter } from '../debug-footer.js';
import type { DebugContext } from '../types.js';

describe('escapeHtml', () => {
  it('escapes ampersand', () => {
    expect(escapeHtml('a & b')).toBe('a &amp; b');
  });

  it('escapes less than', () => {
    expect(escapeHtml('<script>')).toBe('&lt;script&gt;');
  });

  it('escapes greater than', () => {
    expect(escapeHtml('value > 5')).toBe('value &gt; 5');
  });

  it('escapes double quotes', () => {
    expect(escapeHtml('say "hello"')).toBe('say &quot;hello&quot;');
  });

  it('escapes single quotes', () => {
    expect(escapeHtml("it's here")).toBe('it&#39;s here');
  });

  it('escapes all special characters together', () => {
    expect(escapeHtml('<script>alert("xss")</script>')).toBe(
      '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;'
    );
  });

  it('returns empty string as is', () => {
    expect(escapeHtml('')).toBe('');
  });

  it('handles text with no special characters', () => {
    expect(escapeHtml('hello world')).toBe('hello world');
  });
});

describe('formatDebugFooter', () => {
  it('returns null when debugContext is undefined', () => {
    expect(formatDebugFooter(undefined)).toBeNull();
  });

  it('returns null when routingFlow is empty', () => {
    const ctx: DebugContext = { routingFlow: [] };
    expect(formatDebugFooter(ctx)).toBeNull();
  });

  it('formats basic routing flow', () => {
    const ctx: DebugContext = {
      routingFlow: [{ agent: 'router' }, { agent: 'simple-agent' }],
    };
    const footer = formatDebugFooter(ctx);

    expect(footer).toContain('🔍');
    expect(footer).toContain('router → simple-agent');
    expect(footer).toContain('<blockquote expandable>');
  });

  it('formats routing flow with per-step duration', () => {
    const ctx: DebugContext = {
      routingFlow: [
        { agent: 'router', durationMs: 120 },
        { agent: 'simple-agent', durationMs: 450 },
      ],
    };
    const footer = formatDebugFooter(ctx);

    expect(footer).toContain('router (0.12s)');
    expect(footer).toContain('simple-agent (0.45s)');
  });

  it('formats routing flow with tool chain', () => {
    const ctx: DebugContext = {
      routingFlow: [
        { agent: 'router', durationMs: 100 },
        {
          agent: 'duyet-info-agent',
          toolChain: ['duyet_cv', 'get_posts'],
          durationMs: 2500,
        },
      ],
    };
    const footer = formatDebugFooter(ctx);

    expect(footer).toContain('duyet-info-agent (duyet_cv → get_posts → response, 2.50s)');
  });

  it('formats routing flow with error state', () => {
    const ctx: DebugContext = {
      routingFlow: [
        { agent: 'router', durationMs: 100 },
        { agent: 'duyet-info-agent', error: 'timeout', durationMs: 27920 },
        { agent: 'simple-agent', durationMs: 500 },
      ],
    };
    const footer = formatDebugFooter(ctx);

    expect(footer).toContain('duyet-info-agent (error, 27.92s)');
  });

  it('formats classification inline at end', () => {
    const ctx: DebugContext = {
      routingFlow: [{ agent: 'test-agent', durationMs: 100 }],
      classification: {
        type: 'simple',
        category: 'duyet',
        complexity: 'low',
      },
    };
    const footer = formatDebugFooter(ctx);

    expect(footer).toContain('[simple/duyet/low]');
    // Classification should be inline, not on new line
    expect(footer).toMatch(/test-agent \(0\.10s\) \[simple\/duyet\/low\]/);
  });

  it('displays last tool error with HTML escaping', () => {
    const ctx: DebugContext = {
      routingFlow: [{ agent: 'duyet-info-agent' }],
      metadata: {
        lastToolError: 'get_latest_posts: Connection <timeout> after 12000ms',
      },
    };
    const footer = formatDebugFooter(ctx);

    expect(footer).toContain('⚠️');
    expect(footer).toContain('get_latest_posts');
    expect(footer).toContain('&lt;timeout&gt;'); // HTML escaped
    expect(footer).not.toContain('<timeout>'); // Not raw HTML
  });

  it('omits metadata line when no error message', () => {
    const ctx: DebugContext = {
      routingFlow: [{ agent: 'test-agent' }],
      metadata: {
        fallback: true,
        cacheHits: 5,
        toolTimeouts: 1,
        toolErrors: 2,
      },
    };
    const footer = formatDebugFooter(ctx);

    // Footer should still exist with routing flow
    expect(footer).toContain('test-agent');
    // But should not have cache/timeout/err since no lastToolError
    expect(footer).not.toContain('cache:');
    expect(footer).not.toContain('timeout:');
    expect(footer).not.toContain('err:');
    expect(footer).not.toContain('[fallback]');
  });

  it('only shows error message from metadata', () => {
    const ctx: DebugContext = {
      routingFlow: [{ agent: 'test-agent' }],
      metadata: {
        lastToolError: 'search: timeout',
      },
    };
    const footer = formatDebugFooter(ctx);

    expect(footer).toContain('⚠️ search: timeout');
  });

  it('escapes HTML in error messages with special XML characters', () => {
    const ctx: DebugContext = {
      routingFlow: [{ agent: 'test-agent' }],
      metadata: {
        lastToolError: 'search: <query>timeout & retry</query>',
      },
    };
    const footer = formatDebugFooter(ctx);

    expect(footer).toContain('&lt;query&gt;');
    expect(footer).toContain('&amp;');
    expect(footer).not.toContain('<query>');
  });

  it('returns properly formatted blockquote', () => {
    const ctx: DebugContext = {
      routingFlow: [{ agent: 'test-agent' }],
    };
    const footer = formatDebugFooter(ctx);

    expect(footer).toMatch(/^[\s\S]*<blockquote expandable>/);
    expect(footer).toMatch(/<\/blockquote>[\s\S]*$/);
  });

  it('handles complex real world scenario - success', () => {
    const ctx: DebugContext = {
      routingFlow: [
        { agent: 'router', durationMs: 120 },
        {
          agent: 'duyet-info-agent',
          toolChain: ['duyet_cv', 'get_posts'],
          durationMs: 2350,
        },
      ],
      classification: {
        type: 'simple',
        category: 'duyet',
        complexity: 'low',
      },
    };
    const footer = formatDebugFooter(ctx);

    expect(footer).toContain('🔍 router (0.12s)');
    expect(footer).toContain('duyet-info-agent (duyet_cv → get_posts → response, 2.35s)');
    expect(footer).toContain('[simple/duyet/low]');
    expect(footer).not.toContain('⚠️'); // No error
  });

  it('handles complex real world scenario - error with fallback', () => {
    const ctx: DebugContext = {
      routingFlow: [
        { agent: 'router', durationMs: 120 },
        {
          agent: 'duyet-info-agent',
          error: 'MCP connection timeout',
          durationMs: 27920,
        },
        { agent: 'simple-agent', durationMs: 500 },
      ],
      classification: {
        type: 'simple',
        category: 'duyet',
        complexity: 'low',
      },
      metadata: {
        fallback: true,
        lastToolError: 'duyet-info-agent: MCP connection timeout',
      },
    };
    const footer = formatDebugFooter(ctx);

    expect(footer).toContain('🔍 router (0.12s)');
    expect(footer).toContain('duyet-info-agent (error, 27.92s)');
    expect(footer).toContain('simple-agent (0.50s)');
    expect(footer).toContain('[simple/duyet/low]');
    expect(footer).toContain('⚠️ duyet-info-agent: MCP connection timeout');
  });

  it('handles agent with only duration (no tools)', () => {
    const ctx: DebugContext = {
      routingFlow: [
        { agent: 'router', durationMs: 80 },
        { agent: 'simple-agent', durationMs: 450 },
      ],
      classification: {
        type: 'simple',
        category: 'general',
        complexity: 'low',
      },
    };
    const footer = formatDebugFooter(ctx);

    expect(footer).toContain('🔍 router (0.08s) → simple-agent (0.45s) [simple/general/low]');
  });

  it('handles agent with no duration', () => {
    const ctx: DebugContext = {
      routingFlow: [{ agent: 'router' }, { agent: 'simple-agent' }],
    };
    const footer = formatDebugFooter(ctx);

    expect(footer).toContain('router → simple-agent');
    expect(footer).not.toContain('('); // No parentheses when no duration/tools
  });

  it('handles error state without duration', () => {
    const ctx: DebugContext = {
      routingFlow: [{ agent: 'router' }, { agent: 'failing-agent', error: 'crash' }],
    };
    const footer = formatDebugFooter(ctx);

    expect(footer).toContain('failing-agent (error)');
  });
});
