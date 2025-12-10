# @duyetbot/prompts

System prompts for duyetbot agents.

## Testing Guidelines

Tests should verify **logic and behavior**, not specific prompt content:

- Prompt content changes frequently as we iterate on LLM instructions
- Tests that check for specific phrases become brittle and break on minor edits
- Focus on verifying the function's behavior (e.g., "sets correct platform", "includes guidelines section")

### Good Test Examples

```typescript
// Verify behavior: format sets correct platform
expect(prompt).toContain('<platform>telegram</platform>');

// Verify structure: guidelines section exists
expect(prompt).toContain('<response_guidelines>');

// Verify logic: format-specific content is longer than base
expect(section.length).toBeGreaterThan(baseSection.length);
```

### Avoid

```typescript
// Brittle: specific prompt wording
expect(prompt).toContain('Keep responses concise for mobile reading');

// Brittle: specific formatting examples
expect(prompt).toContain('<b>bold</b> for emphasis');
```

## Structure

- `src/builder.ts` - Fluent API for composing prompts
- `src/sections/` - Reusable prompt sections (identity, policy, guidelines, etc.)
- `src/platforms/` - Platform-specific prompts (telegram, github)
- `src/agents/` - Agent-specific prompts (router, orchestrator, simple)
