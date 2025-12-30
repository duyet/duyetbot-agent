#!/usr/bin/env bun
import { AgentLoop } from './agent/loop.js';
import type { Config } from './config.js';
import { CombinedReporter } from './reporter/index.js';
import type { ReportContext } from './reporter/types.js';
import { TaskPicker } from './tasks/picker.js';
import type { Task, TaskSource } from './tasks/types.js';

interface NightlyOptions {
  taskDescription?: string;
  model?: string;
  taskSource?: TaskSource;
  taskId?: string;
  dryRun?: boolean;
}

/**
 * Run the nightly GitHub Actions agent
 * Handles issue creation, agent execution, and cleanup
 */
export async function runNightlyAgent(options: NightlyOptions = {}) {
  const {
    taskDescription,
    model,
    taskSource = 'all',
    taskId: providedTaskId,
    dryRun = false,
  } = options;

  // Require task description
  if (!taskDescription && !providedTaskId) {
    throw new Error('TASK_DESCRIPTION environment variable or --task option is required');
  }

  // Load config
  const { loadConfig: configLoader } = await import('./config.js');
  const config = configLoader();

  console.log('🌙 GitHub Actions Nightly Agent starting...');
  const startTime = Date.now();

  // Override dry-run from options
  if (dryRun) {
    (config as { dryRun: boolean }).dryRun = true;
    console.log('⚠️  Dry run mode enabled');
  }

  console.log(`📋 Task source: ${taskSource}`);
  if (providedTaskId) {
    console.log(`🎯 Specific task: ${providedTaskId}`);
  }

  // Determine which sources to use
  const sources = getSourcesToUse(taskSource, config);
  console.log(`📌 Active sources: ${sources.join(', ')}`);

  // Initialize task picker
  const picker = new TaskPicker({
    sources,
    githubToken: config.githubToken,
    repository: config.repository,
    tasksFilePath: 'TASKS.md',
    memoryMcpUrl: config.memoryMcpUrl,
  });

  let task: Task | null = null;
  let issueNumber: number | undefined;

  // If no task ID provided, create a GitHub issue
  if (!providedTaskId) {
    const result = await createNightlyIssue(taskDescription, config);
    if (!result) {
      console.error('❌ Failed to create GitHub issue');
      process.exit(1);
    }
    issueNumber = result.issueNumber;
    task = result.task;
  } else {
    // Find the specific task
    const allTasks = await picker.listAllPending();
    task = allTasks.find((t) => t.id === providedTaskId) || null;

    if (!task) {
      console.error(`❌ Task not found: ${providedTaskId}`);
      process.exit(1);
    }

    // Extract issue number from GitHub issue task ID
    if (task.source === 'github-issues') {
      const match = task.id.match(/github-(\d+)/);
      if (match?.[1]) {
        issueNumber = parseInt(match[1], 10);
      }
    }
  }

  console.log(`\n🎯 Working on task: ${task.title}`);
  console.log(`   Source: ${task.source}`);
  console.log(`   Priority: ${task.priority}`);
  console.log(`   ID: ${task.id}\n`);

  // Initialize agent loop
  const agentLoop = new AgentLoop({
    config,
    task,
    onProgress: (step, message) => {
      const preview = message.slice(0, 100).replace(/\n/g, ' ');
      console.log(`   [Step ${step}] ${preview}${message.length > 100 ? '...' : ''}`);
    },
  });

  // Run agent
  console.log('🔄 Running agent loop...\n');
  const result = await agentLoop.run();

  const duration = Date.now() - startTime;

  // Build report context
  const reportContext = buildReportContext(task, result, duration, issueNumber);

  // Initialize reporter and report results
  if (config.repository) {
    const reporter = new CombinedReporter({
      githubToken: config.githubToken,
      owner: config.repository.owner,
      repo: config.repository.name,
      logDir: config.logDir,
      dryRun: config.dryRun,
    });

    console.log('\n📤 Reporting results...');
    await reporter.report(reportContext);
  }

  // Update task status
  if (result.success) {
    await picker.markComplete(task.id);
    console.log(`\n✅ Task completed successfully`);
  } else {
    await picker.markFailed(task.id, result.error || 'Unknown error');
    console.log(`\n❌ Task failed: ${result.error}`);
  }

  // Close the issue if we created it and not in dry-run mode
  if (issueNumber && !providedTaskId && !dryRun) {
    await closeNightlyIssue(issueNumber, config, result);
  }

  // Print summary
  console.log('\n📊 Summary:');
  console.log(`   Duration: ${(duration / 1000).toFixed(2)}s`);
  console.log(`   Tokens: ${result.tokensUsed}`);
  console.log(`   Steps: ${result.stepsCompleted}`);

  if (!result.success) {
    process.exit(1);
  }
}

/**
 * Create a GitHub issue for the nightly task
 */
