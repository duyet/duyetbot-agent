# Promptfoo Custom Assertions

This directory contains custom assertion functions for validating prompt outputs against platform-specific formatting rules.

## Files

### 1. `telegram-html.ts`
Validates Telegram HTML formatting compliance.

**Exported Functions:**
- `telegramHtmlValid()` - Main validation function
- `telegramHtmlTagsClosed()` - Validates tag nesting
- `telegramHtmlContains()` - Checks for expected HTML elements
- `telegramHtmlEscaping()` - Validates character escaping

**Reference:** `packages/prompts/src/sections/guidelines.ts` - `TELEGRAM_HTML_FORMAT`

### 2. `markdown-v2.ts`
Validates Telegram MarkdownV2 formatting compliance.

**Exported Functions:**
- `markdownV2Valid()` - Main validation function
- `markdownV2CodeBlockValid()` - Validates code block syntax
- `markdownV2LinkFormat()` - Validates link formatting (critical rule: markers wrap entire link)
- `markdownV2NoManualEscaping()` - Validates no manual escaping (transport layer handles it)

**Reference:** `packages/prompts/src/sections/guidelines.ts` - `TELEGRAM_MARKDOWNV2_FORMAT`

**Critical Rule:** The transport layer handles ALL escaping automatically. Write plain text naturally - DO NOT manually escape special characters.

### 3. `github-markdown.ts`
Validates GitHub-flavored markdown formatting compliance.

**Exported Functions:**
- `githubMarkdownValid()` - Main validation function
- `githubStructuredFormat()` - Validates TL;DR → Details → Action Items structure
- `githubAlertsValid()` - Validates GitHub alert syntax (NOTE, TIP, WARNING, etc.)
- `githubProperLinking()` - Validates file/issue/PR linking
- `githubMarkdownFeatures()` - Validates GitHub markdown features (tables, lists, etc.)

**Reference:** `packages/prompts/src/sections/guidelines.ts` - `GITHUB_MARKDOWN_GUIDELINES`

### 4. `routing-accuracy.ts`
Validates query routing accuracy and agent classification.

**Exported Functions:**
- `routesToAgent()` - Validates correct agent classification
- `routingConfidence()` - Validates confidence scores meet threshold
- `simpleQueryRoutesCorrectly()` - Validates simple queries route to SimpleAgent
- `complexQueryNotSimple()` - Validates complex queries don't route to simple-agent
- `codeQueryRoutesCorrectly()` - Validates code queries route to CodeWorker
- `researchQueryRoutesCorrectly()` - Validates research queries route to ResearchWorker
- `githubQueryRoutesCorrectly()` - Validates GitHub queries route to GitHubWorker
- `usesPatternMatching()` - Validates pattern-based classification (fast path)
- `hasRoutingReasoning()` - Validates routing decision includes reasoning
- `personalInfoQueryRoutesCorrectly()` - Validates personal info queries route to DuyetInfoAgent

## Integration with Promptfoo

These assertions are designed to work with Promptfoo test configuration files. Example usage in `prompts-eval/configs/`:

```yaml
tests:
  - description: "Test telegram HTML formatting"
    vars:
      query: "Sample prompt output"
    assert:
      - type: custom
        provider:
          id: file:///path/to/telegram-html.ts:telegramHtmlValid
        threshold: 0.8
```

## Formatting Guidelines Reference

### Telegram HTML
- Allowed tags: `<b>`, `<i>`, `<u>`, `<s>`, `<code>`, `<pre>`, `<a>`, `<blockquote>`
- Disallowed tags: `<script>`, `<style>`, `<iframe>`, etc.
- Must escape: `<` → `&lt;`, `>` → `&gt;`, `&` → `&amp;`
- No Markdown syntax allowed

### Telegram MarkdownV2
- Basic: `*bold*`, `_italic_`, `__underline__`, `~strikethrough~`, `||spoiler||`
- Code: `` `inline` `` or `` ```language\ncode\n``` ``
- Links: `*[text](url)*` (markers wrap entire link, NOT `[*text*](url)`)
- Character escaping: Transport layer handles automatically - write plain text naturally
- Invalid escaping: Manual backslash escaping causes double-escaping

### GitHub Markdown
- Alerts: `> [!NOTE]`, `> [!TIP]`, `> [!WARNING]`, `> [!CAUTION]`, `> [!IMPORTANT]`
- Code blocks: `` ```language\ncode\n``` ``
- Structured format: TL;DR → Details → Action Items
- Links: `[text](url)` with proper hierarchy
- Features: Tables, task lists, ASCII diagrams, collapsible sections

## Notes

- These assertions are designed for evaluation/testing purposes
- Context parameters prefixed with `_` indicate intentional non-usage (may be used by framework)
- Unused constants are kept for documentation and future use
- All assertions return `GradingResult` with `pass`, `score`, and `reason` fields
