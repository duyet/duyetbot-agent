#!/usr/bin/env bun
/**
 * Unified deployment configuration script
 *
 * Usage:
 *   bun scripts/config.ts telegram      - Set secrets + configure webhook
 *   bun scripts/config.ts github        - Set secrets
 *   bun scripts/config.ts telegram info - Get webhook info
 *   bun scripts/config.ts telegram delete - Delete webhook
 *   bun scripts/config.ts show          - Show all config status
 */

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT_DIR = resolve(import.meta.dir, '..');

interface AppConfig {
  name: string;
  dir: string;
  workerName: string;
  secrets: Array<{ name: string; required: boolean }>;
  postDeploy?: () => Promise<void>;
}

const APPS: Record<string, AppConfig> = {
  telegram: {
    name: 'Telegram Bot',
    dir: 'apps/telegram-bot',
    workerName: 'duyetbot-telegram',
    secrets: [
      { name: 'GITHUB_TOKEN', required: false },
      { name: 'TELEGRAM_BOT_TOKEN', required: true },
      { name: 'TELEGRAM_WEBHOOK_SECRET', required: false },
      { name: 'TELEGRAM_ALLOWED_USERS', required: false },
      { name: 'AI_GATEWAY_API_KEY', required: false },
      { name: 'MEMORY_MCP_URL', required: false },
      { name: 'MEMORY_MCP_TOKEN', required: false },
    ],
  },
  github: {
    name: 'GitHub Bot',
    dir: 'apps/github-bot',
    workerName: 'duyetbot-github',
    secrets: [
      { name: 'GITHUB_TOKEN', required: true },
      { name: 'GITHUB_WEBHOOK_SECRET', required: false },
      { name: 'AI_GATEWAY_API_KEY', required: false },
      { name: 'MEMORY_MCP_URL', required: false },
      { name: 'MEMORY_MCP_TOKEN', required: false },
    ],
  },
};

function loadEnvFile(): Record<string, string> {
  const envPath = resolve(ROOT_DIR, '.env.local');
  const env: Record<string, string> = {};

  if (!existsSync(envPath)) {
    console.log(`  ⚠️  No .env.local found at ${envPath}`);
    return env;
  }

  const content = readFileSync(envPath, 'utf-8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const [key, ...valueParts] = trimmed.split('=');
      const value = valueParts.join('=');
      if (key && value) {
        env[key] = value;
      }
    }
  }

  return env;
}

