import { describe, expect, it } from 'vitest';
import {
  escapeHtml,
  escapeMarkdownV2,
  formatDebugFooter,
  formatDebugFooterMarkdown,
  smartEscapeMarkdownV2,
} from '../debug-footer.js';
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

  it('returns null when routingFlow is empty and no metadata', () => {
    const ctx: DebugContext = { routingFlow: [] };
    expect(formatDebugFooter(ctx)).toBeNull();
  });

  it('returns minimal footer when routingFlow is empty but has metadata', () => {
    const ctx: DebugContext = {
      routingFlow: [],
      totalDurationMs: 2340,
      metadata: {
        model: 'claude-3-5-sonnet-20241022',
        traceId: 'abc123456789',
      },
    };
    const footer = formatDebugFooter(ctx);
    expect(footer).toContain('⏱️ 2.34s');
    expect(footer).toContain('📊 sonnet-3.5');
    expect(footer).toContain('🆔 abc12345');
    expect(footer).toContain('<blockquote expandable>');
  });

  it('shortens model names correctly', () => {
    const ctx: DebugContext = {
      routingFlow: [],
      totalDurationMs: 1000, // Need at least one piece of info for minimal footer
      metadata: {
        model: 'claude-3-5-haiku-20241022',
      },
    };
    const footer = formatDebugFooter(ctx);
    expect(footer).not.toBeNull();
    expect(footer).toContain('haiku-3.5');
  });

  it('formats basic routing flow', () => {
    const ctx: DebugContext = {
      routingFlow: [{ agent: 'router' }, { agent: 'simple-agent' }],
    };
    const footer = formatDebugFooter(ctx);

    expect(footer).toContain('🔍');
    // New format: router-agent → target-agent
    expect(footer).toContain('router-agent → simple-agent');
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

    // New format: router-agent (time) → target-agent (time)
    expect(footer).toContain('router-agent (0.12s)');
    expect(footer).toContain('simple-agent (0.45s)');
  });

  it('formats routing flow with classification and timing', () => {
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
    const footer = formatDebugFooter(ctx);

    // New format: classification is inline between router and target
    // router-agent (time) → [classification] → target-agent (time)
    expect(footer).toContain('router-agent (0.10s)');
    expect(footer).toContain('[simple/duyet/low]');
    expect(footer).toContain('duyet-info-agent (2.50s)');
    // Verify the order: router → classification → agent
    expect(footer).toMatch(/router-agent \(0\.10s\) → \[simple\/duyet\/low\] → duyet-info-agent/);
  });

  it('formats routing flow with error state', () => {
    const ctx: DebugContext = {
      routingFlow: [
        { agent: 'router', durationMs: 100 },
        { agent: 'duyet-info-agent', status: 'error', durationMs: 27920 },
      ],
    };
    const footer = formatDebugFooter(ctx);

    expect(footer).toContain('duyet-info-agent (27.92s, error)');
  });

  it('formats classification inline between router and target', () => {
    const ctx: DebugContext = {
      routingFlow: [
        { agent: 'router-agent', durationMs: 80 },
        { agent: 'test-agent', durationMs: 100 },
      ],
      classification: {
        type: 'simple',
        category: 'duyet',
        complexity: 'low',
      },
    };
    const footer = formatDebugFooter(ctx);

    expect(footer).toContain('[simple/duyet/low]');
    // Classification should be between router and target agent
    expect(footer).toMatch(
      /router-agent \(0\.08s\) → \[simple\/duyet\/low\] → test-agent \(0\.10s\)/
    );
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
        { agent: 'duyet-info-agent', durationMs: 2350 },
      ],
      classification: {
        type: 'simple',
        category: 'duyet',
        complexity: 'low',
      },
    };
    const footer = formatDebugFooter(ctx);

    // New format: router-agent (time) → [classification] → target (time)
    expect(footer).toContain('🔍 router-agent (0.12s)');
    expect(footer).toContain('[simple/duyet/low]');
    expect(footer).toContain('duyet-info-agent (2.35s)');
    expect(footer).not.toContain('⚠️'); // No error
  });

  it('handles complex real world scenario - error with fallback', () => {
    const ctx: DebugContext = {
      routingFlow: [
        { agent: 'router', durationMs: 120 },
        {
          agent: 'duyet-info-agent',
          status: 'error',
          durationMs: 27920,
        },
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

    // New format: router-agent (time) → [classification] → target (time, error)
    expect(footer).toContain('🔍 router-agent (0.12s)');
    expect(footer).toContain('[simple/duyet/low]');
    expect(footer).toContain('duyet-info-agent (27.92s, error)');
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

    // New format: classification is inline between router and target
    expect(footer).toContain(
      '🔍 router-agent (0.08s) → [simple/general/low] → simple-agent (0.45s)'
    );
  });

  it('handles agent with no duration', () => {
    const ctx: DebugContext = {
      routingFlow: [{ agent: 'router' }, { agent: 'simple-agent' }],
    };
    const footer = formatDebugFooter(ctx);

    // New format: router-agent is always expanded
    expect(footer).toContain('router-agent → simple-agent');
    expect(footer).not.toContain('('); // No parentheses when no duration/tools
  });

  it('handles error state without duration', () => {
    const ctx: DebugContext = {
      routingFlow: [{ agent: 'router' }, { agent: 'failing-agent', status: 'error' }],
    };
    const footer = formatDebugFooter(ctx);

    expect(footer).toContain('failing-agent (error)');
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
    const footer = formatDebugFooter(ctx);

    // New format with nested workers
    expect(footer).toContain('router-agent (0.40s)');
    expect(footer).toContain('[complex/research/low]');
    expect(footer).toContain('orchestrator-agent (5.20s)');
    expect(footer).toContain('├─ research-worker (2.50s)');
    expect(footer).toContain('└─ code-worker (1.20s)');
  });

  it('formats workers with running status', () => {
    const ctx: DebugContext = {
      routingFlow: [
        { agent: 'router-agent', durationMs: 400, status: 'completed' },
        { agent: 'orchestrator-agent', status: 'running' },
      ],
      classification: {
        type: 'complex',
        category: 'research',
        complexity: 'low',
      },
      workers: [{ name: 'research-worker', status: 'running' }],
    };
    const footer = formatDebugFooter(ctx);

    expect(footer).toContain('orchestrator-agent (running)');
    // Single worker uses └─ (last/only item)
    expect(footer).toContain('└─ research-worker (running)');
  });
});

