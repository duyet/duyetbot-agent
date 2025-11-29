/**
 * GitHub Worker
 *
 * Specialized worker for GitHub-related tasks:
 * - PR review and management
 * - Issue triage and analysis
 * - Repository analysis
 * - Code diff analysis
 */

import type { AgentContext } from "../agents/base-agent.js";
import type { PlanStep } from "../routing/schemas.js";
import type { LLMProvider } from "../types.js";
import {
  type BaseWorkerEnv,
  type WorkerClass,
  createBaseWorker,
} from "./base-worker.js";

// Re-export PlanStep for use in buildPrompt/parseResponse functions
export type { PlanStep };

/**
 * GitHub task types that this worker handles
 */
export type GitHubTaskType =
  | "pr_review"
  | "pr_create"
  | "issue_triage"
  | "issue_create"
  | "diff_analyze"
  | "repo_analyze"
  | "comment";

/**
 * Extended environment for GitHub worker
 */
export interface GitHubWorkerEnv extends BaseWorkerEnv {
  /** GitHub API token */
  GITHUB_TOKEN?: string;
  /** GitHub App ID */
  GITHUB_APP_ID?: string;
  /** GitHub App Private Key */
  GITHUB_APP_PRIVATE_KEY?: string;
}

/**
 * Configuration for GitHub worker
 */
export interface GitHubWorkerConfig<TEnv extends GitHubWorkerEnv> {
  /** Function to create LLM provider from env, optionally with context for credentials */
  createProvider: (env: TEnv, context?: AgentContext) => LLMProvider;
  /** Default repository owner */
  defaultOwner?: string;
  /** Default repository name */
  defaultRepo?: string;
  /** Enable detailed logging */
  debug?: boolean;
}

/**
 * System prompt for GitHub worker
 */
const GITHUB_WORKER_SYSTEM_PROMPT = `You are an expert GitHub automation assistant specializing in code review, issue management, and repository operations.

## Your Capabilities
- PR Review: Analyze pull requests for quality, security, and best practices
- PR Creation: Draft well-structured pull request descriptions
- Issue Triage: Categorize and prioritize issues effectively
- Issue Creation: Create clear, actionable issue reports
- Diff Analysis: Understand and explain code changes
- Repository Analysis: Assess repository health and patterns
- Comment Drafting: Write clear, helpful review comments

## Output Guidelines
- Be constructive and specific in feedback
- Reference specific line numbers when reviewing code
- Use GitHub-flavored markdown in responses
- Suggest concrete improvements, not just problems
- Consider the project's existing patterns and conventions
- Be respectful and professional in tone

## Response Format
- Use GitHub-compatible markdown
- Include code suggestions in diff format when applicable
- Structure reviews with clear sections
- Use task lists for actionable items`;

/**
 * Detect the GitHub task type from the task description
 */
export function detectGitHubTaskType(task: string): GitHubTaskType {
  const taskLower = task.toLowerCase();

  if (
    taskLower.includes("review pr") ||
    taskLower.includes("pr review") ||
    taskLower.includes("pull request review")
  ) {
    return "pr_review";
  }
  if (
    taskLower.includes("create pr") ||
    taskLower.includes("draft pr") ||
    taskLower.includes("open pr")
  ) {
    return "pr_create";
  }
  if (taskLower.includes("triage") || taskLower.includes("categorize issue")) {
    return "issue_triage";
  }
  if (
    taskLower.includes("create issue") ||
    taskLower.includes("open issue") ||
    taskLower.includes("report bug")
  ) {
    return "issue_create";
  }
  if (
    taskLower.includes("diff") ||
    taskLower.includes("changes") ||
    taskLower.includes("commit")
  ) {
    return "diff_analyze";
  }
  if (taskLower.includes("repo") || taskLower.includes("repository")) {
    return "repo_analyze";
  }
  if (taskLower.includes("comment") || taskLower.includes("respond")) {
    return "comment";
  }

  return "diff_analyze"; // Default to diff analysis
}

