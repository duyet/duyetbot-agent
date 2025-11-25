import { describe, expect, it } from 'vitest';
import { getDuyetInfoPrompt, getRouterPrompt, getSimpleAgentPrompt } from './agents/index.js';
import { PromptBuilder, createPrompt } from './builder.js';
import { getGitHubBotPrompt, getTelegramPrompt } from './platforms/index.js';

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
