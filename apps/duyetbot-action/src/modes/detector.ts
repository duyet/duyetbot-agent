/**
 * Mode Detector
 *
 * Automatically detects the appropriate execution mode based on GitHub event type,
 * context, and user inputs.
 */

import type { GitHubContext } from '../github/context.js';
import type { AutoDetectedMode } from './types.js';

/**
 * Detects the appropriate mode based on GitHub context and inputs.
 *
 * Priority order:
 * 1. continuous_mode - if enabled, use continuous mode
 * 2. Entity events with @mention - use tag mode
 * 3. Explicit prompt - use agent mode
 * 4. Default - agent mode (won't trigger without prompt)
 */
export function detectMode(context: GitHubContext): AutoDetectedMode {
  // Priority 1: Continuous mode takes precedence
  if (context.inputs.continuousMode === 'true') {
    console.log('🔄 Continuous mode detected (continuous_mode input)');
    return 'continuous';
  }

  // Priority 2: Check for trigger in entity events
  const hasTrigger = checkForTrigger(context);
  const hasPrompt = !!context.inputs.prompt;

  // Entity events (issues, PRs, comments)
  if (context.entityNumber !== undefined) {
    // Comment events with @mention -> tag mode
    if (
      (context.eventName === 'issue_comment' ||
        context.eventName === 'pull_request_review_comment') &&
      hasTrigger
    ) {
      console.log('💬 Tag mode detected (@mention in comment)');
      return 'tag';
    }

    // Issue/PR events with @mention or label -> tag mode
    if (
      (context.eventName === 'issues' ||
        context.eventName === 'pull_request' ||
        context.eventName === 'pull_request_review') &&
      hasTrigger
    ) {
      console.log('💬 Tag mode detected (@mention or label on issue/PR)');
      return 'tag';
    }

    // Issue opened -> agent mode with default prompt
    if (context.eventName === 'issues' && context.eventAction === 'opened') {
      console.log('🤖 Agent mode detected (new issue opened)');
      return 'agent';
    }

    // Issue labeled with agent-task -> agent mode
    if (context.eventName === 'issues' && context.eventAction === 'labeled') {
      const label = context.payload?.issue?.labels?.find(
        (l: { name?: string }) => l.name === 'agent-task'
      );
      if (label) {
        console.log('🤖 Agent mode detected (agent-task label)');
        return 'agent';
      }
    }

    // Explicit prompt -> agent mode
    if (hasPrompt) {
      console.log('🤖 Agent mode detected (explicit prompt)');
      return 'agent';
    }
  }

  // Workflow dispatch with prompt -> agent mode
  if (context.eventName === 'workflow_dispatch' && hasPrompt) {
    console.log('🤖 Agent mode detected (workflow_dispatch with prompt)');
    return 'agent';
  }

  // Default: agent mode (won't trigger without prompt)
  console.log('🤖 Agent mode (default - will check for prompt)');
  return 'agent';
}

/**
 * Checks if the context contains a trigger (mention, label, assignee)
 */
function checkForTrigger(context: GitHubContext): boolean {
  const triggerPhrase = context.inputs.triggerPhrase?.toLowerCase() || '@duyetbot';
  const labelTrigger = context.inputs.labelTrigger?.toLowerCase() || 'duyetbot';
  const assigneeTrigger = context.inputs.assigneeTrigger?.toLowerCase() || 'duyetbot';

  // Check in issue/PR body
  const body = context.payload?.issue?.body || context.payload?.pull_request?.body || '';
  if (body.toLowerCase().includes(triggerPhrase)) {
    return true;
  }

  // Check in comment body
  const commentBody = context.payload?.comment?.body;
  if (commentBody?.toLowerCase().includes(triggerPhrase)) {
    return true;
  }

  // Check for label trigger
  if (context.eventName === 'issues' || context.eventName === 'pull_request') {
    const labels = context.payload?.issue?.labels || context.payload?.pull_request?.labels || [];
    if (labels.some((l: { name?: string }) => l.name?.toLowerCase() === labelTrigger)) {
      return true;
    }
  }

  // Check for assignee trigger
  const assignees =
    context.payload?.issue?.assignees || context.payload?.pull_request?.assignees || [];
  if (assignees.some((a: { login?: string }) => a.login?.toLowerCase() === assigneeTrigger)) {
    return true;
  }

  return false;
}
