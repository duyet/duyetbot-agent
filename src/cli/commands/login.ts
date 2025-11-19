/**
 * Login Command
 *
 * Authenticate with duyetbot cloud using OAuth device flow
 */

import chalk from 'chalk';
import ora from 'ora';
import { deviceFlowLogin, isAuthenticated } from '../../client/auth';

export async function loginCommand(options: { apiUrl: string }) {
  const spinner = ora();

  try {
    // Check if already authenticated
    if (await isAuthenticated()) {
      console.log(chalk.yellow('⚠ You are already logged in'));
      console.log(chalk.gray('Run `duyetbot logout` to sign out first\n'));
      return;
    }

    console.log(chalk.blue('🔐 duyetbot Authentication\n'));

    // Start device flow
    await deviceFlowLogin(options.apiUrl, (message) => {
      if (message.startsWith('Waiting')) {
        spinner.text = message;
        if (!spinner.isSpinning) {
          spinner.start();
        }
      } else {
        if (spinner.isSpinning) {
          spinner.stop();
        }
        console.log(message);
      }
    });

    spinner.succeed(chalk.green('Successfully authenticated!'));
    console.log(chalk.gray('\nYou can now use `duyetbot chat` to start a conversation\n'));
  } catch (error) {
    spinner.fail(chalk.red('Authentication failed'));

    if (error instanceof Error) {
      console.error(chalk.red('Error:'), error.message);
    }

    process.exit(1);
  }
}
