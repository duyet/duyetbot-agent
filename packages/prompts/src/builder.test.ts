import { describe, expect, it } from 'vitest';
import { getDuyetInfoPrompt, getRouterPrompt, getSimpleAgentPrompt } from './agents/index.js';
import { createPrompt, PromptBuilder } from './builder.js';
import { getGitHubBotPrompt, getTelegramPrompt } from './platforms/index.js';
import { guidelinesSection } from './sections/index.js';

describe('PromptBuilder', () => {
  describe('createPrompt factory', () => {
    it('should create a builder with default config', () => {
      const builder = createPrompt();
      expect(builder).toBeInstanceOf(PromptBuilder);
    });

    it('should create a builder with custom config', () => {
      const builder = createPrompt({
        botName: '@testbot',
        creator: 'Test Creator',
      });
      const config = builder.getConfig();
      expect(config.botName).toBe('@testbot');
      expect(config.creator).toBe('Test Creator');
    });
  });

  describe('section methods', () => {
    it('should add identity section', () => {
      const prompt = createPrompt({
        botName: '@testbot',
        creator: 'Test Creator',
      })
        .withIdentity()
        .build();

      expect(prompt).toContain('@testbot');
      expect(prompt).toContain('Test Creator');
    });

    it('should add policy section', () => {
      const prompt = createPrompt().withPolicy().build();

      expect(prompt).toContain('<policy>');
      expect(prompt).toContain('Do not provide assistance');
    });

    it('should add capabilities section', () => {
      const prompt = createPrompt().withCapabilities(['Answer questions', 'Write code']).build();

      expect(prompt).toContain('<capabilities>');
      expect(prompt).toContain('Answer questions');
      expect(prompt).toContain('Write code');
    });

    it('should skip empty capabilities', () => {
      const prompt = createPrompt().withCapabilities([]).build();
      expect(prompt).not.toContain('<capabilities>');
    });

    it('should add tools section', () => {
      const prompt = createPrompt()
        .withTools([
          { name: 'search', description: 'Web search' },
          { name: 'code', description: 'Execute code' },
        ])
        .build();

      expect(prompt).toContain('<tools>');
      expect(prompt).toContain('search: Web search');
      expect(prompt).toContain('code: Execute code');
    });

    it('should add guidelines section', () => {
      const prompt = createPrompt().withGuidelines().build();
      expect(prompt).toContain('<response_guidelines>');
    });

    it('should add coding standards section', () => {
      const prompt = createPrompt().withCodingStandards().build();
      expect(prompt).toContain('<coding_standards>');
    });

    it('should add history context section', () => {
      const prompt = createPrompt().withHistoryContext().build();
      expect(prompt).toContain('<history_context>');
    });

    it('should add custom sections', () => {
      const prompt = createPrompt().withCustomSection('custom', 'Custom content here').build();

      expect(prompt).toContain('<custom>');
      expect(prompt).toContain('Custom content here');
      expect(prompt).toContain('</custom>');
    });

    it('should add raw content', () => {
      const prompt = createPrompt().withRaw('Raw content without wrapping').build();
      expect(prompt).toContain('Raw content without wrapping');
    });
  });

  describe('platform methods', () => {
    it('should set telegram platform', () => {
      const prompt = createPrompt().forTelegram().build();
      expect(prompt).toContain('<platform>telegram</platform>');
    });

    it('should set github platform', () => {
      const prompt = createPrompt().forGitHub().build();
      expect(prompt).toContain('<platform>github</platform>');
    });

    it('should set api platform', () => {
      const prompt = createPrompt().forAPI().build();
      expect(prompt).toContain('<platform>api</platform>');
    });

    it('should set cli platform', () => {
      const prompt = createPrompt().forCLI().build();
      expect(prompt).toContain('<platform>cli</platform>');
    });

    it('should set platform directly', () => {
      const prompt = createPrompt().forPlatform('telegram').build();
      expect(prompt).toContain('<platform>telegram</platform>');
    });
  });

  describe('method chaining', () => {
    it('should support full chain', () => {
      const prompt = createPrompt({ botName: '@duyetbot' })
        .withIdentity()
        .withPolicy()
        .withCapabilities(['Answering questions'])
        .withTools([{ name: 'search', description: 'Search the web' }])
        .withGuidelines()
        .withCodingStandards()
        .withHistoryContext()
        .forTelegram()
        .build();

      expect(prompt).toContain('@duyetbot');
      expect(prompt).toContain('<policy>');
      expect(prompt).toContain('<capabilities>');
      expect(prompt).toContain('<tools>');
      expect(prompt).toContain('<response_guidelines>');
      expect(prompt).toContain('<coding_standards>');
      expect(prompt).toContain('<history_context>');
      expect(prompt).toContain('<platform>telegram</platform>');
    });
  });
});

