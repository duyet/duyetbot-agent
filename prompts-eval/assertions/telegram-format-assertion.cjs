/**
 * Custom assertion for Telegram format validation
 *
 * Validates that LLM output follows the correct format based on outputFormat:
 * - telegram-html: Must use HTML tags, no markdown
 * - telegram-markdown: Must use MarkdownV2, no HTML tags
 *
 * Scoring:
 * - 1.0: Perfect format compliance
 * - 0.7-0.9: Minor issues (warnings only)
 * - 0.3-0.6: Some format errors but content is usable
 * - 0.0-0.2: Major format violations
 *
 * Uses context.vars.outputFormat to determine which format to validate.
 */
module.exports = (output, context) => {
  const outputFormat = context.vars?.outputFormat || 'telegram-html';
  const errors = [];
  const warnings = [];

  // Skip validation for very short responses (likely simple answers like "Paris")
  if (output.trim().length < 20) {
    return {
      pass: true,
      score: 1,
      reason: `Short response - format validation skipped`
    };
  }

  if (outputFormat === 'telegram-html') {
    const result = validateTelegramHtml(output);
    errors.push(...result.errors);
    warnings.push(...result.warnings);
  } else if (outputFormat === 'telegram-markdown') {
    const result = validateTelegramMarkdown(output);
    errors.push(...result.errors);
    warnings.push(...result.warnings);
  }

  // Calculate score: start at 1, subtract for errors and warnings
  let score = 1;
  score -= errors.length * 0.25;  // Each error costs 0.25
  score -= warnings.length * 0.1; // Each warning costs 0.1
  score = Math.max(0, Math.min(1, score));

  // Pass if score >= 0.5 (allows some format issues)
  const pass = score >= 0.5;

  let reason;
  if (errors.length === 0 && warnings.length === 0) {
    reason = `Valid ${outputFormat} format`;
  } else if (errors.length === 0) {
    reason = `${outputFormat} format OK with warnings: ${warnings.join('; ')}`;
  } else {
    reason = `${outputFormat} issues: ${errors.join('; ')}${warnings.length ? ` | Warnings: ${warnings.join('; ')}` : ''}`;
  }

  return { pass, score, reason };
};

/**
 * Validate Telegram HTML format
 * @see https://core.telegram.org/bots/api#html-style
 */
function validateTelegramHtml(output) {
  const errors = [];
  const warnings = [];

  // Check for forbidden markdown syntax - be more lenient
  // Count occurrences to detect actual bold markers (** at both ends)
  const boldMatches = output.match(/\*\*[^*]+\*\*/g);
  if (boldMatches && boldMatches.length > 0) {
    errors.push('Contains markdown **bold** syntax (use <b> instead)');
  }

  const underlineMatches = output.match(/__[^_]+__/g);
  if (underlineMatches && underlineMatches.length > 0) {
    errors.push('Contains markdown __underline__ syntax (use <u> instead)');
  }

  // Only flag triple backticks as error for code blocks (not single backticks)
  if (/```[\s\S]*?```/.test(output)) {
    errors.push('Contains markdown code block ``` (use <pre> instead)');
  }

  // Check for markdown links [text](url) - but be more lenient
  // Only flag if it looks like actual markdown links (not just text with brackets and parens)
  const markdownLinkPattern = /\[[^\]]+\]\([^)]+\)/;
  if (markdownLinkPattern.test(output)) {
    // Check if there are actual HTML links as alternative
    if (!/<a\s+href=/.test(output)) {
      warnings.push('Contains markdown [link](url) syntax (consider <a href="url">text</a>)');
    }
  }

  // Validate HTML tags are properly closed (but be lenient with single tags like <br>)
  const htmlTags = ['b', 'i', 'u', 's', 'code', 'pre', 'a', 'blockquote', 'tg-spoiler'];
  for (const tag of htmlTags) {
    const openCount = (output.match(new RegExp(`<${tag}[^>]*>`, 'gi')) || []).length;
    const closeCount = (output.match(new RegExp(`</${tag}>`, 'gi')) || []).length;
    // Only error if there's a significant mismatch (more than 2 unclosed tags)
    if (Math.abs(openCount - closeCount) > 1) {
      errors.push(`Unclosed <${tag}> tag (${openCount} open, ${closeCount} close)`);
    }
  }

  // Check for unescaped special characters - be less strict
  const textContent = output.replace(/<[^>]+>/g, '');
  // Only warn if there are multiple unescaped characters
  const unescapedLt = (textContent.match(/</g) || []).length - (textContent.match(/&lt;/g) || []).length;
  const unescapedGt = (textContent.match(/>/g) || []).length - (textContent.match(/&gt;/g) || []).length;

  if (unescapedLt > 1) {
    warnings.push('Multiple unescaped < in text (should be &lt;)');
  }
  if (unescapedGt > 1) {
    warnings.push('Multiple unescaped > in text (should be &gt;)');
  }

  return { errors, warnings };
}

/**
 * Validate Telegram MarkdownV2 format
 * @see https://core.telegram.org/bots/api#markdownv2-style
 */
function validateTelegramMarkdown(output) {
  const errors = [];
  const warnings = [];

  // Check for forbidden HTML tags - only error on actual HTML tags, not angle brackets
  const htmlTagPattern = /<(b|i|u|s|code|pre|a|blockquote|tg-spoiler)[^>]*>/i;
  if (htmlTagPattern.test(output)) {
    const match = output.match(htmlTagPattern);
    errors.push(`Contains HTML <${match[1]}> tag (use MarkdownV2 syntax instead)`);
  }

  // Check for incorrectly placed markers in links - but be lenient
  // Wrong: [*text*](url) - markers inside brackets
  // Correct: *[text](url)* - markers outside
  if (/\[\*[^\]]+\*\]\(/.test(output)) {
    warnings.push('Bold markers inside link brackets [*text*](url) - better: *[text](url)*');
  }
  if (/\[_[^\]]+_\]\(/.test(output)) {
    warnings.push('Italic markers inside link brackets [_text_](url) - better: _[text](url)_');
  }
  if (/\[__[^\]]+__\]\(/.test(output)) {
    warnings.push('Underline markers inside link brackets [__text__](url) - better: __[text](url)__');
  }

  // Check for manual escaping - only error if it's excessive (multiple patterns)
  const escapePatterns = output.match(/\\[._\-\[\]()~`>#+=|{}!]/g) || [];
  if (escapePatterns.length > 5) {
    errors.push('Contains excessive manual escaping - transport layer handles escaping');
  } else if (escapePatterns.length > 0) {
    warnings.push('Contains some manual escaping - transport layer handles escaping');
  }

  // Check for unclosed formatting markers - be more lenient
  const singleAsterisk = (output.match(/(?<![*\\])\*(?![*])/g) || []).length;
  if (singleAsterisk % 2 !== 0 && singleAsterisk > 2) {
    warnings.push('Odd number of * markers - may have unclosed bold');
  }

  const singleUnderscore = (output.match(/(?<![_\\])_(?![_])/g) || []).length;
  if (singleUnderscore % 2 !== 0 && singleUnderscore > 2) {
    warnings.push('Odd number of _ markers - may have unclosed italic');
  }

  // Code blocks without language identifier - only warn if there are multiple blocks
  const codeBlockCount = (output.match(/```/g) || []).length / 2;
  if (codeBlockCount > 0 && /```\s*\n/.test(output)) {
    if (codeBlockCount > 1) {
      warnings.push('Some code blocks missing language identifier (recommend ```python, ```typescript, etc.)');
    }
  }

  return { errors, warnings };
}