describe('escapeMarkdownV2', () => {
  it('escapes all special characters', () => {
    expect(escapeMarkdownV2('_*[]()~`>#+-=|{}.!')).toBe(
      '\\_\\*\\[\\]\\(\\)\\~\\`\\>\\#\\+\\-\\=\\|\\{\\}\\.\\!'
    );
  });

  it('escapes backslash', () => {
    expect(escapeMarkdownV2('path\\to\\file')).toBe('path\\\\to\\\\file');
  });

  it('preserves plain text', () => {
    expect(escapeMarkdownV2('hello world')).toBe('hello world');
  });
});

describe('smartEscapeMarkdownV2', () => {
  it('preserves bold formatting', () => {
    expect(smartEscapeMarkdownV2('*bold text*')).toBe('*bold text*');
  });

  it('preserves italic formatting', () => {
    expect(smartEscapeMarkdownV2('_italic text_')).toBe('_italic text_');
  });

  it('preserves plain links', () => {
    expect(smartEscapeMarkdownV2('[link](https://example.com)')).toBe(
      '[link](https://example.com)'
    );
  });

  it('preserves bold-wrapped links *[text](url)*', () => {
    const input =
      '*[ClickHouse Rust UDFs](https://blog.duyet.net/2024/11/clickhouse-rust-udf.html)*';
    const result = smartEscapeMarkdownV2(input);
    // Should preserve the outer * markers and the link structure
    expect(result).toBe(
      '*[ClickHouse Rust UDFs](https://blog.duyet.net/2024/11/clickhouse-rust-udf.html)*'
    );
  });

  it('preserves italic-wrapped links _[text](url)_', () => {
    const input = '_[Italic Link](https://example.com)_';
    const result = smartEscapeMarkdownV2(input);
    expect(result).toBe('_[Italic Link](https://example.com)_');
  });

  it('escapes special chars in plain text around formatted links', () => {
    const input = '*[Title](url)* - Nov. 2024';
    const result = smartEscapeMarkdownV2(input);
    // Bold link should be preserved, but - and . should be escaped
    expect(result).toContain('*[Title](url)*');
    expect(result).toContain('\\-');
    expect(result).toContain('\\.');
  });

  it('handles multiple bold links in text', () => {
    const input = '• *[Post 1](url1)* and *[Post 2](url2)*';
    const result = smartEscapeMarkdownV2(input);
    expect(result).toContain('*[Post 1](url1)*');
    expect(result).toContain('*[Post 2](url2)*');
  });

  it('preserves inline code', () => {
    expect(smartEscapeMarkdownV2('use `npm install` to install')).toBe(
      'use `npm install` to install'
    );
  });

  it('preserves code blocks', () => {
    const input = '```python\nprint("hello")\n```';
    const result = smartEscapeMarkdownV2(input);
    expect(result).toContain('```python');
    expect(result).toContain('print');
  });

  it('escapes parentheses in URLs', () => {
    const input = '[wiki](https://en.wikipedia.org/wiki/Title_(disambiguation))';
    const result = smartEscapeMarkdownV2(input);
    expect(result).toContain('\\)');
  });

  it('handles blog post list format', () => {
    const input = `• *[ClickHouse Rust UDFs](https://blog.duyet.net/2024/11/clickhouse-rust-udf.html)* Nov 2024
  Custom UDFs in Rust for data transformations`;
    const result = smartEscapeMarkdownV2(input);
    // Bold link should be preserved
    expect(result).toContain('*[ClickHouse Rust UDFs]');
    expect(result).toContain(')*');
  });
});

