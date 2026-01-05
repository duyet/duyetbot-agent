#!/usr/bin/env bun
/**
 * Execute Entrypoint
 *
 * Executes the agent loop with the prepared context.
 * This is where the actual AI work happens.
 */

import * as core from '@actions/core';
import { loadConfig } from '../config.js';
import { parseGitHubContext } from '../github/context.js';
import { getMode } from '../modes/registry.js';
import type { Task, TaskSource } from '../tasks/types.js';

/**
 * Main execute function
 */
async function run() {
  try {
    console.log('🚀 Duyetbot Action - Execute Step');
    console.log('================================');

    const mode = core.getInput('MODE') as 'tag' | 'agent' | 'continuous';
    const taskId = core.getInput('TASK_ID');
    const commentId = core.getInput('COMMENT_ID');
    const shouldExecute = core.getInput('SHOULD_EXECUTE') === 'true';

    console.log(`Mode: ${mode}`);
    console.log(`Task ID: ${taskId}`);
    console.log(`Should execute: ${shouldExecute}`);

    if (!shouldExecute) {
      console.log('⏭️  Skipping execution (should_execute=false)');
      return;
    }

    // Load config from environment
    const config = loadConfig();
    console.log(`✓ Config loaded (model: ${config.model})`);

    // Parse context
    const context = parseGitHubContext();
    const modeInstance = getMode(context);
    const prepareData: Partial<import('../modes/types.js').ModeResult> = { taskId };
    if (commentId) {
      prepareData.commentId = parseInt(commentId, 10);
    }
    const modeContext = modeInstance.prepareContext(context, prepareData);

    // Generate prompt from mode
    const prompt = modeInstance.generatePrompt(modeContext);
    console.log(`Prompt: ${prompt.slice(0, 100)}...`);

    // Build task object
    const task: Task = {
      id: taskId,
      title: prompt.slice(0, 100),
      description: prompt,
      source: context.inputs.taskSource as TaskSource,
      priority: 8, // High priority (1-10 scale)
      labels: [],
      status: 'in_progress',
      metadata: {
        mode,
        commentId,
        repository: context.repository.fullName,
        isPR: context.isPR,
      },
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    console.log(`Task: ${task.title}`);

    // Import AgentLoop dynamically to avoid circular dependencies
    const { AgentLoop } = await import('../agent/loop.js');

    // Initialize agent loop
    const agentLoop = new AgentLoop({
      config,
      task,
      onProgress: (step, message) => {
        const preview = message.slice(0, 150).replace(/\n/g, ' ');
        console.log(`[Step ${step}] ${preview}`);

        // Emit progress for tracking comment updates
        if (modeInstance.shouldCreateTrackingComment() && commentId) {
          core.saveState(
            'progress_update',
            JSON.stringify({
              step,
              message: preview,
              commentId,
              timestamp: Date.now(),
            })
          );
        }
      },
    });

    // Execute agent
    console.log('🤖 Starting agent loop...');
    const result = await agentLoop.run();

    // Set outputs
    core.setOutput('success', result.success.toString());
    core.setOutput('tokens_used', result.tokensUsed.toString());
    core.setOutput('steps_completed', result.stepsCompleted.toString());
    core.setOutput('session_id', taskId);

    if (result.output) {
      core.setOutput('output', result.output.slice(0, 10000)); // Truncate for GitHub limits
    }

    if (result.error) {
      core.setOutput('error', result.error);
    }

    // Write execution file for reporting
    const executionFile = `${process.env.RUNNER_TEMP}/duyetbot-execution-${Date.now()}.json`;
    await Bun.write(
      executionFile,
      JSON.stringify({
        success: result.success,
        output: result.output,
        error: result.error,
        tokensUsed: result.tokensUsed,
        stepsCompleted: result.stepsCompleted,
        taskId,
        mode,
        timestamp: new Date().toISOString(),
      })
    );
    core.setOutput('execution_file', executionFile);
    console.log(`✓ Execution file: ${executionFile}`);

    console.log('================================');
    console.log(`✓ Execution completed`);
    console.log(`  Success: ${result.success}`);
    console.log(`  Tokens: ${result.tokensUsed.toLocaleString()}`);
    console.log(`  Steps: ${result.stepsCompleted}`);

    if (!result.success) {
      process.exit(1);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    core.setFailed(`Execute step failed: ${errorMessage}`);
    core.setOutput('error', errorMessage);
    process.exit(1);
  }
}

// Run if this is the main module
if (import.meta.main) {
  run();
}

export { run };
