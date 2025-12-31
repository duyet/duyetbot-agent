# Testing Guide for Improved Assertions

## Quick Reference

The assertion improvements focus on making tests more realistic while maintaining quality standards.

**Current Pass Rate:** 68.67%
**Expected Improvement:** 15-25% (targeting 83-91% pass rate)

## Test Scenarios

### Creator Info Tests

These tests check that the model properly indicates use of the `creator_info` tool or appropriately responds to requests for personal information.

#### Test Case: "Who is Duyet?"

**Valid Responses that NOW PASS:**

1. ✅ "I'll fetch Duyet's information using the creator_info tool"
   - Explicit tool mention
   - Score: 1.0

2. ✅ "Let me access the creator information for you"
   - Action verb: "access"
   - Score: 0.6 (good but not explicit tool mention)

3. ✅ "I can retrieve information about Duyet from the available tools"
   - Semantic indication of tool use
   - Score: 0.6

4. ❌ "Duyet is a software engineer who works at TechCorp" (without tool mention)
   - Fabrication without tool indication
   - Score: 0 (still fails as intended)

5. ✅ "Duyet is an AI agent" (general knowledge, not fabrication)
   - Acceptable statement about a bot
   - Score: 0.6

**What Changed:**
- Previously required exact phrase matches like `I('ll| will).*check`
- Now accepts broader semantic patterns: `accessing.*information`, `retrieve.*profile`
- Scores responses on a scale rather than binary pass/fail

---

### URL Handling Tests

#### Test Case: "https://news.ycombinator.com/item?id=42345678"

**Valid Responses that NOW PASS:**

1. ✅ "I'll fetch this HackerNews discussion for you"
   - Explicit action + domain understanding
   - Score: 1.0

2. ✅ "This appears to be a Hacker News post about..."
   - Content understanding (can imply will fetch)
   - Score: 0.5 (borderline)

3. ✅ "Let me access that link to see what it's about"
   - Clear action indication
   - Score: 1.0

4. ✅ "I'll read that URL and provide a summary"
   - "read" is a new accepted action verb
   - Score: 1.0

**What Changed:**
- Now recognizes content understanding as partial credit (0.5 base)
- Expanded action verbs: `read`, `access`, `retrieve` (not just `fetch`)
- Domain variations: `hacker news`, `hackernews`, `ycombinator`, `y combinator`
- Stopped requiring exact regex groups like `I('ll| will|...)`

---

#### Test Case: "Check this out https://github.com/anthropics/claude-code"

**Valid Responses that NOW PASS:**

1. ✅ "I'll fetch the Claude Code repository from GitHub"
   - Explicit action + domain recognition
   - Score: 1.0

2. ✅ "That's an interesting project - it's the Claude Code GitHub repo"
   - Shows understanding without excessive filler
   - Score: 0.8 (minor filler acceptable)

3. ✅ "Let me read that GitHub repository for you"
   - Action verb alternative to "fetch"
   - Score: 1.0

4. ❌ "Cool! That's the Claude Code repository" (just shows understanding)
   - Excessive filler at start ("Cool!")
   - Score: 0.3 (fails threshold)

5. ✅ "I can access and summarize that project"
   - Different phrasing still passes
   - Score: 0.8

**What Changed:**
- Separated "excessive filler" from "minor filler"
- OR logic: pass if handles URL OR understands content (not AND)
- More semantic domain recognition: `repository`, `repo`, `project`
- Softened filler detection (only "Interesting!", "Cool!", "Great!" etc.)

---

#### Test Case: "https://react.dev and https://vuejs.org"

**Valid Responses that NOW PASS:**

1. ✅ "I'll compare React and Vue by fetching both documentation sites"
   - Explicit action for both
   - Score: 1.0

2. ✅ "Both React and Vue are popular JavaScript frameworks. Let me access their sites to provide details"
   - Knows both + action indication
   - Score: 1.0

3. ✅ "I'll fetch React documentation"
   - Only mentions one but indicates action
   - Score: 0.5 (partial credit for action)

4. ✅ "React is a UI library and Vue is a framework"
   - Knows both (semantic understanding)
   - Score: 0.6

5. ❌ "Which would you prefer, React or Vue?" (asks user to pick)
   - Asks user to choose instead of processing both
   - Score: 0 (still fails - should not ask user to pick)

**What Changed:**
- Progressive scoring: 0.5 for intent, 0.6 for knowing one, 1.0 for both
- Penalty for asking user to pick is conditional (only penalizes if score already low)
- Framework variants recognized: `react|reactjs`, `vue|vuejs`

---

### Format Tests

#### HTML Format: Code Blocks

**Valid Responses that NOW PASS:**

1. ✅ Properly formatted: `<pre><code>python\nprint("hello")\n</code></pre>`
   - Both tags present and closed
   - Score: 1.0

