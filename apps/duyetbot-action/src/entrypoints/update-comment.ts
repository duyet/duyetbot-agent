#!/usr/bin/env bun
/**
 * Update Comment Entrypoint
 *
 * Updates the tracking comment with execution results.
 * Only runs if a tracking comment was created.
 */

import * as core from '@actions/core';

/**
 * Main update-comment function
 */
async function run() {
  try {
    const mode = core.getInput('MODE');
    const commentId = parseInt(core.getInput('COMMENT_ID') || '0');
    const executionFile = core.getInput('EXECUTION_FILE') || '';
    const success = core.getInput('SUCCESS') === 'true';

    console.log('📝 Duyetbot Action - Update Comment');
    console.log('================================');
    console.log(`Mode: ${mode}`);
    console.log(`Comment ID: ${commentId}`);
    console.log(`Success: ${success}`);

    if (!commentId) {
      console.log('⏭️  No comment to update');
      return;
    }

    // Read execution output if available
    let executionOutput: any = {};
    if (executionFile) {
      try {
        const content = await Bun.file(executionFile).text();
        executionOutput = JSON.parse(content);
      } catch (error) {
        console.warn('Failed to read execution file:', error);
      }
    }

    // For now, we'll just log the update
    // In a full implementation, this would call GitHub API to edit the comment
    const updateBody = generateUpdateBody({
      mode,
      success,
      tokensUsed: executionOutput.tokensUsed || 0,
      stepsCompleted: executionOutput.stepsCompleted || 0,
      output: executionOutput.output || '',
      error: executionOutput.error,
    });

    console.log('Update body:');
    console.log('---');
    console.log(updateBody);
    console.log('---');

    console.log('✓ Comment update prepared');
    console.log('================================');
  } catch (error) {
    console.error('Failed to update comment:', error);
    // Don't fail the action if comment update fails
  }
}

/**
 * Generates the update comment body
 */
function generateUpdateBody(options: {
  mode: string;
  success: boolean;
  tokensUsed: number;
  stepsCompleted: number;
  output: string;
  error?: string;
}): string {
  const { mode, success, tokensUsed, stepsCompleted, output, error } = options;

  const status = success ? '✅ Completed' : '❌ Failed';
  const outputPreview = output.slice(0, 2000);

  return `## 🤖 Duyetbot ${status}

**Mode:** ${mode}
**Tokens used:** ${tokensUsed.toLocaleString()}
**Steps completed:** ${stepsCompleted}

### Output

${outputPreview}${output.length > 2000 ? '\n\n...(truncated)' : ''}

${error ? `### Error\n\n\`${error}\`` : ''}

<!-- duyetbot-progress -->`;
}

// Run if this is the main module
if (import.meta.main) {
  run();
}

export { run };
