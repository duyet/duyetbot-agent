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

/// <reference types="bun-types" />

import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { $ } from 'bun';

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
      { name: 'AI_GATEWAY_API_KEY', required: true },
      { name: 'TELEGRAM_BOT_TOKEN', required: true },
      { name: 'TELEGRAM_WEBHOOK_SECRET', required: false },
      { name: 'TELEGRAM_ALLOWED_USERS', required: false },
      { name: 'GITHUB_TOKEN', required: false },
      { name: 'MEMORY_MCP_URL', required: false },
      { name: 'MEMORY_MCP_TOKEN', required: false },
      { name: 'MEM0_API_KEY', required: false },
    ],
  },
  github: {
    name: 'GitHub Bot',
    dir: 'apps/github-bot',
    workerName: 'duyetbot-github',
    secrets: [
      { name: 'AI_GATEWAY_API_KEY', required: true },
      { name: 'GITHUB_TOKEN', required: true },
      { name: 'GITHUB_WEBHOOK_SECRET', required: false },
      { name: 'MEMORY_MCP_URL', required: false },
      { name: 'MEMORY_MCP_TOKEN', required: false },
      { name: 'MEM0_API_KEY', required: false },
    ],
  },
  'memory-mcp': {
    name: 'Memory MCP',
    dir: 'apps/memory-mcp',
    workerName: 'duyetbot-memory',
    secrets: [
      { name: 'GITHUB_CLIENT_ID', required: true },
      { name: 'GITHUB_CLIENT_SECRET', required: true },
    ],
  },
  agents: {
    name: 'Shared Agents',
    dir: 'apps/shared-agents',
    workerName: 'duyetbot-shared-agents',
    secrets: [
      { name: 'AI_GATEWAY_API_KEY', required: true },
      { name: 'TELEGRAM_BOT_TOKEN', required: true },
      { name: 'TELEGRAM_WEBHOOK_SECRET', required: false },
      { name: 'TELEGRAM_ALLOWED_USERS', required: false },
      { name: 'GITHUB_TOKEN', required: true },
      { name: 'GITHUB_WEBHOOK_SECRET', required: false },
      { name: 'MEMORY_MCP_URL', required: false },
      { name: 'MEMORY_MCP_TOKEN', required: false },
      { name: 'MEM0_API_KEY', required: false },
    ],
  },
  'safety-kernel': {
    name: 'Safety Kernel',
    dir: 'apps/safety-kernel',
    workerName: 'duyetbot-safety-kernel',
    secrets: [
      { name: 'ADMIN_OVERRIDE_TOKEN', required: true },
      { name: 'CF_API_TOKEN', required: true },
      { name: 'CF_ACCOUNT_ID', required: true },
      { name: 'TELEGRAM_BOT_TOKEN', required: true },
      { name: 'TELEGRAM_ADMIN_CHAT_ID', required: true },
    ],
  },
  web: {
    name: 'Web App',
    dir: 'apps/web',
    workerName: 'duyetbot-web',
    secrets: [
      { name: 'SESSION_SECRET', required: false },
      { name: 'AI_GATEWAY_API_KEY', required: true },
      { name: 'GITHUB_TOKEN', required: true },
      { name: 'GITHUB_CLIENT_ID', required: true },
      { name: 'GITHUB_CLIENT_SECRET', required: true },
    ],
  },
};

async function loadEnvFile(): Promise<Record<string, string>> {
  // Priority (highest wins): process.env > .env.local > .env
  const env: Record<string, string> = {};

  const envPath = resolve(ROOT_DIR, '.env');
  const envLocalPath = resolve(ROOT_DIR, '.env.local');

  const envFile = Bun.file(envPath);
  const envLocalFile = Bun.file(envLocalPath);

  const loadedFiles: string[] = [];

  const parseEnvContent = (content: string) => {
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
  };

  // Load .env (lowest priority)
  if (await envFile.exists()) {
    parseEnvContent(await envFile.text());
    loadedFiles.push('.env');
  }

  // Override with .env.local
  if (await envLocalFile.exists()) {
    parseEnvContent(await envLocalFile.text());
    loadedFiles.push('.env.local');
  }

  // Override with process.env (highest priority)
  for (const [key, value] of Object.entries(process.env)) {
    if (value !== undefined) {
      env[key] = value;
    }
  }
  loadedFiles.push('process.env');

  console.log(`  Loaded: ${loadedFiles.join(' → ')}`);

  return env;
}

async function setWranglerSecrets(config: AppConfig, env: Record<string, string>) {
  const cwd = resolve(ROOT_DIR, config.dir);

  console.log(`\nSetting Cloudflare secrets for ${config.name}...`);

  // Build secrets object for bulk upload
  const secretsToSet: Record<string, string> = {};
  const notSet: string[] = [];

  for (const { name } of config.secrets) {
    const value = env[name];

    if (!value) {
      notSet.push(name);
      continue;
    }

    secretsToSet[name] = value;
  }

  // Report secrets not found in .env.local
  for (const name of notSet) {
    console.log(`  ${name}: ○ not set in .env.local`);
  }

  // Use bulk upload if we have secrets to set
  if (Object.keys(secretsToSet).length > 0) {
    const tempFile = resolve(tmpdir(), `wrangler-secrets-${Date.now()}.json`);

    try {
      // Write secrets to temp file
      await Bun.write(tempFile, JSON.stringify(secretsToSet));

      // Bulk upload all secrets at once
      await $`wrangler secret bulk ${tempFile}`.cwd(cwd).quiet();

      // Report success for each secret with masked value
      for (const [name, value] of Object.entries(secretsToSet)) {
        const masked = value.length > 8 ? `${value.slice(0, 4)}...${value.slice(-4)}` : '****';
        console.log(`  ${name}: ✓ set (${masked})`);
      }

      console.log(`\n  ✓ Bulk uploaded ${Object.keys(secretsToSet).length} secrets`);

      // Verify by listing deployed secrets
      console.log('\n  Verifying deployed secrets...');
      const listOutput = await $`wrangler secret list --format json`.cwd(cwd).json();
      const deployedSecrets = listOutput as Array<{
        name: string;
        type: string;
      }>;
      const deployedNames = deployedSecrets.map((s) => s.name);

      for (const name of Object.keys(secretsToSet)) {
        const status = deployedNames.includes(name) ? '✓' : '✗';
        console.log(`    ${status} ${name}`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`  ✗ Bulk upload failed: ${message}`);
      throw error;
    } finally {
      // Clean up temp file
      await $`rm -f ${tempFile}`.nothrow().quiet();
    }
  } else {
    console.log('  (no secrets to set)');
  }
}

async function showDeployedSecrets(config: AppConfig) {
  const cwd = resolve(ROOT_DIR, config.dir);

  console.log(`\nDeployed secrets for ${config.name}:`);

  try {
    const secrets = (await $`wrangler secret list --format json`.cwd(cwd).json()) as Array<{
      name: string;
      type: string;
    }>;
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

  const env = await loadEnvFile();
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

  const env = await loadEnvFile();

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
  case 'memory-mcp':
  case 'agents':
  case 'safety-kernel':
  case 'web':
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
    console.log('  bun scripts/config.ts web             - Set secrets');
    console.log('  bun scripts/config.ts telegram info   - Get webhook info');
    console.log('  bun scripts/config.ts telegram delete - Delete webhook');
    console.log('  bun scripts/config.ts show            - Show all config status');
}
