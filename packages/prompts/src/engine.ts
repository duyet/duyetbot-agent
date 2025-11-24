/**
 * Nunjucks template engine wrapper for prompt rendering
 *
 * Jinja2-style syntax:
 * - Variable binding: {{ botName }}
 * - Conditionals: {% if hasTools %} ... {% endif %}
 * - Loops: {% for tool in tools %} ... {% endfor %}
 * - Includes: {% include 'partials/policy.md' %}
 * - Filters: {{ name | upper }}
 * - Macros: {% macro input(name) %} ... {% endmacro %}
 */

import nunjucks from 'nunjucks';

import agentPrompt from '../prompts/agent.md';
// Import templates as strings (bundled at build time)
import defaultPrompt from '../prompts/default.md';
import githubPrompt from '../prompts/github.md';
import codingStandardsPartial from '../prompts/partials/coding-standards.md';
import guidelinesPartial from '../prompts/partials/guidelines.md';
import historyContextPartial from '../prompts/partials/history-context.md';
import policyPartial from '../prompts/partials/policy.md';
import telegramPrompt from '../prompts/telegram.md';

// Template registry for Workers compatibility (no filesystem access)
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

// Custom loader for bundled templates
class BundledLoader extends nunjucks.Loader {
  getSource(name: string) {
    const src = templates[name];
    if (!src) {
      throw new Error(`Template not found: ${name}`);
    }
    return {
      src,
      path: name,
      noCache: false,
    };
  }
}

// Configure Nunjucks with bundled loader
const env = new nunjucks.Environment(new BundledLoader(), {
  autoescape: false, // Keep raw markdown
  trimBlocks: true, // Remove newline after block tags
  lstripBlocks: true, // Strip leading whitespace from block tags
});

// Add custom filters
env.addFilter('default', (value: unknown, defaultValue: unknown) => {
  return value ?? defaultValue;
});

export interface TemplateContext {
  botName?: string;
  creator?: string;
  tools?: string[];
  hasTools?: boolean;
  platform?: string;
  [key: string]: unknown;
}

/**
 * Render a template file with the given context
 */
export function renderTemplate(templateName: string, context: TemplateContext = {}): string {
  return env.render(templateName, context).trim();
}

/**
 * Render a template string directly (not from file)
 */
export function renderString(template: string, context: TemplateContext = {}): string {
  return env.renderString(template, context).trim();
}

/**
 * Pre-compile a template for better performance
 */
export function compileTemplate(templateName: string) {
  return nunjucks.compile(templates[templateName] || templateName, env);
}

/**
 * Add a custom filter to the environment
 */
export function addFilter(name: string, fn: (...args: unknown[]) => unknown): void {
  env.addFilter(name, fn);
}

/**
 * Add a global variable or function
 */
export function addGlobal(name: string, value: unknown): void {
  env.addGlobal(name, value);
}

export { env, nunjucks };
