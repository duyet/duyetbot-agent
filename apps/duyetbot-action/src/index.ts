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

      // Pick task to work on
      const task = await pickTask(picker, options.task);
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

      const duration = Date.now() - startTime;

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
  result: { success: boolean; output: string; error?: string; tokensUsed: number },
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

program.parse();
