/**
 * Whoami Command
 *
 * Show current user information
 */

import chalk from 'chalk';
import ora from 'ora';
import { APIClient } from '../../client/api-client';
import { loadCredentials, saveCredentials } from '../../client/auth';

export async function whoamiCommand() {
  const spinner = ora('Fetching user information...').start();

  try {
    const credentials = await loadCredentials();

    if (!credentials) {
      spinner.fail(chalk.red('Not logged in'));
      console.log(chalk.gray('\nRun `duyetbot login` to authenticate\n'));
      return;
    }

    // Create API client
    const client = new APIClient({
      apiUrl: credentials.apiUrl,
      accessToken: credentials.accessToken,
      refreshToken: credentials.refreshToken,
      onTokenRefresh: async (accessToken, refreshToken) => {
        // Save new tokens
        await saveCredentials({
          apiUrl: credentials.apiUrl,
          accessToken,
          refreshToken,
        });
      },
    });

    // Get user profile
    const profile = await client.getProfile();

    spinner.succeed(chalk.green('User information:'));

    console.log();
    console.log(chalk.cyan('ID:      '), profile.id);
    console.log(chalk.cyan('Email:   '), profile.email);
    console.log(chalk.cyan('Name:    '), profile.name || chalk.gray('(not set)'));
    console.log(chalk.cyan('Provider:'), profile.provider);
    console.log(chalk.cyan('Joined:  '), new Date(profile.createdAt).toLocaleDateString());
    console.log();
    console.log(chalk.gray('API URL: '), credentials.apiUrl);
    console.log();
  } catch (error) {
    spinner.fail(chalk.red('Failed to fetch user information'));

    if (error instanceof Error) {
      console.error(chalk.red('Error:'), error.message);

      if (error.message.includes('401') || error.message.includes('token')) {
        console.log(chalk.gray('\nYour session may have expired. Try logging in again:\n'));
        console.log(chalk.cyan('  duyetbot logout'));
        console.log(chalk.cyan('  duyetbot login\n'));
      }
    }

    process.exit(1);
  }
}
