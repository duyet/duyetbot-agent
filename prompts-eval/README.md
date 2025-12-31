# Prompt Evaluation Suite

Comprehensive testing for duyetbot-agent prompts using [promptfoo](https://www.promptfoo.dev/).

## Key Design: Production Prompts

**This suite tests the ACTUAL production prompts**, not separate test prompts:

| Evaluation | Production Source |
|------------|-------------------|
| Router | `packages/prompts/src/agents/router.ts` → `getRouterPrompt()` |
| Telegram | `packages/prompts/src/platforms/telegram.ts` → `getTelegramPrompt()` |
| GitHub | `packages/prompts/src/platforms/github.ts` → `getGitHubBotPrompt()` |

JavaScript prompt helpers in `prompts/` import and use the real prompt functions, ensuring tests validate actual production behavior.

## Test Coverage

| Category | Tests | Description |
|----------|-------|-------------|
| **Router** | 15 | Classification accuracy for query routing |
| **Telegram** | 8 | Response conciseness and code formatting |
| **GitHub** | 6 | Markdown format and structure |
| **Quality** | 8 | Response quality and platform behavior |

**Total: 37 test cases**

## Quick Start

### Prerequisites

Set your OpenRouter API key:

```bash
export OPENROUTER_API_KEY=your_key_here
```

### Run Tests

```bash
# Run all tests
bun run prompt:eval

# Run specific suite
bun run prompt:eval:router     # Router classification
bun run prompt:eval:telegram   # Telegram format
bun run prompt:eval:github     # GitHub format
bun run prompt:eval:quality    # Response quality

# View results
bun run prompt:view            # Interactive web UI
bun run prompt:report          # Generate HTML dashboard
bun run prompt:share           # Upload to promptfoo cloud
```

## Structure

```
prompts-eval/
├── configs/           # promptfoo YAML configs
├── datasets/          # Test case definitions
├── prompts/           # JS prompt helpers that use REAL prompts
│   ├── router-prompt.cjs      # Uses getRouterPrompt()
│   ├── telegram-prompt.cjs    # Uses getTelegramPrompt()
│   └── github-prompt.cjs      # Uses getGitHubBotPrompt()
├── assertions/        # Custom validation logic
│   └── router-assertion.cjs   # Maps JSON response to agent name
├── scripts/           # Automation scripts
└── results/           # JSON + HTML outputs
```

## LLM Providers (SOTA Models)

The tests use promptfoo's built-in OpenRouter provider with state-of-the-art fast models:

| Model | ID | Use Case |
|-------|------|----------|
| Grok 4.1 Fast | `openrouter:x-ai/grok-4.1-fast` | Primary evaluation model |
| Gemini 2.5 Flash Lite | `openrouter:google/gemini-2.5-flash-lite` | Fast alternative |
| Ministral 8B | `openrouter:mistralai/ministral-8b-2512` | Small model comparison |

To change models, edit the `providers` section in config files.

## Test Categories

### Router Classification
Tests query routing to correct agents:
- Simple queries → `simple-agent`
- Complex code → `orchestrator-agent`
- Research → `lead-researcher-agent`
- Personal info → `duyet-info-agent`

### Telegram Format
Validates mobile-optimized responses:
- Concise answers (no filler phrases)
- Proper code formatting (inline vs blocks)
- Language identifiers for code blocks

### GitHub Format
Validates GitHub-flavored markdown:
- Code blocks with language identifiers
- Heading structure
- GitHub alerts for warnings/notes

### Response Quality
Evaluates platform-specific behavior:
- Telegram: brevity, progressive disclosure
- GitHub: comprehensive detail, structured sections

## How Prompt Helpers Work

JavaScript prompt helpers import the **real production prompts** and return message arrays:

```javascript
// prompts/telegram-prompt.cjs
module.exports = async function ({ vars }) {
  const { getTelegramPrompt } = await import('../../packages/prompts/src/platforms/telegram.cjs');
  const systemPrompt = getTelegramPrompt({ outputFormat: 'telegram-html' });
  const query = vars.query || '';

  return [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: query }
  ];
};
```

This ensures:
1. Tests validate actual production behavior
2. Prompt changes in `packages/prompts/` are automatically tested
3. No duplicate/stale test prompts to maintain
4. Leverages promptfoo's built-in OpenRouter provider (handles retries, rate limits)

## Adding Tests

### 1. Create test cases in `datasets/*.yaml`:
```yaml
- description: "Your test description"
  vars:
    query: "Test query"
  assert:
    - type: contains
      value: "expected text"
    - type: llm-rubric
      value: "Natural language assertion evaluated by LLM"
```

### 2. For router tests, use custom assertion:
```yaml
- description: "Router test"
  vars:
    query: "Test query"
    __expected: "simple-agent"  # Expected agent name
  assert:
    - type: javascript
      value: file://assertions/router-assertion.cjs
```

### 3. Available assertion types:
- `contains` - Check if output contains text
- `not-contains` - Check output doesn't contain text
- `contains-any` - Check for any of multiple values
- `llm-rubric` - LLM-evaluated quality assertion
- `javascript` - Custom JS function (e.g., router-assertion.cjs)

## Resources

- [promptfoo Documentation](https://www.promptfoo.dev/docs)
- [Assertion Types](https://www.promptfoo.dev/docs/configuration/expected-outputs)
- [OpenRouter Models](https://openrouter.ai/models)