describe('Agent Prompts', () => {
  describe('getSimpleAgentPrompt', () => {
    it('should return a valid prompt', () => {
      const prompt = getSimpleAgentPrompt();

      expect(prompt).toContain('@duyetbot');
      expect(prompt).toContain('<policy>');
      expect(prompt).toContain('<capabilities>');
    });

    it('should accept custom config', () => {
      const prompt = getSimpleAgentPrompt({ botName: '@custom' });
      expect(prompt).toContain('@custom');
    });
  });

  describe('getRouterPrompt', () => {
    it('should return classification instructions', () => {
      const prompt = getRouterPrompt();

      expect(prompt).toContain('query classifier');
      expect(prompt).toContain('type');
      expect(prompt).toContain('category');
      expect(prompt).toContain('complexity');
      expect(prompt).toContain('requiresHumanApproval');
    });
  });

  describe('getDuyetInfoPrompt', () => {
    it('should return Duyet-specific prompt', () => {
      const prompt = getDuyetInfoPrompt();

      expect(prompt).toContain('blog');
      expect(prompt).toContain('CV');
      expect(prompt).toContain('MCP');
    });
  });
});

describe('Platform Prompts', () => {
  describe('getTelegramPrompt', () => {
    it('should return telegram-optimized prompt', () => {
      const prompt = getTelegramPrompt();

      expect(prompt).toContain('@duyetbot');
      expect(prompt).toContain('<platform>telegram</platform>');
      expect(prompt).toContain('concise');
    });
  });

  describe('getGitHubBotPrompt', () => {
    it('should return github-optimized prompt', () => {
      const prompt = getGitHubBotPrompt();

      expect(prompt).toContain('<platform>github</platform>');
      expect(prompt).toContain('GitHub');
      expect(prompt).toContain('code');
    });
  });
});

describe('Getter Functions', () => {
  it('getTelegramPrompt should return a valid prompt', () => {
    const prompt = getTelegramPrompt();
    expect(prompt).toBeDefined();
    expect(typeof prompt).toBe('string');
    expect(prompt.length).toBeGreaterThan(100);
  });

  it('getGitHubBotPrompt should return a valid prompt', () => {
    const prompt = getGitHubBotPrompt();
    expect(prompt).toBeDefined();
    expect(typeof prompt).toBe('string');
    expect(prompt.length).toBeGreaterThan(100);
  });

  it('getSimpleAgentPrompt should return a valid prompt', () => {
    const prompt = getSimpleAgentPrompt();
    expect(prompt).toBeDefined();
    expect(typeof prompt).toBe('string');
    expect(prompt.length).toBeGreaterThan(100);
  });

  it('getter functions should return consistent results', () => {
    expect(getTelegramPrompt()).toBe(getTelegramPrompt());
    expect(getGitHubBotPrompt()).toBe(getGitHubBotPrompt());
    expect(getSimpleAgentPrompt()).toBe(getSimpleAgentPrompt());
  });
});