/**
 * Get task-specific instructions based on task type
 */
function getGitHubInstructions(taskType: GitHubTaskType): string {
  const instructions: Record<GitHubTaskType, string> = {
    pr_review: `
## PR Review Checklist
1. **Code Quality**
   - Logic correctness
   - Error handling
   - Code style consistency
2. **Security**
   - Input validation
   - Authentication/authorization
   - Sensitive data handling
3. **Performance**
   - Algorithm efficiency
   - Resource usage
   - Caching opportunities
4. **Testing**
   - Test coverage
   - Edge cases
   - Integration tests
5. **Documentation**
   - Code comments
   - API documentation
   - README updates

Format your review as:
\`\`\`
## Summary
[One paragraph overview]

## Detailed Findings

### 🔴 Critical
[Must fix before merge]

### 🟡 Suggestions
[Recommended improvements]

### 🟢 Nitpicks
[Optional style/preference items]

## Verdict
[ ] Approve
[ ] Request Changes
[ ] Comment
\`\`\``,

    pr_create: `
## PR Description Format
\`\`\`markdown
## Summary
[Concise description of changes]

## Motivation
[Why these changes are needed]

## Changes
- [Bullet point of each major change]

## Testing
- [ ] Unit tests added/updated
- [ ] Integration tests added/updated
- [ ] Manual testing completed

## Screenshots
[If applicable]

## Related Issues
Closes #[issue number]
\`\`\``,

    issue_triage: `
## Issue Triage Criteria
1. **Type Classification**
   - Bug: Something isn't working as expected
   - Feature: New functionality request
   - Enhancement: Improvement to existing functionality
   - Documentation: Documentation needs
   - Question: Needs clarification

2. **Priority Assessment**
   - P0: Critical - blocks release/production
   - P1: High - significant impact, needs prompt attention
   - P2: Medium - should be addressed in current cycle
   - P3: Low - nice to have, can be deferred

3. **Labels to Apply**
   - Type label (bug, feature, etc.)
   - Priority label
   - Area label (frontend, backend, etc.)
   - Status label (needs-info, ready, etc.)`,

    issue_create: `
## Issue Template
\`\`\`markdown
## Description
[Clear description of the issue]

## Expected Behavior
[What should happen]

## Actual Behavior
[What actually happens]

## Steps to Reproduce
1. [First step]
2. [Second step]
3. [And so on...]

## Environment
- OS: [e.g., macOS 14.0]
- Version: [e.g., v1.2.3]
- Browser: [if applicable]

## Additional Context
[Screenshots, logs, related issues]
\`\`\``,

    diff_analyze: `
## Diff Analysis Guidelines
1. Identify the purpose of changes
2. Note files added/modified/deleted
3. Highlight breaking changes
4. Identify potential issues or risks
5. Summarize the impact
6. Note any missing changes (tests, docs)

Format as:
- **Purpose**: [What the changes accomplish]
- **Scope**: [Files/areas affected]
- **Risk Level**: [Low/Medium/High]
- **Key Changes**: [Bullet list]
- **Concerns**: [Any issues found]`,

    repo_analyze: `
## Repository Analysis Areas
1. **Health Metrics**
   - Activity level
   - Issue/PR response time
   - Test coverage
   - Documentation completeness

2. **Code Quality**
   - Code structure
   - Dependency health
   - Technical debt indicators

3. **Community**
   - Contributor activity
   - Issue templates
   - Contributing guidelines

4. **Security**
   - Dependency vulnerabilities
   - Security policy
   - Secret management`,

    comment: `
## Comment Guidelines
1. Be constructive and specific
2. Explain the "why" not just "what"
3. Suggest alternatives when critiquing
4. Use code examples when helpful
5. Be respectful and professional
6. Tag relevant people if needed

Format suggestions as:
\`\`\`suggestion
[Your suggested code]
\`\`\``,
  };

  return instructions[taskType] || instructions.diff_analyze;
}

