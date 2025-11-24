import { describe, expect, it } from 'vitest';
import { addFilter, renderString, renderTemplate } from './engine.js';

describe('Template Engine', () => {
  describe('renderString', () => {
    it('should render simple variables', () => {
      const result = renderString('Hello {{ name }}!', { name: 'World' });
      expect(result).toBe('Hello World!');
    });

    it('should render multiple variables', () => {
      const result = renderString('{{ greeting }}, {{ name }}!', {
        greeting: 'Hello',
        name: 'duyetbot',
      });
      expect(result).toBe('Hello, duyetbot!');
    });

    it('should handle conditionals', () => {
      const template = '{% if showGreeting %}Hello{% endif %}';

      expect(renderString(template, { showGreeting: true })).toBe('Hello');
      expect(renderString(template, { showGreeting: false })).toBe('');
    });

    it('should handle if-else', () => {
      const template = '{% if isAdmin %}Admin{% else %}User{% endif %}';

      expect(renderString(template, { isAdmin: true })).toBe('Admin');
      expect(renderString(template, { isAdmin: false })).toBe('User');
    });

    it('should handle loops', () => {
      const template = '{% for item in items %}{{ item }}{% endfor %}';
      const result = renderString(template, { items: ['a', 'b', 'c'] });
      expect(result).toBe('abc');
    });

    it('should handle loop with index', () => {
      const template = '{% for item in items %}{{ loop.index }}: {{ item }}\n{% endfor %}';
      const result = renderString(template, { items: ['first', 'second'] });
      expect(result).toContain('1: first');
      expect(result).toContain('2: second');
    });

    it('should handle nested data', () => {
      const template = '{{ user.name }} ({{ user.email }})';
      const result = renderString(template, {
        user: { name: 'Duyet', email: 'duyet@example.com' },
      });
      expect(result).toBe('Duyet (duyet@example.com)');
    });

    it('should handle default filter', () => {
      const template = '{{ name | default("Guest") }}';

      expect(renderString(template, { name: 'Duyet' })).toBe('Duyet');
      expect(renderString(template, {})).toBe('Guest');
    });

    it('should handle built-in filters', () => {
      expect(renderString('{{ name | upper }}', { name: 'hello' })).toBe('HELLO');
      expect(renderString('{{ name | lower }}', { name: 'HELLO' })).toBe('hello');
      expect(renderString('{{ name | capitalize }}', { name: 'hello' })).toBe('Hello');
    });

    it('should handle array length check', () => {
      const template = '{% if tools and tools.length > 0 %}Has tools{% else %}No tools{% endif %}';

      expect(renderString(template, { tools: ['bash', 'git'] })).toBe('Has tools');
      expect(renderString(template, { tools: [] })).toBe('No tools');
      expect(renderString(template, {})).toBe('No tools');
    });

    it('should handle macros', () => {
      const template = `
{% macro greet(name) %}
Hello, {{ name }}!
{% endmacro %}
{{ greet("World") }}
      `;
      const result = renderString(template, {});
      expect(result).toContain('Hello, World!');
    });
  });

  describe('renderTemplate', () => {
    it('should render default template', () => {
      const result = renderTemplate('default.md', {
        botName: 'TestBot',
        creator: 'TestCreator',
      });

      expect(result).toContain('TestBot');
      expect(result).toContain('TestCreator');
    });

    it('should render template with tools', () => {
      const result = renderTemplate('default.md', {
        botName: 'TestBot',
        creator: 'TestCreator',
        tools: ['bash', 'git', 'research'],
      });

      expect(result).toContain('Available tools:');
      expect(result).toContain('- bash');
      expect(result).toContain('- git');
      expect(result).toContain('- research');
    });

    it('should render template without tools', () => {
      const result = renderTemplate('default.md', {
        botName: 'TestBot',
        creator: 'TestCreator',
        tools: [],
      });

      expect(result).not.toContain('Available tools:');
    });

    it('should include partials', () => {
      const result = renderTemplate('default.md', {
        botName: 'TestBot',
        creator: 'TestCreator',
      });

      // Check that partials are included
      expect(result).toContain('<policy>');
      expect(result).toContain('<guidelines>');
      expect(result).toContain('<coding_standards>');
      expect(result).toContain('<history_context>');
    });
  });

  describe('addFilter', () => {
    it('should add custom filter', () => {
      addFilter('reverse', (str: unknown) => String(str).split('').reverse().join(''));

      const result = renderString('{{ text | reverse }}', { text: 'hello' });
      expect(result).toBe('olleh');
    });
  });
});
