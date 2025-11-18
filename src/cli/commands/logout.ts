/**
 * Logout Command
 *
 * Sign out and remove local credentials
 */

import chalk from 'chalk';
import ora from 'ora';
import { APIClient } from '../../client/api-client';
import { deleteCredentials, loadCredentials } from '../../client/auth';

export async function logoutCommand() {
  const spinner = ora('Signing out...').start();

  try {
    const credentials = await loadCredentials();

    if (!credentials) {
      spinner.warn(chalk.yellow('Not logged in'));
      return;
    }

    // Revoke tokens on server
    try {
      const client = new APIClient({
        apiUrl: credentials.apiUrl,
        accessToken: credentials.accessToken,
        refreshToken: credentials.refreshToken,
      });

      await client.logout();
    } catch (_error) {
      // Continue even if server logout fails
      console.warn(chalk.yellow('\n⚠ Failed to revoke tokens on server'));
    }

    // Delete local credentials
    await deleteCredentials();

    spinner.succeed(chalk.green('Logged out successfully'));
  } catch (error) {
    spinner.fail(chalk.red('Logout failed'));

    if (error instanceof Error) {
      console.error(chalk.red('Error:'), error.message);
    }

    process.exit(1);
  }
}
