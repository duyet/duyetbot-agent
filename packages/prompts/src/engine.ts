/**
 * Simple template engine compatible with Cloudflare Workers
 *
 * Supports a subset of Jinja2/Nunjucks syntax without using eval:
 * - Variable binding: {{ botName }}
 * - Conditionals: {% if hasTools %} ... {% endif %}
 * - Loops: {% for tool in tools %} ... {% endfor %}
 * - Includes: {% include 'partials/policy.md' %}
 */

import agentPrompt from '../prompts/agent.md';
import defaultPrompt from '../prompts/default.md';
import githubPrompt from '../prompts/github.md';
import codingStandardsPartial from '../prompts/partials/coding-standards.md';
import guidelinesPartial from '../prompts/partials/guidelines.md';
import historyContextPartial from '../prompts/partials/history-context.md';
import policyPartial from '../prompts/partials/policy.md';
import telegramPrompt from '../prompts/telegram.md';

// Template registry
const templates: Record<string, string> = {
  'default.md': defaultPrompt,
  'agent.md': agentPrompt,
  'github.md': githubPrompt,
  'telegram.md': telegramPrompt,
  'partials/policy.md': policyPartial,
  'partials/guidelines.md': guidelinesPartial,
  'partials/coding-standards.md': codingStandardsPartial,
  'partials/history-context.md': historyContextPartial,
};

export interface TemplateContext {
  botName?: string;
  creator?: string;
  tools?: string[];
  hasTools?: boolean;
  platform?: string;
  [key: string]: unknown;
}

/**
 * Get a value from context using dot notation (e.g., "user.name")
 */
function getValue(context: TemplateContext, path: string): unknown {
  const parts = path.trim().split('.');
  let value: unknown = context;

  for (const part of parts) {
    if (value === null || value === undefined) {
      return undefined;
    }
    value = (value as Record<string, unknown>)[part];
  }

  return value;
}

/**
 * Evaluate a simple condition expression
 * Supports: variable, variable.property, array.length > 0, and, or
 */
function evaluateCondition(condition: string, context: TemplateContext): boolean {
  const trimmed = condition.trim();

  // Handle "and" operator
  if (trimmed.includes(' and ')) {
    const parts = trimmed.split(' and ');
    return parts.every((part) => evaluateCondition(part, context));
  }

  // Handle "or" operator
  if (trimmed.includes(' or ')) {
    const parts = trimmed.split(' or ');
    return parts.some((part) => evaluateCondition(part, context));
  }

  // Handle comparison: array.length > 0
  const compMatch = trimmed.match(/^(.+?)\s*(>|<|>=|<=|==|!=)\s*(.+)$/);
  if (compMatch?.[1] && compMatch[2] && compMatch[3]) {
    const left = getValue(context, compMatch[1]);
    const operator = compMatch[2];
    const right = compMatch[3].trim();

    // Parse right side as number if possible
    const rightValue = /^\d+$/.test(right) ? Number(right) : getValue(context, right);

    switch (operator) {
      case '>':
        return Number(left) > Number(rightValue);
      case '<':
        return Number(left) < Number(rightValue);
      case '>=':
        return Number(left) >= Number(rightValue);
      case '<=':
        return Number(left) <= Number(rightValue);
      case '==':
        return left === rightValue;
      case '!=':
        return left !== rightValue;
    }
  }

  // Handle simple truthy check
  const value = getValue(context, trimmed);
  if (Array.isArray(value)) {
    return value.length > 0;
  }
  return Boolean(value);
}

/**
 * Process includes in template
 */
function processIncludes(template: string): string {
  const includePattern = /\{%\s*include\s+['"]([^'"]+)['"]\s*%\}/g;

  return template.replace(includePattern, (_, templateName) => {
    const included = templates[templateName];
    if (!included) {
      throw new Error(`Template not found: ${templateName}`);
    }
    // Recursively process includes in included template
    return processIncludes(included);
  });
}

/**
 * Process for loops
 */
function processLoops(template: string, context: TemplateContext): string {
  const forPattern = /\{%\s*for\s+(\w+)\s+in\s+(\w+(?:\.\w+)*)\s*%\}([\s\S]*?)\{%\s*endfor\s*%\}/g;

  return template.replace(forPattern, (_, itemName, arrayPath, loopContent) => {
    const array = getValue(context, arrayPath);
    if (!Array.isArray(array)) {
      return '';
    }

    return array
      .map((item) => {
        // Create new context with loop variable
        const loopContext = { ...context, [itemName]: item };
        return processVariables(loopContent, loopContext);
      })
      .join('');
  });
}

/**
 * Process conditionals (if/endif)
 */
function processConditionals(template: string, context: TemplateContext): string {
  // Handle if/else/endif
  const ifElsePattern =
    /\{%\s*if\s+(.+?)\s*%\}([\s\S]*?)\{%\s*else\s*%\}([\s\S]*?)\{%\s*endif\s*%\}/g;
  const result = template.replace(ifElsePattern, (_, condition, ifContent, elseContent) => {
    return evaluateCondition(condition, context) ? ifContent : elseContent;
  });

  // Handle simple if/endif (no else)
  const ifPattern = /\{%\s*if\s+(.+?)\s*%\}([\s\S]*?)\{%\s*endif\s*%\}/g;
  return result.replace(ifPattern, (_, condition, content) => {
    return evaluateCondition(condition, context) ? content : '';
  });
}

/**
 * Process variable interpolation
 */
function processVariables(template: string, context: TemplateContext): string {
  const varPattern = /\{\{\s*(.+?)\s*\}\}/g;

  return template.replace(varPattern, (_, expression) => {
    // Handle filters like {{ value | default('fallback') }}
    if (expression.includes('|')) {
      const [varPart, filterPart] = expression.split('|').map((s: string) => s.trim());
      const value = getValue(context, varPart);

      // Handle default filter
      const defaultMatch = filterPart.match(/default\s*\(\s*['"]([^'"]*)['"]\s*\)/);
      if (defaultMatch) {
        return value ?? defaultMatch[1];
      }

      return String(value ?? '');
    }

    const value = getValue(context, expression);
    if (value === undefined || value === null) {
      return '';
    }
    return String(value);
  });
}

/**
 * Render a template file with the given context
 */
export function renderTemplate(templateName: string, context: TemplateContext = {}): string {
  const template = templates[templateName];
  if (!template) {
    throw new Error(`Template not found: ${templateName}`);
  }

  return renderString(template, context);
}

/**
 * Render a template string directly
 */
export function renderString(template: string, context: TemplateContext = {}): string {
  // Process in order: includes -> loops -> conditionals -> variables
  let result = processIncludes(template);
  result = processLoops(result, context);
  result = processConditionals(result, context);
  result = processVariables(result, context);

  return result.trim();
}

/**
 * Add a template to the registry
 */
export function addTemplate(name: string, content: string): void {
  templates[name] = content;
}

/**
 * Get all template names
 */
export function getTemplateNames(): string[] {
  return Object.keys(templates);
}
