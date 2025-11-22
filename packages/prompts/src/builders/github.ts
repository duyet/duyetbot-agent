/**
 * GitHub-specific PromptBuilder
 */

import { PromptBuilder } from '../builder.js';
import type { GitHubContext } from '../types.js';

/**
 * PromptBuilder configured for GitHub bot interactions
 */
export class GitHubPromptBuilder extends PromptBuilder {
  private githubContext?: GitHubContext;

  constructor() {
    super();

    // Set default context for GitHub
    this.addContext({ channel: 'github' });

    // Add role
    this.addRole('assistant');

    // Add standard sections
    this.addCapabilities();

    // Add GitHub-specific capabilities
    this.addText(
      'github_capabilities',
      `Additional capabilities:
- Code review and analysis
- PR and issue management
- Documentation improvements`,
      'important'
    );

    // Add code guidelines
    this.addCodeGuidelines();

    // Add response guidelines
    this.addResponseGuidelines();

    // Add GitHub-specific constraints
    this.addConstraints([
      'Reference specific files and line numbers',
      'Provide actionable suggestions',
      'Use GitHub-flavored markdown',
    ]);

    // Add API access note
    this.addText(
      'api_access',
      'You have access to GitHub API operations and can interact with repositories, issues, and pull requests.',
      'optional'
    );
  }

  /**
   * Add repository context
   */
  withRepository(repository: string): this {
    this.addContext({ repository });
    return this;
  }

  /**
   * Add issue/PR context
   */
  withIssueContext(context: GitHubContext): this {
    this.githubContext = context;

    const type = context.isPR ? 'PR' : 'Issue';
    let contextText = `Current context:
- Repository: ${context.repository}
- ${type}: #${context.issueNumber} - ${context.issueTitle}`;

    if (context.author) {
      contextText += `\n- Author: ${context.author}`;
    }

    if (context.labels && context.labels.length > 0) {
      contextText += `\n- Labels: ${context.labels.join(', ')}`;
    }

    this.addText('github_context', contextText, 'critical');
    return this;
  }

  /**
   * Configure as a code reviewer
   */
  asCodeReviewer(): this {
    this.addRole('reviewer');

    this.addText(
      'review_instructions',
      `When reviewing code:
- Check for bugs and logic errors
- Identify security vulnerabilities
- Suggest performance improvements
- Verify code style consistency
- Ensure test coverage is adequate`,
      'important'
    );

    return this;
  }

  /**
   * Configure as a code explainer
   */
  asExplainer(): this {
    this.addRole('explainer');

    this.addText(
      'explain_instructions',
      `When explaining code:
- Start with a high-level overview
- Break down complex sections
- Explain the purpose of key functions
- Note any patterns or design decisions`,
      'important'
    );

    return this;
  }

  /**
   * Get the GitHub context if set
   */
  getGitHubContext(): GitHubContext | undefined {
    return this.githubContext;
  }
}

/**
 * Create a pre-configured GitHub prompt builder
 */
export function createGitHubPromptBuilder(): GitHubPromptBuilder {
  return new GitHubPromptBuilder();
}

/**
 * Get the default GitHub system prompt
 */
export function getGitHubSystemPrompt(): string {
  return new GitHubPromptBuilder().compile();
}

/**
 * Build a GitHub context prompt (backward compatible)
 */
export function buildGitHubContextPrompt(context: {
  repository: string;
  issueNumber: number;
  issueTitle: string;
  isPR?: boolean;
}): string {
  const type = context.isPR ? 'PR' : 'Issue';
  return `Current context:
- Repository: ${context.repository}
- ${type}: #${context.issueNumber} - ${context.issueTitle}`;
}
