/**
 * GitHub-specific PromptBuilder
 */

import { PromptBuilder } from '../builder.js';
import { loadTemplate, templateNames } from '../loader.js';
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

    // Add GitHub-specific constraints from template
    this.addText('github_constraints', loadTemplate(templateNames.githubConstraints), 'important');

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
      loadTemplate(templateNames.reviewInstructions),
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
      loadTemplate(templateNames.explainInstructions),
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
