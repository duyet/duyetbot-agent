# Telegram Format Assertions - Technical Specification

## Overview

This document specifies the assertion logic for Telegram bot evaluation tests. Assertions validate both content quality (through llm-rubric) and format compliance (through javascript).

**Pass Threshold:** 0.5 (scores 0.5-1.0 = PASS, < 0.5 = FAIL)
**Validation Approach:** Progressive scoring with graduated penalties

## Assertion Types

### 1. LLM-Rubric Assertions

**Type:** `llm-rubric`
**Validation:** GPT-4 evaluation based on descriptive criteria
**Purpose:** Evaluate content quality, semantic correctness, tone

**Usage:**
```yaml
assert:
  - type: llm-rubric
    value: "Response should be concise (1-3 sentences max) and answer directly without filler"
```

**Best Practices:**
- Describe what makes a GOOD response
- Include concrete examples when possible
- Specify what to avoid explicitly
- Keep criteria specific to the question type

### 2. JavaScript Assertions

**Type:** `javascript`
**Validation:** Custom logic with 0.0-1.0 scoring
**Purpose:** Validate format, pattern matching, structure

**Usage:**
```yaml
assert:
  - type: javascript
    value: |
      // Assertion code
      const hasPattern = /pattern/.test(output);
      const score = hasPattern ? 1 : 0.5;
      return {
        pass: score >= 0.5,
        score,
        reason: hasPattern ? 'Good' : 'Needs improvement'
      };
```

**Return Object:**
```typescript
interface AssertionResult {
  pass: boolean;      // true if score >= 0.5
  score: number;      // 0.0 - 1.0
  reason: string;     // Human-readable explanation
}
```

### 3. Utility Assertions

**Type:** `contains`, `not-contains`
**Validation:** Simple string matching
**Purpose:** Quick checks for required/forbidden content

**Usage:**
```yaml
assert:
  - type: contains
    value: "`"  # Must contain backticks
  - type: not-contains
    value: "<b>"  # Must not contain HTML bold
```

---

## Creator Info Assertions

### Objective
Verify that the model indicates use of the `creator_info` tool or appropriately responds to personal information requests without fabrication.

### Test Cases

#### HTML: "Who is Duyet?"
```yaml
- description: "[HTML] Creator info request"
  query: "Who is Duyet?"
  assert:
    - type: javascript
      value: |
        const toolPatterns = [
          /creator_info/i,
          /fetch.*duyet/i,
          /get.*duyet.*info/i,
          /mcp.*creator/i,
          /tool.*creator/i,
          /let me.*fetch/i,
          /let me.*check/i,
          /I.*can access/i,
          /I.*need to.*access/i,
          /accessing.*information/i,
          /look.*up/i,
        ];
        const indicatesTool = toolPatterns.some(p => p.test(output));
        const fabricatesWithoutTool = /(?:duyet is|duyet was|duyet lives|duyet works at|duyet is from).*(?:\w+)/i.test(output)
          && !toolPatterns.some(p => p.test(output))
          && !/duyet is an?.*(?:ai|agent|bot|assistant)/i.test(output);
        return {
          pass: !fabricatesWithoutTool,
          score: indicatesTool ? 1 : (fabricatesWithoutTool ? 0 : 0.6),
          reason: indicatesTool
            ? 'Correctly indicates using tool or accessing real data'
            : (fabricatesWithoutTool ? 'Should NOT fabricate personal details without indicating tool use' : 'Responds appropriately to personal info request')
        };
