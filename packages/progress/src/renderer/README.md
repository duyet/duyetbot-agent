# Footer Renderer

The `FooterRenderer` class provides a flexible way to render debug execution footers with different output formats.

## Features

- Multiple output formats: HTML, MarkdownV2, GitHub Markdown, Plain text
- Automatic escaping for each format
- Configurable summary display (tokens, model, duration)
- Tool execution chain visualization
- Result truncation for compact display

## Usage

```typescript
import { FooterRenderer, type StepCollection } from '@duyetbot/progress';

// Create a renderer with default config (HTML format)
const renderer = new FooterRenderer();

// Or configure it
const customRenderer = new FooterRenderer({
  format: 'markdown',
  showTokens: true,
  showModel: true,
  showDuration: true,
  maxResultPreview: 60,
});

// Prepare your step collection
const collection: StepCollection = {
  steps: [
    {
      type: 'thinking',
      thinking: 'Analyzing the request...',
      iteration: 1,
      timestamp: '2024-01-01T00:00:00Z',
      durationMs: 100,
    },
    {
      type: 'tool_complete',
      toolName: 'get_posts',
      args: { limit: 5 },
      result: 'Found 5 posts',
      iteration: 1,
      timestamp: '2024-01-01T00:00:01Z',
      durationMs: 200,
    },
  ],
  startedAt: '2024-01-01T00:00:00Z',
  durationMs: 7600,
  tokenUsage: {
    input: 4000,
    output: 1400,
    total: 5400,
  },
  model: 'anthropic/claude-3-5-sonnet-20241022',
  traceId: 'trace-123',
};

// Render the complete footer with wrapper
const footer = renderer.render(collection);
// Returns:
// <blockquote expandable>
// ⏺ Analyzing the request...
// ⏺ get_posts(limit: 5)
//   ⎿ Found 5 posts
//
// ⏱️ 7.60s | 📊 5.4k tokens | 🤖 sonnet-3.5
// </blockquote>

// Render just the execution chain
const chain = renderer.renderChain(collection.steps);
// Returns:
// ⏺ Analyzing the request...
// ⏺ get_posts(limit: 5)
//   ⎿ Found 5 posts

// Render just the summary line
const summary = renderer.renderSummary(collection);
// Returns: ⏱️ 7.60s | 📊 5.4k tokens | 🤖 sonnet-3.5
```

## Output Formats

### HTML (Telegram)

```html
<blockquote expandable>
⏺ Thinking about the request...
⏺ get_posts(limit: 5)
  ⎿ Found 5 posts

⏱️ 7.6s | 📊 5.4k tokens | 🤖 sonnet-3.5
</blockquote>
```

### MarkdownV2 (Telegram)

```
**>⏺ get\_posts\(limit: 5\)
  ⎿ Found 5 posts
⏱️ 7\.6s \| 📊 5\.4k tokens||
```

### GitHub Markdown

```markdown
<details>
<summary>Debug Info</summary>

\`\`\`
⏺ get_posts(limit: 5)
  ⎿ Found 5 posts

⏱️ 7.6s | 📊 5.4k tokens | 🤖 sonnet-3.5
\`\`\`

</details>
```

### Plain Text

```
⏺ get_posts(limit: 5)
  ⎿ Found 5 posts

⏱️ 7.6s | 📊 5.4k tokens | 🤖 sonnet-3.5
```

## Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `format` | `'html' \| 'markdownV2' \| 'markdown' \| 'plain'` | `'html'` | Output format for rendering |
| `showTokens` | `boolean` | `true` | Whether to include token usage in summary |
| `showModel` | `boolean` | `true` | Whether to include model name in summary |
| `showDuration` | `boolean` | `true` | Whether to include duration in summary |
| `maxResultPreview` | `number` | `60` | Maximum length for tool result preview |

## Escape Functions

The package also exports standalone escape functions:

```typescript
import { escapeHtml, escapeMarkdownV2, escapePlain } from '@duyetbot/progress';

// Escape HTML entities
const safe = escapeHtml('<script>alert("xss")</script>');
// Returns: &lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;

// Escape MarkdownV2 special characters
const escaped = escapeMarkdownV2('Cost: $1.50');
// Returns: Cost: $1\.50

// No-op for plain text
const plain = escapePlain('Hello <world>');
// Returns: Hello <world>
```

## Step Types

The renderer supports all step types defined in the `@duyetbot/progress` package:

- `thinking` - Agent thinking/reasoning phase
- `tool_start` - Tool execution start
- `tool_complete` - Successful tool execution
- `tool_error` - Tool execution error
- `routing` - Routing to a specific agent
- `llm_iteration` - LLM iteration cycle
- `preparing` - Preparation phase
