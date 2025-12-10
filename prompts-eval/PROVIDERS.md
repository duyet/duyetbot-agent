# Custom Promptfoo Providers

This directory contains TypeScript providers that integrate with Promptfoo for prompt evaluation.

## Files

### `prompt-builder-provider.ts`

Wraps the `@duyetbot/prompts` PromptBuilder to generate system prompts for evaluation.

**Factory Function**:
```typescript
export function createPromptBuilderProvider(config: PromptBuilderConfig)
```

**Pre-built Exports**:
- `telegramHtml` - Telegram HTML format
- `telegramMarkdownV2` - Telegram MarkdownV2 format  
- `githubMarkdown` - GitHub markdown with tools
- `plainText` - Plain text without tools
- `plainWithTools` - Plain text with tools

**Configuration**:
```typescript
interface PromptBuilderConfig {
  platform?: Platform;        // 'telegram' | 'github' | 'api' | 'cli'
  outputFormat?: OutputFormat; // 'telegram-html' | 'telegram-markdown' | 'github-markdown' | 'plain'
  includeTools?: boolean;      // Include tools section
  capabilities?: string[];     // Custom capabilities
}
```

**Example Usage in promptfoo.yaml**:
```yaml
providers:
  - id: prompt-builder:telegram-html
    config: {}
```

**What It Does**:
1. Creates PromptBuilder with standard sections (identity, policy, capabilities)
2. Applies platform-specific formatting
3. Includes tools if requested
4. Returns raw system prompt as output

---

### `classifier-provider.ts`

Uses pattern-based query classification for routing accuracy testing.

**Functions**:
```typescript
export async function classifierProvider(
  prompt: string,
  context: ProviderContext
): Promise<ProviderResponse>

export async function classifierDebugProvider(
  prompt: string,
  context: ProviderContext
): Promise<ProviderResponse>
```

**Output**:
- `classifierProvider`: Returns agent name (e.g., "duyet-info-agent", "simple-agent")
- `classifierDebugProvider`: Returns JSON with full agent metadata

**Example Usage in promptfoo.yaml**:
```yaml
providers:
  - id: prompt-builder:classifier
    config: {}
```

**What It Does**:
1. Uses `agentRegistry.quickClassify()` for fast pattern matching
2. No LLM calls (cost-effective for testing)
3. Returns classified agent name
4. Falls back to 'simple-agent' if no match

---

## Integration Examples

### Router Evaluation Config

```yaml
# prompts-eval/configs/router.promptfoo.yaml
providers:
  - id: prompt-builder:classifier

tests:
  - description: "Classify code inquiry"
    vars:
      query: "help me debug this function"
    assert:
      - type: equals
        value: "code-agent"
  
  - description: "Classify research inquiry"
    vars:
      query: "what are the latest trends in AI"
    assert:
      - type: equals
        value: "research-agent"
```

### Quality Assessment Config

```yaml
# prompts-eval/configs/quality.promptfoo.yaml
providers:
  - id: prompt-builder:telegram-html
  - id: some-llm-provider:claude

tests:
  - vars:
      userMessage: "explain recursion"
    assert:
      - type: contains
        value: "function calls itself"
```

---

## Key Implementation Details

### No JSON Wrapping
The prompt-builder provider returns raw system prompts, not JSON-wrapped. This allows direct use as system prompts in LLM calls.

### Pattern-Only Classification
The classifier uses the fast registry pattern matching, not LLM classification. This:
- Avoids API costs during testing
- Provides instant feedback
- Suitable for regression testing routing logic

### Type Safety
All types are imported from existing packages:
- `OutputFormat`, `Platform`, `ToolDefinition` from `@duyetbot/prompts`
- `AgentDefinition` from `@duyetbot/cloudflare-agent`

### ESM Modules
Uses `.js` extensions in imports per ESM requirements.

---

## Running Evaluations

```bash
# Evaluate router classification
bun run prompt:eval:router

# Evaluate Telegram prompts
bun run prompt:eval:telegram

# Evaluate GitHub prompts
bun run prompt:eval:github

# View results UI
bun run prompt:view

# Share results
bun run prompt:share
```

---

## Architecture

```
Promptfoo Config
  ↓
  Calls prompt-builder:telegram-html
    → createPromptBuilderProvider({ platform: 'telegram', outputFormat: 'telegram-html' })
    → Returns system prompt
    ↓
  Passes to LLM provider with user message
    ↓
  LLM returns response
    ↓
  Compare against assertions

  Calls prompt-builder:classifier
    → classifierProvider(userQuery)
    → Uses agentRegistry.quickClassify()
    → Returns agent name
    ↓
  Compare against expected agent name
```

---

## Extending Providers

### Add New Prompt Configuration

```typescript
// In prompt-builder-provider.ts
export const apiJsonSchema = createPromptBuilderProvider({
  platform: 'api',
  outputFormat: 'plain',
  includeTools: true,
  capabilities: ['JSON schema generation', 'API design']
});
```

### Add New Classification Provider

```typescript
// In classifier-provider.ts
export async function classifierWithLlmProvider(
  prompt: string,
  context: ProviderContext
): Promise<ProviderResponse> {
  // Use hybrid classification with LLM
  const classification = await hybridClassify(prompt, config, context);
  return {
    output: classification.suggestedTools?.[0] || 'simple-agent',
    // ...
  };
}
```

---

## Testing

```bash
# Type check
bun run type-check

# Lint
bun run lint

# Run specific test config
cd prompts-eval && promptfoo eval -c configs/router.promptfoo.yaml
```

---

## See Also

- `/packages/prompts/src/builder.ts` - PromptBuilder implementation
- `/packages/cloudflare-agent/src/agents/registry.ts` - Agent registry
- `./configs/` - Promptfoo evaluation configurations
- `./datasets/` - Test datasets
