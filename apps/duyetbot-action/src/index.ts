#!/usr/bin/env bun
import { Command } from 'commander';
import { AgentLoop } from './agent/loop.js';
import { type Config, loadConfig } from './config.js';
import { CombinedReporter } from './reporter/index.js';
import type { ReportContext } from './reporter/types.js';
import { TaskPicker } from './tasks/picker.js';
import type { Task, TaskSource } from './tasks/types.js';

const program = new Command();

program
  .name('github-actions-agent')
  .description('Self-improving AI agent for GitHub Actions')
  .version('0.0.1');

program
  .option('-s, --source <source>', 'Task source (all, github-issues, file, memory)', 'all')
  .option('-t, --task <taskId>', 'Specific task ID to run')
  .option('--dry-run', 'Run without making real changes')
  .option('--continuous', 'Enable continuous mode - process all available tasks')
  .action(async (options) => {
    console.log('🤖 GitHub Actions Agent starting...');
    const startTime = Date.now();

    try {
      // Load and validate configuration
      const config = loadConfig();

      // Override dry-run from CLI if provided
      if (options.dryRun) {
        (config as { dryRun: boolean }).dryRun = true;
        console.log('⚠️  Dry run mode enabled');
      }

      // Enable continuous mode if CLI flag or config
      const continuousMode = options.continuous || config.continuous?.enabled;
      if (continuousMode) {
        (config as { continuous: typeof config.continuous }).continuous = {
          enabled: true,
          maxTasks: config.continuous?.maxTasks ?? 100,
          delayBetweenTasks: config.continuous?.delayBetweenTasks ?? 5000,
          closeIssuesAfterMerge: config.continuous?.closeIssuesAfterMerge ?? true,
          stopOnFirstFailure: config.continuous?.stopOnFirstFailure ?? false,
        };
        // Update autoMerge config to include closeIssueAfterMerge
        if (config.autoMerge?.enabled) {
          const closeIssues = config.continuous?.closeIssuesAfterMerge ?? true;
          config.autoMerge.closeIssueAfterMerge = closeIssues;
        }
        console.log('🔄 Continuous mode enabled - will process all tasks');
      }

      console.log(`📋 Task source: ${options.source}`);
      if (options.task) {
        console.log(`🎯 Specific task: ${options.task}`);
      }

      // Determine which sources to use
      const sources = getSourcesToUse(options.source, config);
      console.log(`📌 Active sources: ${sources.join(', ')}`);

      // Initialize task picker
      const picker = new TaskPicker({
        sources,
        githubToken: config.githubToken,
        repository: config.repository,
        tasksFilePath: 'TASKS.md',
        memoryMcpUrl: config.memoryMcpUrl,
      });

      // Run in continuous mode or single task mode
      if (continuousMode) {
        await runContinuousMode(config, picker, options.task);
      } else {
        await runSingleTask(config, picker, options.task, startTime);
      }
    } catch (error) {
      console.error('❌ Agent failed:', error);
      process.exit(1);
    }
  });

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
 * Pick a task to work on
 * If taskId is provided, find that specific task
 * Otherwise, pick the next highest priority task
 */
async function pickTask(picker: TaskPicker, taskId?: string): Promise<Task | null> {
  if (taskId) {
    // Find specific task from pending tasks
    const allTasks = await picker.listAllPending();
    return allTasks.find((t) => t.id === taskId) || null;
  }

  return picker.pickNext();
}

/**
 * Build report context from task and result
 */
function buildReportContext(
  task: Task,
  result: { success: boolean; output: string; error?: string; tokensUsed: number; verificationPassed?: boolean },
  duration: number
): ReportContext {
  // Extract issue number from GitHub issue task ID (format: github-{number})
  let issueNumber: number | undefined;
  if (task.source === 'github-issues') {
    const match = task.id.match(/github-(\d+)/);
    if (match?.[1]) {
      issueNumber = parseInt(match[1], 10);
    }
  }

  // Build base context
  const context: ReportContext = {
    taskId: task.id,
    taskSource: task.source,
    success: result.success,
    output: result.output,
    error: result.error,
    tokensUsed: result.tokensUsed,
    duration,
    issueNumber,
  };

  // Only include verificationPassed if defined (required by exactOptionalPropertyTypes)
  if (result.verificationPassed !== undefined) {
    context.verificationPassed = result.verificationPassed;
  }

  return context;
}

/**
 * Run a single task and report results
 */
