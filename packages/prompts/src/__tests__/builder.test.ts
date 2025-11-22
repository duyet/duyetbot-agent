import { describe, expect, it } from 'vitest';
import {
  GitHubPromptBuilder,
  PromptBuilder,
  TelegramPromptBuilder,
  createGitHubPromptBuilder,
  createPromptBuilder,
  createTelegramPromptBuilder,
} from '../index.js';

describe('PromptBuilder', () => {
  describe('basic operations', () => {
    it('should create an empty builder', () => {
      const builder = new PromptBuilder();
      const result = builder.compile();
      expect(result).toBe('');
    });

    it('should add role section', () => {
      const builder = createPromptBuilder().addRole('assistant');
      const result = builder.compile();
      expect(result).toContain('@duyetbot');
      expect(result).toContain('Duyet Le');
    });

    it('should add capabilities', () => {
      const builder = createPromptBuilder().addCapabilities();
      const result = builder.compile();
      expect(result).toContain('help users with');
    });

    it('should add constraints', () => {
      const builder = createPromptBuilder().addConstraints(['Be concise', 'Use markdown']);
      const result = builder.compile();
      expect(result).toContain('- Be concise');
      expect(result).toContain('- Use markdown');
    });

    it('should add custom text', () => {
      const builder = createPromptBuilder().addText('custom', 'Custom content here');
      const result = builder.compile();
      expect(result).toContain('Custom content here');
    });
  });

  describe('model configuration', () => {
    it('should set model', () => {
      const builder = createPromptBuilder().withModel('haiku');
      expect(builder.getModel()).toBe('haiku');
    });

    it('should default to sonnet', () => {
      const builder = createPromptBuilder();
      expect(builder.getModel()).toBe('sonnet');
    });
  });

  describe('token estimation', () => {
    it('should estimate tokens', () => {
      const builder = createPromptBuilder().addText('test', 'Hello world');
      const tokens = builder.estimateTokens();
      expect(tokens).toBeGreaterThan(0);
    });

    it('should return compiled prompt metadata', () => {
      const builder = createPromptBuilder().addRole('assistant').addCapabilities();
      const result = builder.compileWithMetadata();
      expect(result.text).toBeTruthy();
      expect(result.tokenEstimate).toBeGreaterThan(0);
      expect(result.sections).toContain('role');
      expect(result.sections).toContain('capabilities');
    });
  });

  describe('priority and truncation', () => {
    it('should truncate optional sections when over limit', () => {
      const builder = createPromptBuilder()
        .addText('critical', 'Critical content', 'critical')
        .addText('optional', 'Optional content that should be removed', 'optional');

      const result = builder.compileWithMetadata({ maxTokens: 10 });
      expect(result.truncated).toContain('optional');
      expect(result.text).toContain('Critical content');
    });

    it('should not truncate critical sections', () => {
      const builder = createPromptBuilder().addText('critical', 'Critical content', 'critical');

      const result = builder.compileWithMetadata({ maxTokens: 1 });
      expect(result.text).toContain('Critical content');
    });
  });

  describe('clone and clear', () => {
    it('should clone builder', () => {
      const builder = createPromptBuilder().addRole('assistant').withModel('opus');
      const cloned = builder.clone();

      expect(cloned.getModel()).toBe('opus');
      expect(cloned.compile()).toBe(builder.compile());
    });

    it('should clear sections', () => {
      const builder = createPromptBuilder().addRole('assistant').clear();
      expect(builder.compile()).toBe('');
    });
  });
});

describe('TelegramPromptBuilder', () => {
  it('should create default telegram prompt', () => {
    const builder = new TelegramPromptBuilder();
    const result = builder.compile();

    expect(result).toContain('@duyetbot');
    expect(result).toContain('Telegram chat');
    expect(result).toContain('Keep responses concise');
  });

  it('should create telegram prompt via factory', () => {
    const builder = createTelegramPromptBuilder();
    const result = builder.compile();
    expect(result).toContain('Telegram chat');
  });

  it('should provide welcome message', () => {
    const message = TelegramPromptBuilder.welcomeMessage();
    expect(message).toContain('@duyetbot');
    expect(message).toContain('/help');
  });

  it('should provide help message', () => {
    const message = TelegramPromptBuilder.helpMessage();
    expect(message).toContain('/start');
    expect(message).toContain('/clear');
  });

  it('should allow model customization', () => {
    const builder = createTelegramPromptBuilder().withModel('haiku');
    expect(builder.getModel()).toBe('haiku');
  });
});

describe('GitHubPromptBuilder', () => {
  it('should create default github prompt', () => {
    const builder = new GitHubPromptBuilder();
    const result = builder.compile();

    expect(result).toContain('@duyetbot');
    expect(result).toContain('Code review');
    expect(result).toContain('GitHub-flavored markdown');
  });

  it('should create github prompt via factory', () => {
    const builder = createGitHubPromptBuilder();
    const result = builder.compile();
    expect(result).toContain('GitHub');
  });

  it('should add issue context', () => {
    const builder = createGitHubPromptBuilder().withIssueContext({
      repository: 'owner/repo',
      issueNumber: 123,
      issueTitle: 'Test issue',
    });

    const result = builder.compile();
    expect(result).toContain('owner/repo');
    expect(result).toContain('#123');
    expect(result).toContain('Test issue');
  });

  it('should add PR context', () => {
    const builder = createGitHubPromptBuilder().withIssueContext({
      repository: 'owner/repo',
      issueNumber: 456,
      issueTitle: 'Test PR',
      isPR: true,
    });

    const result = builder.compile();
    expect(result).toContain('PR: #456');
  });

  it('should configure as code reviewer', () => {
    const builder = createGitHubPromptBuilder().asCodeReviewer();
    const result = builder.compile();

    expect(result).toContain('Check for bugs');
    expect(result).toContain('security vulnerabilities');
  });

  it('should configure as explainer', () => {
    const builder = createGitHubPromptBuilder().asExplainer();
    const result = builder.compile();

    expect(result).toContain('high-level overview');
    expect(result).toContain('Break down complex');
  });

  it('should add author and labels', () => {
    const builder = createGitHubPromptBuilder().withIssueContext({
      repository: 'owner/repo',
      issueNumber: 789,
      issueTitle: 'Feature request',
      author: 'username',
      labels: ['enhancement', 'help wanted'],
    });

    const result = builder.compile();
    expect(result).toContain('Author: username');
    expect(result).toContain('Labels: enhancement, help wanted');
  });

  it('should get github context', () => {
    const context = {
      repository: 'owner/repo',
      issueNumber: 123,
      issueTitle: 'Test',
    };
    const builder = createGitHubPromptBuilder().withIssueContext(context);

    expect(builder.getGitHubContext()).toEqual(context);
  });
});
