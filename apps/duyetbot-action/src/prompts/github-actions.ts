/**
 * GitHub Actions Prompt Builder
 *
 * Builds system prompts for the GitHub Actions agent
 */

import type { Checkpoint } from '../agent/checkpoint.js';
import type { Task } from '../tasks/types.js';
import { getIdentitySection } from './sections/identity.js';
import { getSafetySection } from './sections/safety.js';
import { getSelfImprovementSection } from './sections/self-improvement.js';

/**
 * Prompt context
 */
export interface PromptContext {
  task: Task;
  checkpoint?: Checkpoint;
  repositoryInfo?:
    | {
        owner: string;
        name: string;
        branch: string;
      }
    | undefined;
}

/**
 * Build system prompt for GitHub Actions agent
 */
export function buildSystemPrompt(context: PromptContext): string {
  const sections = [
    getIdentitySection(),
    getSelfImprovementSection(),
    getSafetySection(),
    buildTaskSection(context.task),
  ];

  if (context.checkpoint) {
    sections.push(buildCheckpointSection(context.checkpoint));
  }

  if (context.repositoryInfo) {
    sections.push(buildRepositorySection(context.repositoryInfo));
  }

  return sections.join('\n\n---\n\n');
}

/**
 * Build task section
 */
function buildTaskSection(task: Task): string {
  return `
# Current Task

**ID**: ${task.id}
**Source**: ${task.source}
**Title**: ${task.title}
**Priority**: ${task.priority}/10

## Description
${task.description}

## Instructions
1. Analyze the task requirements
2. Plan your approach
3. Implement the solution
4. Test your changes
5. Create a PR if successful
`.trim();
}

/**
 * Build checkpoint section
 */
function buildCheckpointSection(checkpoint: Checkpoint): string {
  return `
# Checkpoint

You are resuming from a previous session:
- **Step**: ${checkpoint.step}
- **Last Output**: ${checkpoint.lastOutput}
- **Status**: ${checkpoint.status}

Continue from where you left off.
`.trim();
}

/**
 * Build repository section
 */
function buildRepositorySection(repo: { owner: string; name: string; branch: string }): string {
  return `
# Repository

**Owner**: ${repo.owner}
**Name**: ${repo.name}
**Branch**: ${repo.branch}
`.trim();
}
