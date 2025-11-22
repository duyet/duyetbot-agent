/**
 * Template Loader
 *
 * Simple template engine for rendering text templates
 * Templates are inlined for Cloudflare Workers compatibility
 */

// Inlined templates for Workers compatibility
const TEMPLATES: Record<string, string> = {
  'system-prompt.txt': `You are @duyetbot, an AI assistant helping with GitHub tasks.

## Repository
- Name: {{repository.full_name}}

{{#if pullRequest}}
## Pull Request #{{pullRequest.number}}
- Title: {{pullRequest.title}}
- State: {{pullRequest.state}}
- Author: @{{pullRequest.user.login}}
- Base: {{pullRequest.base.ref}} <- Head: {{pullRequest.head.ref}}
- Changes: +{{pullRequest.additions}} -{{pullRequest.deletions}} ({{pullRequest.changed_files}} files)
{{#if pullRequest.body}}

### Description
{{pullRequest.body}}
{{/if}}
{{/if}}

{{#if issue}}
## Issue #{{issue.number}}
- Title: {{issue.title}}
- State: {{issue.state}}
- Author: @{{issue.user.login}}
{{#if issue.labels}}
- Labels: {{issue.labelsString}}
{{/if}}
{{#if issue.body}}

### Description
{{issue.body}}
{{/if}}
{{/if}}

{{#if enhancedContext}}
## Additional Context
{{enhancedContext}}
{{/if}}

## Task from @{{mentionedBy.login}}
{{task}}

## Available Tools
You have access to the following tools:

- **post_comment**: Post a comment to the issue/PR. Use this to respond to the user with your analysis or answer.
- **add_reaction**: Add a reaction emoji (eyes, rocket, +1, heart, hooray, laugh, confused) to the triggering comment.
- **get_issue_context**: Get detailed context including all comments, labels, and for PRs: diff, files, commits, and reviews.

## Instructions
1. Analyze the user's request and the provided context
2. If you need more information, use the get_issue_context tool
3. Formulate your response
4. Use the post_comment tool to post your response to the issue/PR
5. Optionally add a reaction to acknowledge the request

## Guidelines
- Provide clear, actionable responses
- Use GitHub-flavored Markdown for formatting
- Reference specific files, lines, or commits when relevant
- If you need more information, ask clarifying questions
- Be concise but thorough
`,
};

/**
 * Load template from inlined templates
 */
export function loadTemplate(templateName: string): string {
  const template = TEMPLATES[templateName];
  if (!template) {
    throw new Error(`Template not found: ${templateName}`);
  }
  return template;
}

/**
 * Get nested property from object using dot notation
 */
function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce((current: unknown, key: string) => {
    if (current && typeof current === 'object') {
      return (current as Record<string, unknown>)[key];
    }
    return undefined;
  }, obj);
}

/**
 * Render template with context data
 * Supports:
 * - {{variable}} - Simple variable substitution
 * - {{nested.path}} - Nested property access
 * - {{#if variable}}...{{/if}} - Conditional blocks
 */
export function renderTemplate(template: string, context: Record<string, unknown>): string {
  let result = template;

  // Process conditional blocks {{#if variable}}...{{/if}}
  // Process one at a time to handle sequential blocks correctly
  const ifRegex = /\{\{#if\s+(\S+)\}\}([\s\S]*?)\{\{\/if\}\}/;
  let match = ifRegex.exec(result);
  while (match !== null) {
    const condition = match[1];
    const content = match[2];
    const value = getNestedValue(context, condition);
    const replacement = value ? content : '';
    result =
      result.slice(0, match.index) + replacement + result.slice(match.index + match[0].length);
    match = ifRegex.exec(result);
  }

  // Process simple variable substitution {{variable}}
  const varRegex = /\{\{(\S+?)\}\}/g;
  result = result.replace(varRegex, (_match, varPath: string) => {
    const value = getNestedValue(context, varPath);
    if (value !== undefined && value !== null) {
      return String(value);
    }
    return '';
  });

  // Clean up extra blank lines (more than 2 consecutive)
  result = result.replace(/\n{3,}/g, '\n\n');

  return result.trim();
}

/**
 * Load and render template in one call
 */
export function loadAndRenderTemplate(
  templateName: string,
  context: Record<string, unknown>
): string {
  const template = loadTemplate(templateName);
  return renderTemplate(template, context);
}
