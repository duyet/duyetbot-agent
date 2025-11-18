/**
 * Chat Command
 *
 * Interactive chat with duyetbot
 */

import * as readline from 'node:readline/promises';
import chalk from 'chalk';
import ora from 'ora';
import { APIClient } from '../../client/api-client';
import { loadCredentials, saveCredentials } from '../../client/auth';
import { OfflineQueue, isOnline, syncQueue } from '../../client/offline-queue';
import type { QueuedMessage } from '../../client/offline-queue';

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

    // Initialize offline queue
    const offlineQueue = new OfflineQueue();

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

    // Check connectivity and sync queue
    const online = await isOnline(credentials.apiUrl);
    if (online) {
      const queueSize = await offlineQueue.size();
      if (queueSize > 0) {
        const spinner = ora(`Syncing ${queueSize} queued messages...`).start();
        try {
          const result = await syncQueue(offlineQueue, async (msg: QueuedMessage) => {
            // Send queued message
            for await (const _ of client.chat({
              sessionId: msg.sessionId,
              message: msg.message,
              model: msg.model,
            })) {
              // Consume stream
            }
          });
          spinner.succeed(
            chalk.green(`Synced: ${result.success} successful, ${result.failed} failed`)
          );
        } catch (_error) {
          spinner.fail(chalk.red('Failed to sync queue'));
        }
      }
    } else {
      console.log(chalk.yellow('⚠ No connection to server. Messages will be queued for later.\n'));
    }

    // Get or create session
    let sessionId = options.session;
    if (!sessionId && online) {
      const spinner = ora('Creating new session...').start();
      try {
        const session = await client.createSession('CLI Chat');
        sessionId = session.id;
        spinner.succeed(chalk.green('Session created'));
      } catch (_error) {
        spinner.fail(chalk.red('Failed to create session'));
        sessionId = `offline-${Date.now()}`;
        console.log(chalk.yellow(`Using offline session: ${sessionId}\n`));
      }
    } else if (!sessionId) {
      sessionId = `offline-${Date.now()}`;
      console.log(chalk.yellow(`Using offline session: ${sessionId}\n`));
    }

    console.log(chalk.blue('\n🤖 duyetbot'));
    console.log(chalk.gray(`Session: ${sessionId}`));
    console.log(chalk.gray(`Status: ${online ? chalk.green('online') : chalk.yellow('offline')}`));
    if (options.model) {
      console.log(chalk.gray(`Model: ${options.model}`));
    }
    console.log(chalk.gray('\nType your message and press Enter'));
    console.log(chalk.gray('Commands: /quit, /clear, /model <name>, /sync\n'));

    // Start interactive loop
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: true,
    });

    let currentModel = options.model;
    let running = true;
    let isCurrentlyOnline = online;

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

            case 'sync': {
              const spinner = ora('Checking connectivity...').start();
              isCurrentlyOnline = await isOnline(credentials.apiUrl);
              if (isCurrentlyOnline) {
                const queueSize = await offlineQueue.size();
                if (queueSize > 0) {
                  spinner.text = `Syncing ${queueSize} queued messages...`;
                  const result = await syncQueue(offlineQueue, async (msg: QueuedMessage) => {
                    for await (const _ of client.chat({
                      sessionId: msg.sessionId,
                      message: msg.message,
                      model: msg.model,
                    })) {
                      // Consume stream
                    }
                  });
                  spinner.succeed(
                    chalk.green(`Synced: ${result.success} successful, ${result.failed} failed`)
                  );
                } else {
                  spinner.succeed(chalk.green('Queue is empty'));
                }
              } else {
                spinner.fail(chalk.red('Still offline'));
              }
              break;
            }

            default:
              console.log(chalk.yellow(`Unknown command: ${command}\n`));
          }

          continue;
        }

        // Check if we're online before sending
        if (!isCurrentlyOnline) {
          isCurrentlyOnline = await isOnline(credentials.apiUrl);
        }

        // Send message to agent or queue if offline
        if (isCurrentlyOnline) {
          process.stdout.write(chalk.magenta('Agent: '));

          let _responseText = '';

          try {
            for await (const message of client.chat({
              sessionId,
              message: input,
              model: currentModel,
            })) {
              if (message.type === 'text') {
                process.stdout.write(message.text);
                _responseText += message.text;
              } else if (message.type === 'tool_use') {
                process.stdout.write(chalk.gray(`\n[Using tool: ${message.name}]\n`));
              }
            }

            process.stdout.write('\n\n');
          } catch (_error) {
            // If error occurs, queue the message
            console.log(chalk.yellow('\n⚠ Connection lost. Message queued for later.\n'));
            await offlineQueue.enqueue({
              sessionId,
              message: input,
              model: currentModel,
            });
            isCurrentlyOnline = false;
          }
        } else {
          // Queue message for later
          await offlineQueue.enqueue({
            sessionId,
            message: input,
            model: currentModel,
          });
          console.log(chalk.yellow('⚠ Offline - message queued. Use /sync to retry.\n'));
        }
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
