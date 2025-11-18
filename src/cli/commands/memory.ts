/**
 * Memory Command
 *
 * Manage conversation memory and sessions
 */

import chalk from 'chalk';
import ora from 'ora';
import { loadCredentials, saveCredentials } from '../../client/auth';
import { APIClient } from '../../client/api-client';

/**
 * List all sessions
 */
async function list() {
  const spinner = ora('Fetching sessions...').start();

  try {
    const credentials = await loadCredentials();

    if (!credentials) {
      spinner.fail(chalk.red('Not logged in'));
      console.log(chalk.gray('\nRun `duyetbot login` to authenticate\n'));
      return;
    }

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

    const sessions = await client.listSessions();

    spinner.succeed(chalk.green(`Found ${sessions.length} session(s)`));

    if (sessions.length === 0) {
      console.log(chalk.gray('\nNo sessions yet. Start chatting with `duyetbot chat`\n'));
      return;
    }

    console.log();
    for (const session of sessions) {
      console.log(chalk.cyan('ID:   '), session.id);
      console.log(chalk.gray('Title:'), session.title || '(untitled)');
      console.log(chalk.gray('Date: '), new Date(session.updatedAt).toLocaleString());
      console.log();
    }
  } catch (error) {
    spinner.fail(chalk.red('Failed to fetch sessions'));

    if (error instanceof Error) {
      console.error(chalk.red('Error:'), error.message);
    }

    process.exit(1);
  }
}

/**
 * Delete a session
 */
async function deleteSession(sessionId: string) {
  const spinner = ora(`Deleting session ${sessionId}...`).start();

  try {
    const credentials = await loadCredentials();

    if (!credentials) {
      spinner.fail(chalk.red('Not logged in'));
      console.log(chalk.gray('\nRun `duyetbot login` to authenticate\n'));
      return;
    }

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

    await client.deleteSession(sessionId);

    spinner.succeed(chalk.green('Session deleted'));
  } catch (error) {
    spinner.fail(chalk.red('Failed to delete session'));

    if (error instanceof Error) {
      console.error(chalk.red('Error:'), error.message);
    }

    process.exit(1);
  }
}

export const memoryCommand = {
  list,
  delete: deleteSession,
};
