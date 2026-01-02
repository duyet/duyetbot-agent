#!/usr/bin/env bun
/**
 * Report Entrypoint
 *
 * Final reporting and summary generation.
 * Runs after execution (success or failure).
 */

import * as core from '@actions/core';

/**
 * Main report function
 */
async function run() {
  try {
    const mode = core.getInput('MODE');
    const executionFile = core.getInput('EXECUTION_FILE') || '';
    const success = core.getInput('SUCCESS') === 'true';
    const tasksProcessed = core.getInput('TASKS_PROCESSED') || '0';

    console.log('📊 Duyetbot Action - Report');
    console.log('================================');
    console.log(`Mode: ${mode}`);
    console.log(`Success: ${success}`);
    console.log(`Tasks processed: ${tasksProcessed}`);

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

    // Generate summary for GitHub Actions
    const summary = generateSummary({
      mode,
      success,
      tasksProcessed: parseInt(tasksProcessed),
      executionOutput,
    });

    core.summary.addRaw(summary);
    await core.summary.write();

    console.log('✓ Summary written to GitHub Actions');
    console.log('================================');
  } catch (error) {
    console.error('Failed to generate report:', error);
    // Don't fail the action if report generation fails
  }
}

/**
 * Generates the GitHub Actions summary
 */
function generateSummary(options: {
  mode: string;
  success: boolean;
  tasksProcessed: number;
  executionOutput: any;
}): string {
  const { mode, success, tasksProcessed, executionOutput } = options;

  const status = success ? '✅' : '❌';
  const statusText = success ? 'Success' : 'Failed';

  let summary = `## Duyetbot Action Report\n\n`;
  summary += `| Setting | Value |\n`;
  summary += `|---------|-------|\n`;
  summary += `| Status | ${status} ${statusText} |\n`;
  summary += `| Mode | ${mode} |\n`;
  summary += `| Tasks processed | ${tasksProcessed} |\n`;

  if (executionOutput.tokensUsed) {
    summary += `| Tokens used | ${executionOutput.tokensUsed.toLocaleString()} |\n`;
  }
  if (executionOutput.stepsCompleted) {
    summary += `| Steps completed | ${executionOutput.stepsCompleted} |\n`;
  }

  if (executionOutput.output) {
    const outputPreview = executionOutput.output.slice(0, 1000);
    summary += `\n### Output\n\n`;
    summary += '```\n';
    summary += outputPreview;
    if (executionOutput.output.length > 1000) {
      summary += '\n...(truncated)';
    }
    summary += '\n```\n';
  }

  if (executionOutput.error) {
    summary += `\n### Error\n\n\`\`\`\n${executionOutput.error}\n\`\`\`\n`;
  }

  return summary;
}

// Run if this is the main module
if (import.meta.main) {
  run();
}

export { run };