describe('formatDebugFooterMarkdown', () => {
  it('returns null when debugContext is undefined', () => {
    expect(formatDebugFooterMarkdown(undefined)).toBeNull();
  });

  it('returns null when routingFlow is empty', () => {
    const ctx: DebugContext = { routingFlow: [] };
    expect(formatDebugFooterMarkdown(ctx)).toBeNull();
  });

  it('formats basic routing flow with details wrapper', () => {
    const ctx: DebugContext = {
      routingFlow: [{ agent: 'router' }, { agent: 'simple-agent' }],
    };
    const footer = formatDebugFooterMarkdown(ctx);

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
    const footer = formatDebugFooterMarkdown(ctx);

    expect(footer).toContain('router-agent (0.12s)');
    expect(footer).toContain('simple-agent (0.45s)');
  });

  it('formats routing flow with classification and timing', () => {
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
    const footer = formatDebugFooterMarkdown(ctx);

    expect(footer).toContain('router-agent (0.10s)');
    expect(footer).toContain('[simple/duyet/low]');
    expect(footer).toContain('duyet-info-agent (2.50s)');
    expect(footer).toMatch(/router-agent \(0\.10s\) → \[simple\/duyet\/low\] → duyet-info-agent/);
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
    const footer = formatDebugFooterMarkdown(ctx);

    expect(footer).toContain('router-agent (0.40s)');
    expect(footer).toContain('[complex/research/low]');
    expect(footer).toContain('orchestrator-agent (5.20s)');
    expect(footer).toContain('├─ research-worker (2.50s)');
    expect(footer).toContain('└─ code-worker (1.20s)');
  });

  it('formats workers with running status', () => {
    const ctx: DebugContext = {
      routingFlow: [
        { agent: 'router-agent', durationMs: 400, status: 'completed' },
        { agent: 'orchestrator-agent', status: 'running' },
      ],
      classification: {
        type: 'complex',
        category: 'research',
        complexity: 'low',
      },
      workers: [{ name: 'research-worker', status: 'running' }],
    };
    const footer = formatDebugFooterMarkdown(ctx);

    expect(footer).toContain('orchestrator-agent (running)');
    expect(footer).toContain('└─ research-worker (running)');
  });

  it('displays error metadata without HTML escaping', () => {
    const ctx: DebugContext = {
      routingFlow: [{ agent: 'test-agent' }],
      metadata: {
        lastToolError: 'get_posts: Connection <timeout> after 12000ms',
      },
    };
    const footer = formatDebugFooterMarkdown(ctx);

    expect(footer).toContain('⚠️');
    expect(footer).toContain('get_posts');
    // Markdown code blocks don't need HTML escaping
    expect(footer).toContain('<timeout>');
    expect(footer).not.toContain('&lt;timeout&gt;');
  });

  it('formats error state with duration', () => {
    const ctx: DebugContext = {
      routingFlow: [
        { agent: 'router', durationMs: 100 },
        { agent: 'failing-agent', status: 'error', durationMs: 27920 },
      ],
    };
    const footer = formatDebugFooterMarkdown(ctx);

    expect(footer).toContain('failing-agent (27.92s, error)');
  });

  it('handles complex scenario with workers and error', () => {
    const ctx: DebugContext = {
      routingFlow: [
        { agent: 'router', durationMs: 120 },
        { agent: 'orchestrator-agent', status: 'error', durationMs: 27920 },
      ],
      classification: {
        type: 'complex',
        category: 'research',
        complexity: 'high',
      },
      workers: [
        { name: 'research-worker', durationMs: 2500, status: 'completed' },
        { name: 'code-worker', status: 'error', durationMs: 1200 },
      ],
      metadata: {
        fallback: true,
        lastToolError: 'code-worker: MCP connection timeout',
      },
    };
    const footer = formatDebugFooterMarkdown(ctx);

    expect(footer).toContain('<details>');
    expect(footer).toContain('```');
    expect(footer).toContain('router-agent (0.12s)');
    expect(footer).toContain('[complex/research/high]');
    expect(footer).toContain('orchestrator-agent (27.92s, error)');
    expect(footer).toContain('├─ research-worker (2.50s)');
    expect(footer).toContain('└─ code-worker (1.20s, error)');
    expect(footer).toContain('⚠️ code-worker: MCP connection timeout');
  });
});
