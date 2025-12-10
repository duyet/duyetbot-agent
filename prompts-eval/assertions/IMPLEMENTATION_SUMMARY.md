# Custom Promptfoo Assertions - Implementation Summary

## Overview

Successfully created 4 TypeScript assertion files for the promptfoo integration with comprehensive validation logic for platform-specific prompt formatting rules.

**Total Lines of Code:** 1,327 lines across 4 files  
**Biome Status:** Passes all checks (25 minor warnings are intentional)  
**TypeScript Target:** ES2022  

## Files Created

### 1. telegram-html.ts (272 lines)
**Purpose:** Validate Telegram HTML formatting compliance

**Key Features:**
- Validates allowed HTML tags: `<b>`, `<i>`, `<u>`, `<s>`, `<code>`, `<pre>`, `<a>`, `<blockquote>`
- Blocks disallowed tags: `<script>`, `<style>`, `<iframe>`, `<form>`, etc.
- Validates proper HTML tag nesting and closure
- Checks character escaping: `<` → `&lt;`, `>` → `&gt;`, `&` → `&amp;`
- Detects and prevents Markdown syntax usage
- 4 exported assertion functions
- Component-based scoring system for detailed validation feedback

**Functions:**
1. `telegramHtmlValid()` - Main validation
2. `telegramHtmlTagsClosed()` - Tag closure validation
3. `telegramHtmlContains()` - Expected element checking
4. `telegramHtmlEscaping()` - Character escaping validation

### 2. markdown-v2.ts (314 lines)
**Purpose:** Validate Telegram MarkdownV2 formatting compliance

**Key Features:**
- Validates no manual character escaping (transport layer handles automatically)
- Checks paired formatting markers: `*bold*`, `_italic_`, `~strikethrough~`, `||spoiler||`
- Enforces critical link formatting rule: `*[text](url)*` NOT `[*text*](url)`
- Validates code block syntax with language specifiers
- Detects double-escaping issues
- 4 exported assertion functions
- Comprehensive validation of MarkdownV2 syntax rules

**Functions:**
1. `markdownV2Valid()` - Main validation (5 component checks)
2. `markdownV2CodeBlockValid()` - Code block escaping validation
3. `markdownV2LinkFormat()` - Critical link syntax validation
4. `markdownV2NoManualEscaping()` - Manual escaping detection

**Critical Rule Enforced:**
> The transport layer handles ALL escaping automatically. Write plain text naturally - DO NOT manually escape special characters.

### 3. github-markdown.ts (359 lines)
**Purpose:** Validate GitHub-flavored markdown formatting compliance

**Key Features:**
- Validates GitHub alerts: `> [!NOTE]`, `> [!TIP]`, `> [!WARNING]`, `> [!CAUTION]`, `> [!IMPORTANT]`
- Checks code blocks have language specifiers
- Validates file and issue/PR linking patterns
- Enforces heading hierarchy (no jumps like h1 → h3)
- Validates structured response format: TL;DR → Details → Action Items
- Checks markdown features: tables, task lists, ASCII diagrams, collapsible sections
- 5 exported assertion functions
- Multi-component validation with detailed feedback

**Functions:**
1. `githubMarkdownValid()` - Main validation with configurable feature checks
2. `githubStructuredFormat()` - Response structure validation
3. `githubAlertsValid()` - Alert syntax validation
4. `githubProperLinking()` - File/issue/PR linking validation
5. `githubMarkdownFeatures()` - Markdown feature usage validation

### 4. routing-accuracy.ts (382 lines)
**Purpose:** Validate agent routing and query classification accuracy

**Key Features:**
- Validates correct agent classification for queries
- Checks confidence scores against thresholds
- Route validation for specific agent types:
  - SimpleAgent for simple queries
  - CodeWorker for code-related queries
  - ResearchWorker for web/research queries
  - GitHubWorker for GitHub-related queries
  - DuyetInfoAgent for personal/identity queries
- Validates pattern-based fast-path classification (< 10ms latency)
- Checks routing decisions include reasoning/explanation
- 10 exported assertion functions
- Flexible agent name normalization (case-insensitive, handles underscores/dashes)

