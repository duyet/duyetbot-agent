#!/usr/bin/env bun
/**
 * Prepare Entrypoint
 *
 * Main entry point for duyetbot-action. Handles:
 * - Mode detection (tag/agent/continuous)
 * - Trigger validation
 * - GitHub token setup
 * - Permission checks
 * - Initial comment creation
 * - Branch setup
 */

import * as core from '@actions/core';
import { createOctokit } from '../github/api/client.js';
import { isEntityContext, parseGitHubContext } from '../github/context.js';
import { setupGitHubToken } from '../github/token.js';
import { checkWritePermissions } from '../github/validation/permissions.js';
import { getMode } from '../modes/registry.js';

/**
 * Main prepare function
 */
async function run() {
  try {
    console.log('🤖 Duyetbot Action - Prepare Step');
    console.log('================================');

    // Parse GitHub context
    const context = parseGitHubContext();
    console.log(
      `Event: ${context.eventName}${context.eventAction ? ` (${context.eventAction})` : ''}`
    );
    console.log(`Actor: ${context.actor}`);
    console.log(`Repository: ${context.repository.fullName}`);
    if (context.entityNumber) {
      console.log(`Entity: #${context.entityNumber}${context.isPR ? ' (PR)' : ' (Issue)'}`);
    }

    // Auto-detect mode based on context
    const mode = getMode(context);
    console.log(`Mode: ${mode.name}`);
    console.log(`Description: ${mode.description}`);

    // Set mode output
    core.setOutput('mode', mode.name);

    // Setup GitHub token
    const githubToken = await setupGitHubToken();
    const octokit = createOctokit(githubToken);
    core.setOutput('github_token', githubToken);
    console.log('✓ GitHub token configured');

    // Check write permissions for entity contexts
    if (isEntityContext(context)) {
      const githubTokenProvided = !!context.inputs.githubToken;
      const hasPermission = await checkWritePermissions(
        octokit,
        context,
        context.inputs.allowedNonWriteUsers,
        githubTokenProvided
      );

      if (!hasPermission) {
        throw new Error('Actor does not have write permissions to this repository');
      }
      console.log('✓ Write permissions verified');
    }

    // Check if mode should trigger
    const shouldTrigger = mode.shouldTrigger(context);
    core.setOutput('should_execute', shouldTrigger.toString());

    if (!shouldTrigger) {
      console.log('⏭️  Mode not triggered, skipping execution');
      return;
    }

    console.log('✓ Mode triggered');

    // Prepare mode (create comment, setup branch, etc.)
    const result = await mode.prepare({
      context,
      octokit,
      githubToken,
    });

    // Set outputs from prepare step
    if (result.commentId) {
      core.setOutput('comment_id', result.commentId.toString());
      console.log(`✓ Tracking comment created: #${result.commentId}`);
    }

    if (result.taskId) {
      core.setOutput('task_id', result.taskId);
      console.log(`✓ Task ID: ${result.taskId}`);
    }

    if (result.branchInfo.claudeBranch) {
      core.setOutput('branch_name', result.branchInfo.claudeBranch);
      core.setOutput('base_branch', result.branchInfo.baseBranch);
      console.log(
        `✓ Branch: ${result.branchInfo.claudeBranch} (base: ${result.branchInfo.baseBranch})`
      );
    }

    // Export system prompt if mode provides one
    if (mode.getSystemPrompt) {
      const modeContext = mode.prepareContext(context, result);
      const systemPrompt = mode.getSystemPrompt(modeContext);
      if (systemPrompt) {
        core.exportVariable('APPEND_SYSTEM_PROMPT', systemPrompt);
        console.log('✓ System prompt appended');
      }
    }

    console.log('================================');
    console.log('✓ Prepare step completed successfully');
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    core.setFailed(`Prepare step failed: ${errorMessage}`);
    core.setOutput('prepare_error', errorMessage);
    process.exit(1);
  }
}

// Run if this is the main module
if (import.meta.main) {
  run();
}

export { run };
