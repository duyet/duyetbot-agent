---
title: Prompt Evaluation
description: Test and evaluate prompts using promptfoo with OpenRouter models
---

# Prompt Evaluation

Test production prompts using [promptfoo](https://www.promptfoo.dev/) - an open-source LLM evaluation framework. This ensures prompt quality, routing accuracy, and format compliance across platforms.

## Quick Start

```bash
# Set OpenRouter API key
export OPENROUTER_API_KEY=your_key_here

# Run all evaluations
bun run prompt:eval

# Run specific suite
bun run prompt:eval:router     # Router classification
bun run prompt:eval:telegram   # Telegram format
bun run prompt:eval:github     # GitHub format
bun run prompt:eval:quality    # Response quality

# View results
bun run prompt:view            # Interactive web UI
bun run prompt:report          # Generate HTML dashboard
```

## Architecture

```
prompts-eval/
├── configs/           # promptfoo YAML configurations
│   ├── router.promptfoo.yaml
│   ├── telegram.promptfoo.yaml
│   ├── github.promptfoo.yaml
│   └── quality.promptfoo.yaml
├── datasets/          # Test case definitions
│   ├── router-cases.yaml
│   ├── telegram-cases.yaml
│   ├── telegram-markdown-cases.yaml
│   ├── github-cases.yaml
│   └── quality-cases.yaml
├── prompts/           # JS helpers using REAL production prompts
│   ├── router-prompt.cjs
│   ├── telegram-prompt.cjs
│   └── github-prompt.cjs
├── assertions/        # Custom validation logic
│   ├── router-assertion.cjs
│   ├── telegram-format-assertion.cjs
│   ├── telegram-html.ts
│   ├── markdown-v2.ts
│   └── routing-accuracy.ts
└── results/           # JSON + HTML outputs
```

## Key Design: Production Prompts

**This suite tests actual production prompts**, not separate test copies:

| Evaluation | Production Source |
|------------|-------------------|
| Router | `packages/prompts/src/agents/router.ts` → `getRouterPrompt()` |
| Telegram | `packages/prompts/src/platforms/telegram.ts` → `getTelegramPrompt()` |
| GitHub | `packages/prompts/src/platforms/github.ts` → `getGitHubBotPrompt()` |

JavaScript helpers in `prompts/` import the real prompt functions, ensuring tests validate actual production behavior.

## Test Suites

### Router Classification (15 tests)

Tests query routing accuracy to correct agents:

| Query Type | Expected Agent |
|------------|----------------|
| Simple questions | `simple-agent` |
| Complex code tasks | `orchestrator-agent` |
| Research queries | `lead-researcher-agent` |
| Personal info about Duyet | `duyet-info-agent` |

```yaml
# Example: router-cases.yaml
- description: "Simple greeting routes to simple-agent"
  vars:
    query: "Hello, how are you?"
    __expected: "simple-agent"
  assert:
    - type: javascript
      value: file://assertions/router-assertion.cjs
```

### Telegram Format (29 tests)

Validates mobile-optimized responses:
- Conciseness (no filler phrases)
- HTML/MarkdownV2 format compliance
- Code formatting (inline vs blocks)
- URL handling and understanding

### GitHub Format (6 tests)

Validates GitHub-flavored markdown:
- Code blocks with language identifiers
- Heading structure
- GitHub alerts for warnings/notes

### Response Quality (8 tests)

Cross-platform behavior validation:
- Telegram: brevity, progressive disclosure
- GitHub: comprehensive detail, structured sections

## LLM Providers

Uses promptfoo's built-in OpenRouter provider with state-of-the-art models:

| Model | ID | Use Case |
|-------|------|----------|
| Grok 4.1 Fast | `openrouter:x-ai/grok-4.1-fast` | Primary evaluation |
| Gemini 2.5 Flash Lite | `openrouter:google/gemini-2.5-flash-lite` | Fast alternative |
| Ministral 8B | `openrouter:mistralai/ministral-8b-2512` | Small model comparison |

Change models in config files under the `providers` section.

## Adding Tests

### 1. Create test cases

```yaml
# datasets/your-cases.yaml
- description: "Your test description"
  vars:
    query: "Test query"
  assert:
    - type: contains
      value: "expected text"
    - type: llm-rubric
      value: "Natural language assertion evaluated by LLM"
```

### 2. For router tests, use custom assertion

```yaml
- description: "Router test"
  vars:
    query: "Test query"
    __expected: "simple-agent"
  assert:
    - type: javascript
      value: file://assertions/router-assertion.cjs
```

### 3. Available assertion types

| Type | Description |
|------|-------------|
| `contains` | Check if output contains text |
| `not-contains` | Check output doesn't contain text |
| `contains-any` | Check for any of multiple values |
| `llm-rubric` | LLM-evaluated quality assertion |
| `javascript` | Custom JS function |

## Assertion Strategy

Progressive scoring (0.0 - 1.0):

| Score | Meaning |
|-------|---------|
| 1.0 | Perfect compliance |
| 0.8-0.9 | Minor issues (warnings) |
| 0.6-0.7 | Acceptable with reservations |
| 0.3-0.5 | Concerning but usable |
| 0.0-0.2 | Significant issues |

**Pass Threshold:** 0.5

## CI Integration

The evaluation suite runs in CI to catch prompt regressions:

```bash
# CI workflow
bun run prompt:eval --output results/ci-results.json
```

Results are uploaded as artifacts for review.

## Related Documentation

- [prompts-eval/README.md](/prompts-eval/README.md) - Full technical details
- [prompts-eval/TESTING_GUIDE.md](/prompts-eval/TESTING_GUIDE.md) - Testing procedures
- [prompts-eval/PROVIDERS.md](/prompts-eval/PROVIDERS.md) - Provider configuration
- [promptfoo Documentation](https://www.promptfoo.dev/docs) - Official docs
