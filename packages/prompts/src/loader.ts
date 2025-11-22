/**
 * Template loader with variable interpolation
 */

import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Get templates directory path
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const TEMPLATES_DIR = resolve(__dirname, '../templates');

/**
 * Template variable context
 */
export interface TemplateContext {
  botName?: string;
  creator?: string;
  [key: string]: string | undefined;
}

/**
 * Default template context
 */
export const defaultContext: TemplateContext = {
  botName: '@duyetbot',
  creator: 'Duyet Le',
};

/**
 * Load a template file and interpolate variables
 */
export function loadTemplate(name: string, context: TemplateContext = {}): string {
  const mergedContext = { ...defaultContext, ...context };
  const filePath = resolve(TEMPLATES_DIR, `${name}.md`);

  if (!existsSync(filePath)) {
    throw new Error(`Template not found: ${name}`);
  }

  let content = readFileSync(filePath, 'utf-8').trim();

  // Interpolate variables: {{varName}}
  content = content.replace(/\{\{(\w+)\}\}/g, (_, varName) => {
    return mergedContext[varName] || `{{${varName}}}`;
  });

  return content;
}

/**
 * Load multiple templates and join them
 */
export function loadTemplates(
  names: string[],
  context: TemplateContext = {},
  separator = '\n\n'
): string {
  return names.map((name) => loadTemplate(name, context)).join(separator);
}

/**
 * Check if a template exists
 */
export function templateExists(name: string): boolean {
  const filePath = resolve(TEMPLATES_DIR, `${name}.md`);
  return existsSync(filePath);
}

/**
 * Available template names
 */
export const templateNames = {
  // Roles
  roleAssistant: 'role-assistant',
  roleReviewer: 'role-reviewer',
  roleExplainer: 'role-explainer',
  roleResearcher: 'role-researcher',

  // Core sections
  capabilities: 'capabilities',
  creatorInfo: 'creator-info',
  codeGuidelines: 'code-guidelines',
  responseGuidelines: 'response-guidelines',

  // Channel-specific
  telegramConstraints: 'telegram-constraints',
  githubConstraints: 'github-constraints',

  // Instructions
  reviewInstructions: 'review-instructions',
  explainInstructions: 'explain-instructions',

  // Full system prompts
  systemPromptV2: 'system-prompt-v2',
} as const;

export type TemplateName = (typeof templateNames)[keyof typeof templateNames];
