#!/usr/bin/env bun

/**
 * Branch deployment script for Cloudflare Workers
 *
 * Uses wrangler versions upload for branch deploys.
 * This script exists because Bun's shell doesn't split interpolated strings,
 * so `wrangler versions upload` needs to be passed as separate arguments.
 *
 * Usage:
 *   bun scripts/deploy-branch.ts <app-name>
 *   bun scripts/deploy-branch.ts telegram
 *   bun scripts/deploy-branch.ts github
 *   bun scripts/deploy-branch.ts shared-agents
 *   bun scripts/deploy-branch.ts safety-kernel
 */

import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { $ } from 'bun';

const rootDir = resolve(import.meta.dir, '..');

// Map of app names to their directories
const APP_DIRS: Record<string, string> = {
  telegram: 'apps/telegram-bot',
  'telegram-bot': 'apps/telegram-bot',
  github: 'apps/github-bot',
  'github-bot': 'apps/github-bot',
  'shared-agents': 'apps/shared-agents',
  agents: 'apps/shared-agents',
  'safety-kernel': 'apps/safety-kernel',
  safety: 'apps/safety-kernel',
};

async function main() {
  const appName = process.argv[2];

  if (!appName) {
    console.error('Usage: bun scripts/deploy-branch.ts <app-name>');
    console.error('Apps: telegram, github, shared-agents, safety-kernel');
    process.exit(1);
  }

  const appDir = APP_DIRS[appName];
  if (!appDir) {
    console.error(`Unknown app: ${appName}`);
    console.error('Available apps: telegram, github, shared-agents, safety-kernel');
    process.exit(1);
  }

  const configPath = resolve(rootDir, appDir, 'wrangler.toml');
  if (!existsSync(configPath)) {
    console.error(`Config not found: ${configPath}`);
    process.exit(1);
  }

  // Get current branch name
  const branchResult = await $`git branch --show-current`.quiet();
  const branch = branchResult.stdout.toString().trim();

  console.log(`\n🚀 Deploying ${appName} to branch: ${branch}...\n`);

  // Build command array - versions and upload need to be separate arguments
  const fullCommand = [
    'bun',
    '--cwd',
    rootDir,
    'wrangler',
    'versions',
    'upload',
    `--message=Branch deploy: ${branch}`,
    `--tag=${branch}`,
    '--config',
    configPath,
  ];

  console.log(`Running: ${fullCommand.join(' ')}`);

  // Use Bun.spawn for proper argument handling
  const proc = Bun.spawn(fullCommand, {
    cwd: rootDir,
    stdout: 'inherit',
    stderr: 'inherit',
  });

  const exitCode = await proc.exited;
  if (exitCode !== 0) {
    throw new Error(`Wrangler command failed with exit code ${exitCode}`);
  }

  console.log('\n✅ Branch deployment complete!');
}

main().catch((error) => {
  console.error('\n❌ Deployment failed:', error.message);
  process.exit(1);
});