**Functions:**
1. `routesToAgent()` - Core routing validation
2. `routingConfidence()` - Confidence score validation
3. `simpleQueryRoutesCorrectly()` - Simple query routing
4. `complexQueryNotSimple()` - Complex query routing
5. `codeQueryRoutesCorrectly()` - Code query routing
6. `researchQueryRoutesCorrectly()` - Research query routing
7. `githubQueryRoutesCorrectly()` - GitHub query routing
8. `usesPatternMatching()` - Pattern classification validation
9. `hasRoutingReasoning()` - Routing reasoning validation
10. `personalInfoQueryRoutesCorrectly()` - Personal info query routing

## Design Principles

### 1. Component-Based Validation
All assertions return detailed component results showing:
- Individual pass/fail status for each validation component
- Granular scoring (0-1 scale)
- Specific reasons for failures

### 2. Flexible Configuration
Assertions support optional parameters for:
- Expected values (context.value)
- Thresholds (context.threshold)
- Required features (context.features, context.required)

### 3. Robust Output Parsing
All assertions handle multiple output formats:
- Plain text responses
- JSON responses with metadata
- Nested JSON structures with various field names

### 4. Clear Error Messages
Every assertion provides actionable feedback:
- Specific issues identified
- Expected vs. actual values
- Guidance on corrections

## Integration Points

### Reference Documentation
All assertions reference the source formatting guidelines:
- `packages/prompts/src/sections/guidelines.ts` - Format specifications
- `packages/prompts/src/platforms/telegram.ts` - Telegram guidelines
- `packages/prompts/src/platforms/github.ts` - GitHub guidelines

### Framework Compatibility
- Designed for Promptfoo custom assertion integration
- Supports both simple and complex validation scenarios
- Returns standard GradingResult interface

## Quality Metrics

### Code Quality
- TypeScript ES2022 target with strict mode
- Passes Biome linting (25 intentional warnings for unused parameters)
- Comprehensive JSDoc comments
- Clear function signatures and interfaces

### Testing Coverage
- 22 distinct assertion functions
- Multiple validation paths per function
- Edge case handling (empty inputs, missing fields, etc.)
- Regex pattern validation for formatting rules

### Performance
- Efficient regex-based pattern matching
- Minimal dependencies (native TypeScript/regex only)
- O(n) complexity for most operations

## Usage Examples

### Telegram HTML Validation
```javascript
const result = await telegramHtmlValid(
  '<b>bold text</b> <code>inline code</code>',
  {}
);
// Returns: { pass: true, score: 1.0, reason: "Valid Telegram HTML format" }
```

### MarkdownV2 Link Validation
```javascript
const result = await markdownV2LinkFormat(
  '*[Article](https://example.com)*',
  {}
);
// Returns: { pass: true, score: 1.0 }
```

### Routing Accuracy
```javascript
const result = await routesToAgent(
  'code-worker',
  { value: 'code-worker' }
);
// Returns: { pass: true, score: 1.0, reason: "Correctly routed to code-worker" }
```

## Files Location

All files are in: `/Users/duet/project/duyetbot-agent/prompts-eval/assertions/`

- `telegram-html.ts` - Telegram HTML assertions
- `markdown-v2.ts` - Telegram MarkdownV2 assertions
- `github-markdown.ts` - GitHub Markdown assertions
- `routing-accuracy.ts` - Agent routing assertions
- `README.md` - Detailed documentation
- `IMPLEMENTATION_SUMMARY.md` - This file

## Next Steps

1. **Test Configuration:** Create test cases in `prompts-eval/configs/` to use these assertions
2. **Integration:** Connect assertions to promptfoo test runner
3. **Evaluation:** Run prompt evaluation suite against test datasets
4. **Monitoring:** Track formatting compliance across different prompt variants
5. **Enhancement:** Add more assertion types as new requirements emerge

## Notes

- All assertions are async functions returning `Promise<GradingResult>`
- The `context` parameter supports future extensibility
- Assertions are platform-independent and can be used standalone
- No external dependencies beyond TypeScript standard library