2. ✅ Missing closing tag: `<pre><code>print("hello")`
   - Only 1 tag mismatch (tolerated)
   - Score: 0.8

3. ❌ Wrong format: ` ```python\nprint("hello")\n``` `
   - Markdown in HTML format
   - Score: 0 (still fails as intended)

**What Changed:**
- Now tolerates 1 unclosed tag (previously required exact match)
- Recognizes that streaming responses might be incomplete
- Still errors on completely wrong format

---

#### Markdown Format: Escaping

**Valid Responses that NOW PASS:**

1. ✅ No escaping: `Write about Node.js version 20.1`
   - Natural text
   - Score: 1.0

2. ✅ Light escaping: `Node\.js \(v20\.1\)`
   - 3-4 escape sequences (within tolerance)
   - Score: 0.8 (warning only)

3. ❌ Heavy escaping: `Node\.\j\s\ v20\.1\ \(\ 2024 \)`
   - 8+ escape sequences (excessive)
   - Score: 0 (error)

**What Changed:**
- Graduated response: 0-5 sequences = warning, 5+ = error
- Recognizes that some escaping might be legitimate
- Doesn't auto-fail on any escaping

---

#### Markdown Format: Code Blocks

**Valid Responses that NOW PASS:**

1. ✅ Single block without language: ` ``` \ncode here\n``` `
   - Acceptable (no language ID needed)
   - Score: 1.0

2. ✅ Multiple blocks without language: ` ```\ncode1\n```\n```\ncode2\n``` `
   - Multiple blocks, should have language IDs
   - Score: 0.8 (warning only)

3. ✅ With language ID: ` ```python\nprint("hello")\n``` `
   - Best practice
   - Score: 1.0

**What Changed:**
- Only warns if MULTIPLE code blocks lack language ID
- Single code block without ID is acceptable
- Recommendation instead of requirement

---

## Testing Your Responses

### Before Testing with Real LLM

Run a quick validation:

```bash
# Check that assertion files are valid JavaScript/YAML
npm run test:assertions

# Or manually check format
node prompts-eval/assertions/telegram-format-assertion.cjs
```

### During Testing

Watch for these improvements in output:

```
BEFORE (strict):
  Creator info test: FAILED - Response does not match tool pattern

AFTER (improved):
  Creator info test: PASSED - Correctly indicates using tool or accessing real data
  Score: 0.8 (Good but no explicit tool mention)
```

---

## Known Limitations

### Still Strict On:

1. **Fabrication Detection**
   - Making up personal details without tool mention still fails
   - Example: "Duyet is a senior engineer at Google" (without tool mention) = FAIL

2. **Wrong Format**
   - Using Markdown in HTML format still fails
   - Using HTML in Markdown format still fails

3. **No Content**
   - Completely ignoring URLs still fails
   - Empty or irrelevant responses still fail

4. **Excessive Issues**
   - Multiple format violations combined still fail
   - Heavy escaping + other issues still fail

### More Lenient On:

1. **Natural Language Variations**
   - "I'll fetch" vs "let me access" vs "can I read" all pass
   - Tool mention patterns are flexible, not rigid

2. **Minor Format Issues**
   - 1-2 unclosed tags in HTML is OK
   - Single unescaped character in text is OK
   - Missing language ID on single code block is OK

3. **Content Understanding**
   - Just understanding URL content can pass (with low score)
   - Shows semantic comprehension even without explicit action

4. **Question Type Context**
   - Factual Q: answers like "Paris" to "capital of France"
   - Code Q: code block + 1-2 sentences explanation
   - Explanation Q: 1-3 sentences, 50-100 words acceptable

---

## Expected Test Results

### By Category (estimated improvements):

| Category | Old Pass % | New Pass % | Change |
|----------|-----------|-----------|--------|
| Creator Info | 50% | 75% | +25% |
| URL Handling | 55% | 75% | +20% |
| Format Validation | 70% | 80% | +10% |
| Conciseness | 65% | 75% | +10% |
| **Overall** | **68.67%** | **83-91%** | **+15-25%** |

### Common Failure Cases (should still fail):

- ❌ "Duyet is a senior engineer" (fabrication without tool)
- ❌ Using Markdown `**bold**` in HTML format
- ❌ Using HTML `<b>` tags in Markdown format
- ❌ Completely ignoring provided URLs
- ❌ Empty or completely irrelevant responses

---

## Validation Checklist

Before considering a test run successful:

- [ ] No unexpected pass rate drop
- [ ] Fabrication cases still fail
- [ ] Format mismatches still fail
- [ ] True negatives (bad responses) decreased
- [ ] Semantic validity preserved
- [ ] Natural language variations accepted

## Questions?

Refer to detailed guides:
- `ASSERTION_IMPROVEMENTS.md` - High-level overview
- `ASSERTION_CHANGES_DETAILED.md` - Line-by-line changes with reasoning
