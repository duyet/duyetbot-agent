/**
 * Template Loader Tests
 */

import { describe, expect, it } from 'vitest';
import { loadTemplate, renderTemplate } from '../template-loader.js';

describe('loadTemplate', () => {
  it('should load system-prompt.txt template', () => {
    const template = loadTemplate('system-prompt.txt');
    expect(template).toContain('@duyetbot');
    expect(template).toContain('{{repository.full_name}}');
    expect(template).toContain('{{task}}');
  });
});

describe('renderTemplate', () => {
  it('should substitute simple variables', () => {
    const template = 'Hello {{name}}!';
    const result = renderTemplate(template, { name: 'World' });
    expect(result).toBe('Hello World!');
  });

  it('should handle nested properties', () => {
    const template = 'Repo: {{repository.full_name}}';
    const result = renderTemplate(template, {
      repository: { full_name: 'duyet/test' },
    });
    expect(result).toBe('Repo: duyet/test');
  });

  it('should handle conditional blocks', () => {
    const template = '{{#if showExtra}}Extra content{{/if}}';

    const withExtra = renderTemplate(template, { showExtra: true });
    expect(withExtra).toBe('Extra content');

    const withoutExtra = renderTemplate(template, { showExtra: false });
    expect(withoutExtra).toBe('');
  });

  it('should handle conditionals with object values', () => {
    const template = '{{#if user}}Hello {{user.name}}{{/if}}';

    const withUser = renderTemplate(template, { user: { name: 'Duyet' } });
    expect(withUser).toBe('Hello Duyet');

    const withoutUser = renderTemplate(template, {});
    expect(withoutUser).toBe('');
  });

  it('should handle missing variables gracefully', () => {
    const template = 'Hello {{name}}!';
    const result = renderTemplate(template, {});
    expect(result).toBe('Hello !');
  });

  it('should render complex template with multiple features', () => {
    const template = `
# {{title}}
{{#if description}}
Description: {{description}}
{{/if}}
Author: {{author.name}}
`;

    const result = renderTemplate(template, {
      title: 'Test',
      description: 'A test item',
      author: { name: 'Duyet' },
    });

    expect(result).toContain('# Test');
    expect(result).toContain('Description: A test item');
    expect(result).toContain('Author: Duyet');
  });

  it('should clean up excessive blank lines', () => {
    const template = 'Line 1\n\n\n\nLine 2';
    const result = renderTemplate(template, {});
    expect(result).toBe('Line 1\n\nLine 2');
  });
});