```

### Scoring Rules

| Scenario | Score | Pass | Reason |
|----------|-------|------|--------|
| Explicit tool mention | 1.0 | Yes | "I'll use creator_info tool" |
| Semantic tool indication | 0.6 | Yes | "Let me fetch that info" |
| Appropriate deflection | 0.6 | Yes | "I don't have specific details" |
| Fabrication without tool | 0.0 | No | "Duyet is a senior engineer" (no tool mention) |
| General knowledge | 0.6 | Yes | "Duyet is an AI agent" |

### Tool Pattern Recognition

**Pattern Categories:**
1. **Explicit mention:** `creator_info`, `mcp.*creator`, `tool.*creator`
2. **Fetch semantics:** `fetch.*duyet`, `get.*duyet.*info`, `retrieve.*profile`
3. **Access indication:** `I.*can access`, `I.*need to.*access`, `accessing.*information`
4. **Action intent:** `let me.*fetch`, `let me.*check`, `look.*up`

---

## URL Handling Assertions

### Objective
Verify that the model appropriately handles URLs by either:
1. Indicating it will fetch/access the content, OR
2. Demonstrating understanding of what the URL contains

### Test Cases

#### HTML: URL Only "https://news.ycombinator.com/item?id=42345678"
```javascript
const actionPatterns = [
  /web_fetch/i,
  /fetch/i,
  /read/i,
  /access/i,
  /retrieve/i,
  /tool/i,
  /let me/i,
  /I('ll| will| can| need)/i,
  /I'm.*access/i,
  /I'm.*fetch/i,
  /can.*access/i,
  /will.*fetch/i,
];
const understandsContent = [
  /hacker\s*news/i,
  /ycombinator/i,
  /y\s*combinator/i,
  /hackernews/i,
  /tech.*news/i,
  /startup.*news/i,
];
const indicatesAction = actionPatterns.some(p => p.test(output));
const knowsContent = understandsContent.some(p => p.test(output));
const indicatesWillProcess = indicatesAction || knowsContent;
const asksForClarification = /what would you like|what do you want|how can i help|what.*know about/i.test(output);
const score = indicatesWillProcess ? (asksForClarification ? 0.5 : 1) : 0.2;
return {
  pass: score >= 0.5,
  score,
  reason: indicatesAction
    ? (asksForClarification ? 'Preferably act without asking' : 'Correctly indicates action')
    : (knowsContent ? 'Shows understanding of URL content' : 'Should indicate will fetch/access URL')
};
```

### Scoring Rules

| Scenario | Score | Pass | Reason |
|----------|-------|------|--------|
| "I'll fetch that link" | 1.0 | Yes | Explicit action on URL |
| "This is a HackerNews discussion" | 0.5 | Yes | Understanding + no clarification question |
| "Can you tell me what that link is?" | 0.0 | No | Asks for clarification |
| "I'll access the HackerNews link" | 1.0 | Yes | Action + domain knowledge |
| Generic response | 0.2 | No | No action or understanding |

---

## Format Validation Assertions

### Objective
Verify that responses use correct formatting based on `outputFormat` variable.

### HTML Format Rules

#### Forbidden Markdown Syntax

1. **Bold:** `**text**` → Use `<b>text</b>`
   - Pattern: `/\*\*[^*]+\*\*/g`
   - Penalty: -0.25 per occurrence

2. **Underline:** `__text__` → Use `<u>text</u>`
   - Pattern: `/__[^_]+__/g`
   - Penalty: -0.25 per occurrence

3. **Code block:** ` ```code``` ` → Use `<pre><code>code</code></pre>`
   - Pattern: `/```[\s\S]*?```/`
   - Penalty: -0.25

4. **Links:** `[text](url)` → Use `<a href="url">text</a>`
   - Pattern: `/\[[^\]]+\]\([^)]+\)/`
   - Penalty: -0.1 (warning only)

#### Allowed HTML Tags
- `<b>`, `<i>`, `<u>`, `<s>` - Formatting
- `<code>`, `<pre>` - Code
- `<a>` - Links
- `<blockquote>` - Quotes
- `<tg-spoiler>` - Spoiler text

#### Tag Balance Tolerance
- Allows up to 1 tag mismatch (open vs close count)
- Example: `<pre><code>text` (1 unclosed tag) is acceptable
- Example: `<pre><code>text</pre>` (mismatched: <code> not closed) is acceptable

#### Character Escaping
- Only warn on multiple unescaped `<` or `>` characters
- Single occurrence acceptable in text

### MarkdownV2 Format Rules

#### Forbidden HTML Syntax

1. **HTML tags:** `<b>`, `<i>`, `<u>`, `<code>`, `<pre>`, `<a>`, etc.
   - Pattern: `/<(b|i|u|s|code|pre|a|blockquote|tg-spoiler)[^>]*>/i`
   - Penalty: -0.25

#### Required MarkdownV2 Markers

1. **Bold:** `*text*` (single asterisks)
2. **Italic:** `_text_` (single underscores)
3. **Underline:** `__text__` (double underscores)
4. **Inline code:** `` `text` `` (backticks)
5. **Code block:** ` ```language\ncode\n``` `
6. **Links:** `[text](url)`
7. **Spoiler:** `||text||`

#### Marker Placement Rules

**Links with formatting:**
- ✅ Correct: `*[text](url)*` - Markers wrap entire link
- ❌ Wrong: `[*text*](url)` - Markers inside brackets

**Escaping:**
- 0-5 escape sequences: Warning only
- 5+ escape sequences: Error (-0.25)
- Should be handled by transport layer

#### Code Block Language Identifier

- Single code block: Language identifier optional
- Multiple code blocks: Recommend language identifiers
- Patterns: ` ```python`, ` ```javascript`, ` ```typescript`, etc.

