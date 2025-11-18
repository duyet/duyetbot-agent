/**
 * Chat Command
 *
 * Interactive chat with duyetbot
 */

import chalk from 'chalk';
import ora from 'ora';
import * as readline from 'node:readline/promises';
import { loadCredentials, saveCredentials } from '../../client/auth';
import { APIClient } from '../../client/api-client';

interface ChatOptions {
  session?: string;
  model?: string;
  offline?: boolean;
}

export async function chatCommand(options: ChatOptions) {
  try {
    const credentials = await loadCredentials();

    if (!credentials && !options.offline) {
      console.log(chalk.red('✗ Not logged in'));
      console.log(chalk.gray('\nRun `duyetbot login` to authenticate'));
      console.log(chalk.gray('Or use `duyetbot chat --offline` for local-only mode\n'));
      return;
    }

    if (options.offline) {
      console.log(chalk.yellow('⚠ Running in offline mode (no cloud sync)\n'));
      // TODO: Implement offline mode with local agent
      console.log(chalk.red('Offline mode not implemented yet'));
      return;
    }

    if (!credentials) {
      console.log(chalk.red('No credentials found'));
      return;
    }

    // Create API client
    const client = new APIClient({
      apiUrl: credentials.apiUrl,
      accessToken: credentials.accessToken,
      refreshToken: credentials.refreshToken,
      onTokenRefresh: async (accessToken, refreshToken) => {
        await saveCredentials({
          apiUrl: credentials.apiUrl,
          accessToken,
          refreshToken,
        });
      },
    });

    // Get or create session
    let sessionId = options.session;
    if (!sessionId) {
      const spinner = ora('Creating new session...').start();
      const session = await client.createSession('CLI Chat');
      sessionId = session.id;
      spinner.succeed(chalk.green('Session created'));
    }

    console.log(chalk.blue('\n🤖 duyetbot'));
    console.log(chalk.gray(`Session: ${sessionId}`));
    if (options.model) {
      console.log(chalk.gray(`Model: ${options.model}`));
    }
    console.log(chalk.gray('\nType your message and press Enter'));
    console.log(chalk.gray('Commands: /quit, /clear, /model <name>\n'));

    // Start interactive loop
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: true,
    });

    let currentModel = options.model;
    let running = true;

    while (running) {
      try {
        const input = await rl.question(chalk.cyan('You: '));

        if (!input.trim()) {
          continue;
        }

        // Handle commands
        if (input.startsWith('/')) {
          const [command, ...args] = input.slice(1).split(' ');

          switch (command) {
            case 'quit':
            case 'exit':
              running = false;
              console.log(chalk.gray('\nGoodbye!\n'));
              break;

            case 'clear':
              console.clear();
              console.log(chalk.blue('🤖 duyetbot'));
              console.log(chalk.gray(`Session: ${sessionId}\n`));
              break;

            case 'model':
              if (args.length > 0) {
                currentModel = args.join(' ');
                console.log(chalk.green(`✓ Model set to: ${currentModel}\n`));
              } else {
                console.log(chalk.yellow('Usage: /model <model-name>\n'));
              }
              break;

            default:
              console.log(chalk.yellow(`Unknown command: ${command}\n`));
          }

          continue;
        }

        // Send message to agent
        process.stdout.write(chalk.magenta('Agent: '));

        let responseText = '';

        for await (const message of client.chat({
          sessionId,
          message: input,
          model: currentModel,
        })) {
          if (message.type === 'text') {
            process.stdout.write(message.text);
            responseText += message.text;
          } else if (message.type === 'tool_use') {
            process.stdout.write(
              chalk.gray(`\n[Using tool: ${message.name}]\n`)
            );
          }
        }

        process.stdout.write('\n\n');
      } catch (error) {
        if (error instanceof Error) {
          console.error(chalk.red('\nError:'), error.message);

          if (error.message.includes('401') || error.message.includes('token')) {
            console.log(chalk.gray('Your session expired. Please login again:\n'));
            console.log(chalk.cyan('  duyetbot logout'));
            console.log(chalk.cyan('  duyetbot login\n'));
            running = false;
          }
        }
      }
    }

    rl.close();
  } catch (error) {
    if (error instanceof Error) {
      console.error(chalk.red('Error:'), error.message);
    }
    process.exit(1);
  }
}
