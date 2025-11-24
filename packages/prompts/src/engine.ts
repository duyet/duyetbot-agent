/**
 * Nunjucks template engine wrapper for prompt rendering
 *
 * Jinja2-style syntax:
 * - Variable binding: {{ botName }}
 * - Conditionals: {% if hasTools %} ... {% endif %}
 * - Loops: {% for tool in tools %} ... {% endfor %}
 * - Includes: {% include './partials/policy.md' %}
 * - Filters: {{ name | upper }}
 * - Macros: {% macro input(name) %} ... {% endmacro %}
 */

import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import nunjucks from 'nunjucks';

// Get the directory of this module
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configure Nunjucks
const templatesPath = join(__dirname, '../prompts');
const env = nunjucks.configure(templatesPath, {
  autoescape: false, // Keep raw markdown
  trimBlocks: true, // Remove newline after block tags
  lstripBlocks: true, // Strip leading whitespace from block tags
  noCache: process.env.NODE_ENV === 'development',
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
  return nunjucks.compile(templateName, env);
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