### Scoring Algorithm

```javascript
let score = 1.0;  // Start perfect

// Errors (major violations)
errors.forEach(() => score -= 0.25);  // Each error costs 0.25

// Warnings (minor issues)
warnings.forEach(() => score -= 0.1);  // Each warning costs 0.1

// Clamp to 0-1 range
score = Math.max(0, Math.min(1, score));

// Pass if >= 0.5
const pass = score >= 0.5;
```

---

## Conciseness Standards

### By Question Type

#### Factual Questions
- **Example:** "What is the capital of France?"
- **Acceptable:** "Paris", "Paris, France", "The capital is Paris"
- **Unacceptable:** Lengthy explanation with historical context
- **Word count:** 1-5 words ideal

#### Code Snippet Questions
- **Example:** "How do I reverse a string in Python?"
- **Acceptable:** Code block with 1-2 line explanation
- **Unacceptable:** Multiple paragraphs of explanation before code
- **Structure:** Code-first, minimal explanation
- **Word count:** <150 words total

#### Explanation Questions
- **Example:** "What is Docker?"
- **Acceptable:** 1-3 sentences, 50-100 words
- **Unacceptable:** Multi-paragraph explanation with history and advanced topics
- **Word count:** 50-100 words target

#### Multi-part Questions
- **Example:** "List 3 JavaScript frameworks"
- **Format:** Direct list without preamble
- **Structure:** Items directly without "Here are the frameworks"
- **Word count:** Minimal introductory text

---

## Test Result Interpretation

### Pass Criteria
- `pass: true` AND `score >= 0.5` = Test passes
- `pass: false` OR `score < 0.5` = Test fails

### Score Ranges
- **1.0** = Perfect response
- **0.8-0.9** = Excellent, minor issues only
- **0.6-0.7** = Good, acceptable with reservations
- **0.5-0.6** = Borderline, just barely passing
- **0.3-0.4** = Poor, concerning issues
- **0.0-0.2** = Failed, significant problems

### Reason Field
Always provides human-readable explanation:
- Why it passed/failed
- What could be improved
- Specific pattern matches found

---

## Implementation Guidelines

### Adding New Assertions

1. **Identify the type:** javascript or llm-rubric?
2. **Define success criteria:** What makes a good response?
3. **Write pattern matching:** Use specific regex patterns
4. **Score appropriately:** 0.5 pass threshold
5. **Provide reason:** Clear human-readable feedback

### Testing Assertions

```bash
# Validate JavaScript syntax
node -c prompts-eval/assertions/telegram-format-assertion.cjs

# Run with promptfoo
cd prompts-eval
promptfoo eval -c configs/telegram.promptfoo.yaml

# Review results
cat results/telegram-results.json | jq '.[0].results[0]'
```

### Debugging Failed Tests

```javascript
// Enable detailed output
console.log('Output:', output);
console.log('Score:', score);
console.log('Pass:', pass);
console.log('Reason:', reason);

// Check specific patterns
console.log('Pattern matches:', output.match(/pattern/g));
console.log('Contains text:', output.includes('text'));
```

---

## References

- **Telegram HTML:** https://core.telegram.org/bots/api#html-style
- **Telegram MarkdownV2:** https://core.telegram.org/bots/api#markdownv2-style
- **Promptfoo Assertions:** https://www.promptfoo.dev/docs/usage/assert
- **Promptfoo Configuration:** https://www.promptfoo.dev/docs/configuration

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2025-12-10 | Initial specification |
| | | 4 assertion categories |
| | | 58 test cases total |
| | | Progressive scoring system |

---

**Last Updated:** 2025-12-10
**Status:** Specification Complete
**Ready for:** Testing and Validation