describe('OutputFormat', () => {
  describe('withOutputFormat', () => {
    it('should set telegram-html format with correct guidelines', () => {
      const prompt = createPrompt().withOutputFormat('telegram-html').withGuidelines().build();

      expect(prompt).toContain('<platform>telegram</platform>');
      expect(prompt).toContain('<b>bold</b>');
      expect(prompt).toContain('Escape these characters');
      // HTML mode should not contain MarkdownV2 syntax indicator
      expect(prompt).not.toContain('MarkdownV2');
    });

    it('should set telegram-markdown format with correct guidelines', () => {
      const prompt = createPrompt().withOutputFormat('telegram-markdown').withGuidelines().build();

      expect(prompt).toContain('<platform>telegram</platform>');
      expect(prompt).toContain('*bold*');
      expect(prompt).toContain('MarkdownV2');
      expect(prompt).not.toContain('<b>bold</b>');
    });

    it('should set github-markdown format with correct guidelines', () => {
      const prompt = createPrompt().withOutputFormat('github-markdown').withGuidelines().build();

      expect(prompt).toContain('<platform>github</platform>');
      expect(prompt).toContain('GitHub-flavored markdown');
    });

    it('should set plain format with no platform-specific guidelines', () => {
      const prompt = createPrompt().withOutputFormat('plain').withGuidelines().build();

      expect(prompt).not.toContain('<platform>');
      expect(prompt).not.toContain('<b>bold</b>');
      expect(prompt).not.toContain('*bold*');
      expect(prompt).toContain('<response_guidelines>');
    });
  });

  describe('guidelinesSection', () => {
    it('should return HTML guidelines for telegram-html', () => {
      const section = guidelinesSection('telegram-html');

      expect(section).toContain('<b>bold</b>');
      expect(section).toContain('&lt;');
      expect(section).toContain('Keep responses concise');
    });

    it('should return MarkdownV2 guidelines for telegram-markdown', () => {
      const section = guidelinesSection('telegram-markdown');

      expect(section).toContain('*bold*');
      expect(section).toContain('MarkdownV2');
      expect(section).toContain('Keep responses concise');
    });

    it('should return GitHub guidelines for github-markdown', () => {
      const section = guidelinesSection('github-markdown');

      expect(section).toContain('GitHub-flavored markdown');
      expect(section).toContain('code blocks with syntax highlighting');
    });

    it('should return base guidelines only for plain', () => {
      const section = guidelinesSection('plain');

      expect(section).toContain('Be direct and concise');
      expect(section).not.toContain('<b>bold</b>');
      expect(section).not.toContain('GitHub-flavored');
    });

    it('should return base guidelines when no format specified', () => {
      const section = guidelinesSection();

      expect(section).toContain('Be direct and concise');
      expect(section).not.toContain('<b>bold</b>');
    });
  });

  describe('getTelegramPrompt with outputFormat', () => {
    it('should default to telegram-html format', () => {
      const prompt = getTelegramPrompt();

      expect(prompt).toContain('<b>bold</b>');
      expect(prompt).toContain('Escape these characters');
    });

    it('should accept telegram-html format explicitly', () => {
      const prompt = getTelegramPrompt({ outputFormat: 'telegram-html' });

      expect(prompt).toContain('<b>bold</b>');
      // HTML mode should not contain MarkdownV2 syntax indicator
      expect(prompt).not.toContain('MarkdownV2');
    });

    it('should accept telegram-markdown format', () => {
      const prompt = getTelegramPrompt({ outputFormat: 'telegram-markdown' });

      expect(prompt).toContain('*bold*');
      expect(prompt).toContain('MarkdownV2');
      expect(prompt).not.toContain('<b>bold</b>');
    });
  });

  describe('agent prompts with outputFormat', () => {
    it('getSimpleAgentPrompt should apply outputFormat', () => {
      const prompt = getSimpleAgentPrompt({ outputFormat: 'telegram-html' });

      expect(prompt).toContain('<platform>telegram</platform>');
      expect(prompt).toContain('<b>bold</b>');
    });

    it('getDuyetInfoPrompt should apply outputFormat', () => {
      const prompt = getDuyetInfoPrompt({ outputFormat: 'github-markdown' });

      expect(prompt).toContain('<platform>github</platform>');
      expect(prompt).toContain('GitHub-flavored markdown');
    });
  });
});
