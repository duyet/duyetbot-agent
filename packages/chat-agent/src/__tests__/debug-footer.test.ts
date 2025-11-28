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

  it('includes tools in routing flow', () => {
    const ctx: DebugContext = {
      routingFlow: [
        { agent: 'router', tools: ['search', 'calculator'] },
        { agent: 'code-agent', tools: ['bash'] },
      ],
    };
    const footer = formatDebugFooter(ctx);

    expect(footer).toContain('router (search, calculator)');
    expect(footer).toContain('code-agent (bash)');
  });

  it('formats duration correctly', () => {
    const ctx: DebugContext = {
      routingFlow: [{ agent: 'test-agent' }],
      totalDurationMs: 2500,
    };
    const footer = formatDebugFooter(ctx);

    expect(footer).toContain('2.50s');
  });

  it('formats classification', () => {
    const ctx: DebugContext = {
      routingFlow: [{ agent: 'test-agent' }],
      classification: {
        type: 'simple',
        category: 'duyet',
        complexity: 'low',
      },
    };
    const footer = formatDebugFooter(ctx);

    expect(footer).toContain('simple/duyet/low');
  });

  it('displays fallback indicator', () => {
    const ctx: DebugContext = {
      routingFlow: [{ agent: 'test-agent' }],
      metadata: { fallback: true },
    };
    const footer = formatDebugFooter(ctx);

    expect(footer).toContain('[fallback]');
  });

  it('displays cache stats', () => {
    const ctx: DebugContext = {
      routingFlow: [{ agent: 'test-agent' }],
      metadata: { cacheHits: 3, cacheMisses: 2 },
    };
    const footer = formatDebugFooter(ctx);

    expect(footer).toContain('cache:3/2');
  });

  it('displays timeout info with tools', () => {
    const ctx: DebugContext = {
      routingFlow: [{ agent: 'test-agent' }],
      metadata: {
        toolTimeouts: 1,
        timedOutTools: ['get_latest_posts', 'search_articles'],
      },
    };
    const footer = formatDebugFooter(ctx);

    expect(footer).toContain('timeout:1 (get_latest_posts, search_articles)');
  });

  it('displays error count', () => {
    const ctx: DebugContext = {
      routingFlow: [{ agent: 'test-agent' }],
      metadata: { toolErrors: 2 },
    };
    const footer = formatDebugFooter(ctx);

    expect(footer).toContain('err:2');
  });

  it('displays last tool error with HTML escaping', () => {
    const ctx: DebugContext = {
      routingFlow: [{ agent: 'duyet-info-agent' }],
      metadata: {
        toolErrors: 1,
        lastToolError: 'get_latest_posts: Connection <timeout> after 12000ms',
      },
    };
    const footer = formatDebugFooter(ctx);

    expect(footer).toContain('⚠️');
    expect(footer).toContain('get_latest_posts');
    expect(footer).toContain('&lt;timeout&gt;'); // HTML escaped
    expect(footer).not.toContain('<timeout>'); // Not raw HTML
  });

  it('displays combined metadata on multiple lines', () => {
    const ctx: DebugContext = {
      routingFlow: [{ agent: 'duyet-info-agent', tools: ['get_latest_posts'] }],
      totalDurationMs: 2340,
      classification: { type: 'simple', category: 'duyet', complexity: 'low' },
      metadata: {
        fallback: true,
        cacheHits: 1,
        cacheMisses: 0,
        toolTimeouts: 1,
        timedOutTools: ['get_latest_posts'],
        toolErrors: 1,
        lastToolError: 'get_latest_posts: timeout',
      },
    };
    const footer = formatDebugFooter(ctx);

    expect(footer).toContain('[fallback]');
    expect(footer).toContain('cache:1/0');
    expect(footer).toContain('timeout:1');
    expect(footer).toContain('err:1');
    expect(footer).toContain('⚠️ get_latest_posts: timeout');

    // Verify line structure
    const lines = footer?.split('\n') ?? [];
    expect(lines.length).toBeGreaterThanOrEqual(3); // Should have multiple lines
  });

  it('handles metadata with only cache hits', () => {
    const ctx: DebugContext = {
      routingFlow: [{ agent: 'cache-agent' }],
      metadata: { cacheHits: 5 },
    };
    const footer = formatDebugFooter(ctx);

    expect(footer).toContain('cache:5/0');
  });

  it('handles metadata with only cache misses', () => {
    const ctx: DebugContext = {
      routingFlow: [{ agent: 'cache-agent' }],
      metadata: { cacheMisses: 3 },
    };
    const footer = formatDebugFooter(ctx);

    expect(footer).toContain('cache:0/3');
  });

  it('omits metadata line when no metadata values set', () => {
    const ctx: DebugContext = {
      routingFlow: [{ agent: 'test-agent' }],
      metadata: {},
    };
    const footer = formatDebugFooter(ctx);

    // Footer should still exist with routing flow
    expect(footer).toContain('test-agent');
    // But should not have extra metadata lines
    expect(footer).not.toContain('cache:');
    expect(footer).not.toContain('timeout:');
    expect(footer).not.toContain('err:');
  });

  it('escapes HTML in error messages with special XML characters', () => {
    const ctx: DebugContext = {
      routingFlow: [{ agent: 'test-agent' }],
      metadata: {
        toolErrors: 1,
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

  it('handles complex real world scenario', () => {
    const ctx: DebugContext = {
      routingFlow: [
        { agent: 'router', durationMs: 150 },
        {
          agent: 'duyet-info-agent',
          tools: ['get_latest_posts'],
          durationMs: 2200,
        },
      ],
      totalDurationMs: 2350,
      classification: {
        type: 'simple',
        category: 'duyet',
        complexity: 'low',
      },
      metadata: {
        fallback: true,
        cacheHits: 0,
        cacheMisses: 1,
        toolTimeouts: 1,
        timedOutTools: ['get_latest_posts'],
        toolErrors: 1,
        lastToolError: 'get_latest_posts: MCP connection timeout',
      },
    };
    const footer = formatDebugFooter(ctx);

    expect(footer).toContain('🔍 router → duyet-info-agent (get_latest_posts)');
    expect(footer).toContain('2.35s');
    expect(footer).toContain('simple/duyet/low');
    expect(footer).toContain('[fallback]');
    expect(footer).toContain('cache:0/1');
    expect(footer).toContain('timeout:1 (get_latest_posts)');
    expect(footer).toContain('err:1');
    expect(footer).toContain('⚠️ get_latest_posts: MCP connection timeout');
  });
});