/**
 * Build GitHub-specific prompt
 */
function buildGitHubPrompt(
  step: PlanStep,
  dependencyContext: string,
  defaultOwner?: string,
  defaultRepo?: string,
): string {
  const taskType = detectGitHubTaskType(step.task);
  const taskInstructions = getGitHubInstructions(taskType);

  const parts: string[] = [];

  if (dependencyContext) {
    parts.push(dependencyContext);
  }

  parts.push(`## GitHub Task Type: ${taskType.toUpperCase()}`);
  parts.push(`## Task\n${step.task}`);
  parts.push(taskInstructions);
  parts.push("\n## Additional Instructions");
  parts.push(`- ${step.description}`);
  parts.push("- Use GitHub-flavored markdown");
  parts.push("- Be constructive and specific");

  if (defaultOwner && defaultRepo) {
    parts.push(`- Default repository: ${defaultOwner}/${defaultRepo}`);
  }

  return parts.join("\n");
}

/**
 * Parse GitHub-specific response
 */
function parseGitHubResponse(content: string, expectedOutput: string): unknown {
  // For action output, try to extract structured GitHub actions
  if (expectedOutput === "action") {
    // Try to detect review verdict
    if (content.includes("Approve") || content.includes("Request Changes")) {
      const verdict = content.includes("Request Changes")
        ? "request_changes"
        : content.includes("Approve")
          ? "approve"
          : "comment";

      return {
        type: "pr_review",
        verdict,
        content,
      };
    }

    // Try to detect issue labels
    const labelMatch = content.match(/Labels?:\s*(.+)/i);
    if (labelMatch?.[1]) {
      const labels = labelMatch[1].split(/[,;]/).map((l: string) => l.trim());
      return {
        type: "issue_triage",
        labels,
        content,
      };
    }

    return { action: "completed", result: content };
  }

  // For data output, try to extract structured findings
  if (expectedOutput === "data") {
    // Try to extract critical/suggestion/nitpick sections
    const hasCritical = content.includes("Critical") || content.includes("🔴");
    const hasSuggestions =
      content.includes("Suggestion") || content.includes("🟡");

    if (hasCritical || hasSuggestions) {
      return {
        type: "review_findings",
        hasCritical,
        hasSuggestions,
        content,
      };
    }

    // Try to parse as JSON
    try {
      const jsonMatch = content.match(/```json\n?([\s\S]*?)```/);
      if (jsonMatch?.[1]) {
        return JSON.parse(jsonMatch[1]);
      }
    } catch {
      // Not JSON, return content
    }
  }

  // For code output, extract code blocks
  if (expectedOutput === "code") {
    const codeMatch = content.match(/```[\w]*\n?([\s\S]*?)```/);
    return codeMatch?.[1] ? codeMatch[1].trim() : content;
  }

  return content;
}

/**
 * Create a GitHub Worker class
 *
 * @example
 * ```typescript
 * export const GitHubWorker = createGitHubWorker({
 *   createProvider: (env) => createAIGatewayProvider(env),
 *   defaultOwner: 'myorg',
 *   defaultRepo: 'myrepo',
 * });
 * ```
 */
export function createGitHubWorker<TEnv extends GitHubWorkerEnv>(
  config: GitHubWorkerConfig<TEnv>,
): WorkerClass<TEnv> {
  const baseConfig: Parameters<typeof createBaseWorker<TEnv>>[0] = {
    createProvider: config.createProvider,
    workerType: "github",
    systemPrompt: GITHUB_WORKER_SYSTEM_PROMPT,
    buildPrompt: (step, dependencyContext) =>
      buildGitHubPrompt(
        step,
        dependencyContext,
        config.defaultOwner,
        config.defaultRepo,
      ),
    parseResponse: parseGitHubResponse,
  };
  if (config.debug !== undefined) {
    baseConfig.debug = config.debug;
  }
  return createBaseWorker<TEnv>(baseConfig);
}
