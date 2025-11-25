/**
 * Code Worker
 *
 * Specialized worker for code-related tasks:
 * - Code review and analysis
 * - Code generation and refactoring
 * - Bug detection and fixes
 * - Documentation generation
 */

import type { PlanStep } from '../routing/schemas.js';
import type { LLMProvider } from '../types.js';
import { type BaseWorkerEnv, type WorkerClass, createBaseWorker } from './base-worker.js';

/**
 * Code task types that this worker handles
 */
export type CodeTaskType =
  | 'review'
  | 'generate'
  | 'refactor'
  | 'analyze'
  | 'document'
  | 'fix'
  | 'test'
  | 'explain';

/**
 * Extended environment for code worker
 */
export interface CodeWorkerEnv extends BaseWorkerEnv {
  /** Optional: Default programming language */
  DEFAULT_LANGUAGE?: string;
}

/**
 * Configuration for code worker
 */
export interface CodeWorkerConfig<TEnv extends CodeWorkerEnv> {
  /** Function to create LLM provider from env */
  createProvider: (env: TEnv) => LLMProvider;
  /** Default programming language */
  defaultLanguage?: string;
  /** Enable detailed logging */
  debug?: boolean;
}

/**
 * System prompt for code worker
 */
const CODE_WORKER_SYSTEM_PROMPT = `You are an expert software engineer specializing in code analysis, review, and generation.

## Your Capabilities
- Code Review: Identify bugs, security issues, performance problems, and style violations
- Code Generation: Write clean, efficient, well-documented code
- Code Refactoring: Improve code structure while preserving behavior
- Code Analysis: Understand code flow, dependencies, and architecture
- Documentation: Generate clear, comprehensive documentation
- Bug Fixes: Identify and fix bugs with minimal side effects
- Test Generation: Write comprehensive unit and integration tests
- Code Explanation: Explain complex code in simple terms

## Output Guidelines
- Always provide complete, runnable code when generating
- Include comments explaining complex logic
- Follow language-specific best practices and conventions
- Consider edge cases and error handling
- Prioritize readability and maintainability
- When reviewing, categorize issues by severity (critical, major, minor)

## Response Format
- For code output, use appropriate markdown code blocks with language tags
- For reviews, use a structured format with categories
- For explanations, use clear sections with examples`;

/**
 * Detect the code task type from the task description
 */
export function detectCodeTaskType(task: string): CodeTaskType {
  const taskLower = task.toLowerCase();

  if (taskLower.includes('review') || taskLower.includes('check')) {
    return 'review';
  }
  if (
    taskLower.includes('generate') ||
    taskLower.includes('create') ||
    taskLower.includes('write')
  ) {
    return 'generate';
  }
  if (
    taskLower.includes('refactor') ||
    taskLower.includes('improve') ||
    taskLower.includes('clean')
  ) {
    return 'refactor';
  }
  if (taskLower.includes('analyze') || taskLower.includes('understand')) {
    return 'analyze';
  }
  if (taskLower.includes('document') || taskLower.includes('comment')) {
    return 'document';
  }
  if (taskLower.includes('fix') || taskLower.includes('bug') || taskLower.includes('error')) {
    return 'fix';
  }
  if (taskLower.includes('test')) {
    return 'test';
  }
  if (taskLower.includes('explain')) {
    return 'explain';
  }

  return 'analyze'; // Default to analysis
}

/**
 * Get task-specific instructions based on task type
 */
