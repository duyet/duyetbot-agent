/**
 * Template Loader
 *
 * Simple template engine for loading and rendering text templates
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Load template from file
 */
export function loadTemplate(templateName: string): string {
  const templatePath = join(__dirname, 'templates', templateName);
  return readFileSync(templatePath, 'utf-8');
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