async function setWranglerSecrets(config: AppConfig, env: Record<string, string>) {
  const cwd = resolve(ROOT_DIR, config.dir);

  console.log(`\nSetting Cloudflare secrets for ${config.name}...`);

  for (const { name, required } of config.secrets) {
    const value = env[name];

    if (!value) {
      if (required) {
        console.log(`  ${name}: ✗ skipped (not set in .env.local)`);
      }
      continue;
    }

    try {
      execFileSync('wrangler', ['secret', 'put', name], {
        cwd,
        input: value,
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      console.log(`  ${name}: ✓ set`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`  ${name}: ✗ failed - ${message}`);
      if (required) {
        throw error;
      }
    }
  }
}

async function showDeployedSecrets(config: AppConfig) {
  const cwd = resolve(ROOT_DIR, config.dir);

  console.log(`\nDeployed secrets for ${config.name}:`);

  try {
    const output = execFileSync('wrangler', ['secret', 'list', '--json'], {
      cwd,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    const secrets = JSON.parse(output) as Array<{ name: string; type: string }>;
    const secretNames = secrets.map((s) => s.name);

    for (const { name, required } of config.secrets) {
      const status = secretNames.includes(name) ? '✓ set' : required ? '✗ not set' : '(not set)';
      console.log(`  ${name.padEnd(24)} ${status}`);
    }
  } catch {
    console.log('  (could not fetch - run wrangler login first)');
  }
}

// Telegram-specific functions
async function setTelegramWebhook(env: Record<string, string>) {
  const botToken = env.TELEGRAM_BOT_TOKEN;
  const webhookUrl = env.TELEGRAM_WEBHOOK_URL;
  const webhookSecret = env.TELEGRAM_WEBHOOK_SECRET;

  if (!botToken) {
    console.error('\nError: TELEGRAM_BOT_TOKEN is required');
    process.exit(1);
  }

  if (!webhookUrl) {
    console.error('\nError: TELEGRAM_WEBHOOK_URL is required');
    console.error(
      'Example: TELEGRAM_WEBHOOK_URL=https://duyetbot-telegram.xxx.workers.dev/webhook'
    );
    process.exit(1);
  }

  console.log('\nSetting Telegram webhook...');

  const body: Record<string, string | boolean> = {
    url: webhookUrl,
    drop_pending_updates: true,
  };

  if (webhookSecret) {
    body.secret_token = webhookSecret;
  }

  const response = await fetch(`https://api.telegram.org/bot${botToken}/setWebhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const result = await response.json();
  console.log('Set webhook result:', JSON.stringify(result, null, 2));
}

async function getTelegramWebhookInfo(env: Record<string, string>) {
  const botToken = env.TELEGRAM_BOT_TOKEN;

  if (!botToken) {
    console.error('Error: TELEGRAM_BOT_TOKEN is required');
    process.exit(1);
  }

  const response = await fetch(`https://api.telegram.org/bot${botToken}/getWebhookInfo`);
  const result = await response.json();
  console.log('Webhook info:', JSON.stringify(result, null, 2));
}

async function deleteTelegramWebhook(env: Record<string, string>) {
  const botToken = env.TELEGRAM_BOT_TOKEN;

  if (!botToken) {
    console.error('Error: TELEGRAM_BOT_TOKEN is required');
    process.exit(1);
  }

  const response = await fetch(`https://api.telegram.org/bot${botToken}/deleteWebhook`, {
    method: 'POST',
  });

  const result = await response.json();
  console.log('Delete webhook result:', JSON.stringify(result, null, 2));
}

async function showConfig() {
  console.log('Configuration Status\n');

  const env = loadEnvFile();
  console.log('Root .env.local:');
  const allSecrets = new Set<string>();
  for (const config of Object.values(APPS)) {
    for (const { name } of config.secrets) {
      allSecrets.add(name);
    }
  }
  for (const name of allSecrets) {
    const status = env[name] ? '✓ set' : '(not set)';
    console.log(`  ${name.padEnd(24)} ${status}`);
  }

  for (const [_key, config] of Object.entries(APPS)) {
    console.log(`\n=== ${config.name} ===`);
    await showDeployedSecrets(config);
  }
}

async function configureApp(appKey: string, subCommand?: string) {
  const config = APPS[appKey];
  if (!config) {
    console.error(`Unknown app: ${appKey}`);
    console.error(`Available apps: ${Object.keys(APPS).join(', ')}`);
    process.exit(1);
  }

  const env = loadEnvFile();

  // Handle sub-commands for telegram
  if (appKey === 'telegram') {
    switch (subCommand) {
      case 'info':
        await getTelegramWebhookInfo(env);
        return;
      case 'delete':
        await deleteTelegramWebhook(env);
        return;
    }
  }

  // Default: set secrets
  await setWranglerSecrets(config, env);

  // Post-deploy actions
  if (appKey === 'telegram') {
    await setTelegramWebhook(env);
    console.log('\nVerifying webhook...');
    await getTelegramWebhookInfo(env);
  }
}

// Main
const [, , app, subCommand] = process.argv;

switch (app) {
  case 'telegram':
  case 'github':
    await configureApp(app, subCommand);
    break;
  case 'show':
    await showConfig();
    break;
  default:
    console.log('Unified Deployment Configuration');
    console.log('');
    console.log('Usage:');
    console.log('  bun scripts/config.ts telegram        - Set secrets + configure webhook');
    console.log('  bun scripts/config.ts github          - Set secrets');
    console.log('  bun scripts/config.ts telegram info   - Get webhook info');
    console.log('  bun scripts/config.ts telegram delete - Delete webhook');
    console.log('  bun scripts/config.ts show            - Show all config status');
}
