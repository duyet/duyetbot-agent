#!/usr/bin/env tsx

/**
 * duyetbot CLI
 *
 * Command-line interface for interacting with duyetbot agent
 */

import chalk from 'chalk';
import { Command } from 'commander';
import { chatCommand } from './commands/chat';
import { loginCommand } from './commands/login';
import { logoutCommand } from './commands/logout';
import { memoryCommand } from './commands/memory';
import { syncCommand } from './commands/sync';
import { whoamiCommand } from './commands/whoami';

const program = new Command();

program.name('duyetbot').description('Autonomous AI agent with persistent memory').version('0.1.0');

// Login command
program
  .command('login')
  .description('Authenticate with duyetbot cloud')
  .option('--api-url <url>', 'API URL', process.env.DUYETBOT_API_URL || 'https://api.duyetbot.dev')
  .action(loginCommand);

// Logout command
program
  .command('logout')
  .description('Sign out and remove local credentials')
  .action(logoutCommand);

// Whoami command
program.command('whoami').description('Show current user information').action(whoamiCommand);

// Chat command
program
  .command('chat')
  .description('Start interactive chat session')
  .option('-s, --session <id>', 'Continue existing session')
  .option('-m, --model <model>', 'LLM model to use')
  .option('--offline', 'Run in offline mode (no cloud sync)')
  .action(chatCommand);

// Memory command
program
  .command('memory')
  .description('Manage conversation memory')
  .addCommand(new Command('list').description('List all sessions').action(memoryCommand.list))
  .addCommand(
    new Command('delete')
      .description('Delete a session')
      .argument('<session-id>', 'Session ID to delete')
      .action(memoryCommand.delete)
  );

// Sync command
program
  .command('sync')
  .description('Sync local sessions with cloud')
  .option('--pull', 'Pull sessions from cloud')
  .option('--push', 'Push local sessions to cloud')
  .action(syncCommand);

// Run command (one-shot execution)
program
  .command('run')
  .description('Execute a single command')
  .argument('<prompt>', 'Prompt to execute')
  .option('-m, --model <model>', 'LLM model to use')
  .option('--offline', 'Run offline without cloud sync')
  .action(async (prompt: string, options) => {
    console.log(chalk.yellow('Running:'), prompt);
    console.log(chalk.gray('Options:'), options);
    // TODO: Implement one-shot execution
    console.log(chalk.red('Not implemented yet'));
  });

// Error handling
program.exitOverride();

try {
  program.parse(process.argv);
} catch (error) {
  if (error instanceof Error) {
    console.error(chalk.red('Error:'), error.message);
  }
  process.exit(1);
}

// Show help if no command provided
if (!process.argv.slice(2).length) {
  program.outputHelp();
}