async function createNightlyIssue(
  taskDescription: string,
  config: Config
): Promise<{ issueNumber: number; task: Task } | null> {
  if (!config.repository || !config.githubToken) {
    console.error('❌ GitHub repository or token not configured');
    return null;
  }

  const { Octokit } = await import('@octokit/rest');
  const octokit = new Octokit({ auth: config.githubToken });

  try {
    // Create the issue
    const response = await octokit.rest.issues.create({
      owner: config.repository.owner,
      repo: config.repository.name,
      title: '🌙 Nightly Agent Task: Repository Analysis and Improvements',
      body: `## Task Description\n\n${taskDescription}\n\n---\n\n*This issue was automatically created by the scheduled Agent Nightly workflow*`,
      labels: ['agent-nightly', 'scheduled'],
    });

    const issueNumber = response.data.number;
    console.log(`✅ Created issue #${issueNumber}`);

    return {
      issueNumber,
      task: {
        id: `github-${issueNumber}`,
        source: 'github-issues' as TaskSource,
        title: 'Nightly: Repository Analysis and Improvements',
        description: taskDescription,
        priority: 'medium',
        createdAt: new Date(),
      },
    };
  } catch (error) {
    console.error('❌ Failed to create GitHub issue:', error);
    return null;
  }
}

/**
 * Close the nightly issue after completion
 */
async function closeNightlyIssue(
  issueNumber: number,
  config: Config,
  result: { success: boolean; error?: string }
): Promise<void> {
  if (!config.repository || !config.githubToken) {
    return;
  }

  const { Octokit } = await import('@octokit/rest');
  const octokit = new Octokit({ auth: config.githubToken });

  try {
    await octokit.rest.issues.createComment({
      owner: config.repository.owner,
      repo: config.repository.name,
      issue_number: issueNumber,
      body: `✅ Task completed by Agent Nightly workflow.\n\n**Status:** ${result.success ? 'Success' : 'Failed'}${result.error ? `\n**Error:** ${result.error}` : ''}`,
    });

    await octokit.rest.issues.update({
      owner: config.repository.owner,
      repo: config.repository.name,
      issue_number: issueNumber,
      state: 'closed',
    });

    console.log(`✅ Closed issue #${issueNumber}`);
  } catch (error) {
    console.error('⚠️  Failed to close GitHub issue:', error);
  }
}

/**
 * Determine which task sources to use based on CLI option
 */
function getSourcesToUse(sourceOption: string, config: Config): TaskSource[] {
  if (sourceOption === 'all') {
    return config.taskSources;
  }

  const validSources: TaskSource[] = ['github-issues', 'file', 'memory'];
  if (validSources.includes(sourceOption as TaskSource)) {
    return [sourceOption as TaskSource];
  }

  console.warn(`Unknown source: ${sourceOption}, using all sources`);
  return config.taskSources;
}

/**
 * Build report context from task and result
 */
function buildReportContext(
  task: Task,
  result: { success: boolean; output: string; error?: string; tokensUsed: number },
  duration: number,
  issueNumber?: number
): ReportContext {
  return {
    taskId: task.id,
    taskSource: task.source,
    success: result.success,
    output: result.output,
    error: result.error,
    tokensUsed: result.tokensUsed,
    duration,
    issueNumber,
  };
}

/**
 * Read options from CLI arguments and environment variables
 */
function readOptions(): NightlyOptions {
  const args = process.argv.slice(2);
  const options: NightlyOptions = {};

  // Read from environment variables first (for CI)
  options.taskDescription = process.env.TASK_DESCRIPTION || process.env.TASK;
  options.model = process.env.MODEL;
  options.taskSource = process.env.TASK_SOURCE as TaskSource;
  options.taskId = process.env.TASK_ID;
  options.dryRun = process.env.DRY_RUN === 'true';

  // Override with CLI arguments
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    switch (arg) {
      case '--task':
        options.taskDescription = args[++i];
        break;
      case '--model':
        options.model = args[++i];
        break;
      case '--task-source':
        options.taskSource = args[++i] as TaskSource;
        break;
      case '--task-id':
        options.taskId = args[++i];
        break;
      case '--dry-run':
        options.dryRun = true;
        break;
      case '--help':
        console.log(`
Usage: bun run apps/github-actions-agent/src/run-nightly.ts [options]

Options:
  --task <description>    Task description for the agent
  --model <model>         AI model to use
  --task-source <source>  Task source: github-issues, file, memory, all (default: all)
  --task-id <id>          Specific task ID to run
  --dry-run               Run without making real changes
  --help                  Show this help message

Environment Variables:
  TASK_DESCRIPTION        Task description (for CI)
  MODEL                   AI model to use
  TASK_SOURCE             Task source
  TASK_ID                 Specific task ID
  DRY_RUN                 Set to 'true' for dry run mode
        `);
        process.exit(0);
    }
  }

  return options;
}

// CLI interface when run directly
if (import.meta.main) {
  const options = readOptions();
  runNightlyAgent(options).catch((error) => {
    console.error('❌ Nightly agent failed:', error);
    process.exit(1);
  });
}