function getTaskInstructions(taskType: CodeTaskType): string {
  const instructions: Record<CodeTaskType, string> = {
    review: `
## Review Checklist
1. Security vulnerabilities (injection, XSS, CSRF, etc.)
2. Performance issues (N+1 queries, memory leaks, etc.)
3. Logic errors and edge cases
4. Code style and conventions
5. Error handling completeness
6. Test coverage gaps

Format findings as:
- **Critical**: Must fix before deployment
- **Major**: Should fix soon
- **Minor**: Nice to have improvements`,

    generate: `
## Code Generation Guidelines
1. Follow SOLID principles
2. Include appropriate error handling
3. Add JSDoc/docstrings for public APIs
4. Consider edge cases
5. Make code testable
6. Use meaningful variable and function names`,

    refactor: `
## Refactoring Guidelines
1. Preserve existing behavior (no functional changes)
2. Improve code readability
3. Reduce complexity (cyclomatic complexity)
4. Extract reusable functions/classes
5. Apply DRY principle
6. Ensure backward compatibility`,

    analyze: `
## Analysis Focus Areas
1. Code structure and organization
2. Dependencies and coupling
3. Data flow patterns
4. Error handling patterns
5. Performance characteristics
6. Security considerations`,

    document: `
## Documentation Requirements
1. Function/method signatures with types
2. Parameter descriptions
3. Return value descriptions
4. Usage examples
5. Error conditions
6. Side effects`,

    fix: `
## Bug Fix Guidelines
1. Identify root cause, not just symptoms
2. Minimal changes to fix the issue
3. Add regression test coverage
4. Consider related code paths
5. Document the fix
6. No unrelated changes`,

    test: `
## Test Generation Guidelines
1. Test happy path and edge cases
2. Include error scenarios
3. Test boundary conditions
4. Mock external dependencies
5. Use descriptive test names
6. Follow AAA pattern (Arrange, Act, Assert)`,

    explain: `
## Explanation Guidelines
1. Start with high-level overview
2. Break down complex parts
3. Use analogies where helpful
4. Include concrete examples
5. Explain the "why" not just "what"
6. Highlight important patterns`,
  };

  return instructions[taskType];
}

/**
 * Build code-specific prompt
 */
function buildCodePrompt(
  step: PlanStep,
  dependencyContext: string,
  defaultLanguage?: string
): string {
  const taskType = detectCodeTaskType(step.task);
  const taskInstructions = getTaskInstructions(taskType);

  const parts: string[] = [];

  if (dependencyContext) {
    parts.push(dependencyContext);
  }

  parts.push(`## Task Type: ${taskType.toUpperCase()}`);
  parts.push(`## Task\n${step.task}`);
  parts.push(taskInstructions);
  parts.push('\n## Additional Instructions');
  parts.push(`- ${step.description}`);

  if (defaultLanguage) {
    parts.push(`- Default language: ${defaultLanguage}`);
  }

  return parts.join('\n');
}

/**
 * Parse code-specific response
 */
function parseCodeResponse(content: string, expectedOutput: string): unknown {
  // For code output, try to extract structured data
  if (expectedOutput === 'code') {
    const codeBlocks: Array<{ language: string; code: string }> = [];
    const codePattern = /```(\w*)\n([\s\S]*?)```/g;
    let match: RegExpExecArray | null = codePattern.exec(content);

    while (match !== null) {
      const language = match[1] ?? 'text';
      const code = match[2] ?? '';
      codeBlocks.push({
        language,
        code: code.trim(),
      });
      match = codePattern.exec(content);
    }

    if (codeBlocks.length === 1 && codeBlocks[0]) {
      return codeBlocks[0].code;
    }
    if (codeBlocks.length > 1) {
      return codeBlocks;
    }
    return content;
  }

  // For reviews, try to extract structured findings
  if (expectedOutput === 'data' && (content.includes('Critical') || content.includes('Major'))) {
    return {
      rawReview: content,
      hasFindings: true,
      hasCritical: content.toLowerCase().includes('critical'),
      hasMajor: content.toLowerCase().includes('major'),
    };
  }

  // Default parsing
  switch (expectedOutput) {
    case 'data': {
      try {
        const jsonMatch = content.match(/```json\n?([\s\S]*?)```/);
        if (jsonMatch?.[1]) {
          return JSON.parse(jsonMatch[1]);
        }
        return JSON.parse(content);
      } catch {
        return content;
      }
    }
    case 'action':
      return { action: 'completed', result: content };
    default:
      return content;
  }
}

/**
 * Create a Code Worker class
 *
 * @example
 * ```typescript
 * export const CodeWorker = createCodeWorker({
 *   createProvider: (env) => createAIGatewayProvider(env),
 *   defaultLanguage: 'typescript',
 * });
 * ```
 */
export function createCodeWorker<TEnv extends CodeWorkerEnv>(
  config: CodeWorkerConfig<TEnv>
): WorkerClass<TEnv> {
  const baseConfig: Parameters<typeof createBaseWorker<TEnv>>[0] = {
    createProvider: config.createProvider,
    workerType: 'code',
    systemPrompt: CODE_WORKER_SYSTEM_PROMPT,
    buildPrompt: (step, dependencyContext) =>
      buildCodePrompt(step, dependencyContext, config.defaultLanguage),
    parseResponse: parseCodeResponse,
  };
  if (config.debug !== undefined) {
    baseConfig.debug = config.debug;
  }
  return createBaseWorker<TEnv>(baseConfig);
}