async function runSingleTask(
  config: Config,
  picker: TaskPicker,
  taskId: string | undefined,
  sessionStartTime: number
): Promise<void> {
  // Pick task to work on
  const task = await pickTask(picker, taskId);
  if (!task) {
    console.log('📭 No tasks available');
    return;
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

  const duration = Date.now() - sessionStartTime;

  // Build report context
  const reportContext = buildReportContext(task, result, duration);

  // Initialize reporter and report results
  if (config.repository) {
    const reporter = new CombinedReporter({
      githubToken: config.githubToken,
      owner: config.repository.owner,
      repo: config.repository.name,
      logDir: config.logDir,
      dryRun: config.dryRun,
      autoMerge: config.autoMerge,
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
 * Run in continuous mode - process all available tasks
 */
async function runContinuousMode(
  config: Config,
  picker: TaskPicker,
  startTaskId: string | undefined
): Promise<void> {
  const continuousConfig = config.continuous!;
  const maxTasks = continuousConfig.maxTasks;
  const delayBetweenTasks = continuousConfig.delayBetweenTasks;
  const stopOnFirstFailure = continuousConfig.stopOnFirstFailure;

  let tasksCompleted = 0;
  let totalTokensUsed = 0;
  let totalDuration = 0;
  const startTime = Date.now();

  console.log(`\n🔄 Continuous mode started`);
  console.log(`   Max tasks: ${maxTasks}`);
  console.log(`   Stop on first failure: ${stopOnFirstFailure ? 'Yes' : 'No'}`);
  console.log(`   Delay between tasks: ${delayBetweenTasks}ms\n`);

  // If starting with a specific task, process it first
  if (startTaskId) {
    const task = await pickTask(picker, startTaskId);
    if (task) {
      const result = await processTask(config, picker, task, tasksCompleted + 1);
      tasksCompleted++;
      totalTokensUsed += result.tokensUsed;
      totalDuration += result.duration;

      if (!result.success && stopOnFirstFailure) {
        console.log('\n⚠️  Stopping due to failure (stopOnFirstFailure enabled)');
        await printContinuousSummary(tasksCompleted, totalTokensUsed, totalDuration, startTime);
        return;
      }
    }
  }

  // Continue processing tasks until none remain or max tasks reached
  while (tasksCompleted < maxTasks) {
    // Brief delay before picking next task
    if (tasksCompleted > 0 || startTaskId) {
      console.log(`\n⏳ Waiting ${delayBetweenTasks}ms before next task...\n`);
      await new Promise((resolve) => setTimeout(resolve, delayBetweenTasks));
    }

    // Pick next task
    const task = await picker.pickNext();
    if (!task) {
      console.log('\n📭 No more tasks available');
      break;
    }

    // Process the task
    const result = await processTask(config, picker, task, tasksCompleted + 1);
    tasksCompleted++;
    totalTokensUsed += result.tokensUsed;
    totalDuration += result.duration;

    // Stop if task failed and stopOnFirstFailure is enabled
    if (!result.success && stopOnFirstFailure) {
      console.log('\n⚠️  Stopping due to failure (stopOnFirstFailure enabled)');
      break;
    }
  }

  await printContinuousSummary(tasksCompleted, totalTokensUsed, totalDuration, startTime);
}

/**
 * Process a single task in continuous mode
 */
async function processTask(
  config: Config,
  picker: TaskPicker,
  task: Task,
  taskNumber: number
): Promise<{ success: boolean; tokensUsed: number; duration: number }> {
  const taskStartTime = Date.now();

  console.log(`\n${'='.repeat(60)}`);
  console.log(`🎯 Task ${taskNumber}: ${task.title}`);
  console.log(`   Source: ${task.source} | Priority: ${task.priority} | ID: ${task.id}`);
  console.log(`${'='.repeat(60)}\n`);

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

  const duration = Date.now() - taskStartTime;

  // Build report context
  const reportContext = buildReportContext(task, result, duration);

  // Initialize reporter and report results
  if (config.repository) {
    const reporter = new CombinedReporter({
      githubToken: config.githubToken,
      owner: config.repository.owner,
      repo: config.repository.name,
      logDir: config.logDir,
      dryRun: config.dryRun,
      autoMerge: config.autoMerge,
    });

    console.log('\n📤 Reporting results...');
    await reporter.report(reportContext);
  }

  // Update task status
  if (result.success) {
    await picker.markComplete(task.id);
    console.log(`\n✅ Task ${taskNumber} completed successfully`);
  } else {
    await picker.markFailed(task.id, result.error || 'Unknown error');
    console.log(`\n❌ Task ${taskNumber} failed: ${result.error}`);
  }

  // Print task summary
  console.log('\n📊 Task Summary:');
  console.log(`   Duration: ${(duration / 1000).toFixed(2)}s`);
  console.log(`   Tokens: ${result.tokensUsed}`);
  console.log(`   Steps: ${result.stepsCompleted}`);

  return {
    success: result.success,
    tokensUsed: result.tokensUsed,
    duration,
  };
}

/**
 * Print continuous mode summary
 */
async function printContinuousSummary(
  tasksCompleted: number,
  totalTokensUsed: number,
  totalDuration: number,
  startTime: number
): Promise<void> {
  const totalSessionTime = Date.now() - startTime;

  console.log(`\n${'='.repeat(60)}`);
  console.log('📊 Continuous Mode Summary');
  console.log(`${'='.repeat(60)}`);
  console.log(`   Tasks completed: ${tasksCompleted}`);
  console.log(`   Total tokens used: ${totalTokensUsed}`);
  console.log(`   Total task time: ${(totalDuration / 1000).toFixed(2)}s`);
  console.log(`   Total session time: ${(totalSessionTime / 1000).toFixed(2)}s`);
  console.log(`   Avg tokens per task: ${tasksCompleted > 0 ? Math.round(totalTokensUsed / tasksCompleted) : 0}`);
  console.log(`   Avg time per task: ${tasksCompleted > 0 ? (totalDuration / tasksCompleted / 1000).toFixed(2) : 'N/A'}s`);
  console.log(`${'='.repeat(60)}\n`);
}

program.parse();
