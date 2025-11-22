#!/usr/bin/env bun
/**
 * Telegram webhook configuration script
 *
 * Usage:
 *   bun run webhook:set   - Set webhook URL
 *   bun run webhook:info  - Get webhook info
 *   bun run webhook:delete - Delete webhook
 */

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Load .env.local if exists
const envPath = resolve(import.meta.dir, '../.env.local');
if (existsSync(envPath)) {
  const envContent = readFileSync(envPath, 'utf-8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const [key, ...valueParts] = trimmed.split('=');
      const value = valueParts.join('=');
      if (key && value) {
        process.env[key] = value;
      }
    }
  }
}

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const WEBHOOK_URL = process.env.TELEGRAM_WEBHOOK_URL;
const WEBHOOK_SECRET = process.env.TELEGRAM_WEBHOOK_SECRET;
const AI_GATEWAY_NAME = process.env.AI_GATEWAY_NAME;
const MODEL = process.env.MODEL;
const ALLOWED_USERS = process.env.ALLOWED_USERS;

async function showConfig() {
  console.log('Local configuration (.env.local):');
  console.log(`  TELEGRAM_BOT_TOKEN:      ${BOT_TOKEN ? '✓ set' : '✗ not set'}`);
  console.log(`  TELEGRAM_WEBHOOK_URL:    ${WEBHOOK_URL || 'not set'}`);
  console.log(`  AI_GATEWAY_NAME:         ${AI_GATEWAY_NAME || 'not set'}`);
  console.log(`  TELEGRAM_WEBHOOK_SECRET: ${WEBHOOK_SECRET ? '✓ set' : 'not set'}`);
  console.log(`  MODEL:                   ${MODEL || 'x-ai/grok-4.1-fast (default)'}`);
  console.log(`  ALLOWED_USERS:           ${ALLOWED_USERS || 'all users'}`);

  // Fetch deployed secrets from Cloudflare
  console.log('\nDeployed secrets (from Cloudflare):');
  try {
    const output = execFileSync('wrangler', ['secret', 'list', '--json'], {
      cwd: resolve(import.meta.dir, '..'),
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    const secrets = JSON.parse(output) as Array<{ name: string; type: string }>;
    const secretNames = secrets.map((s) => s.name);

    const requiredSecrets = ['TELEGRAM_BOT_TOKEN'];
    const optionalSecrets = ['TELEGRAM_WEBHOOK_SECRET', 'ALLOWED_USERS'];

    for (const name of requiredSecrets) {
      const status = secretNames.includes(name) ? '✓ set' : '✗ not set';
      console.log(`  ${name.padEnd(24)} ${status}`);
    }
    for (const name of optionalSecrets) {
      const status = secretNames.includes(name) ? '✓ set' : '(not set)';
      console.log(`  ${name.padEnd(24)} ${status}`);
    }
  } catch {
    console.log('  (could not fetch - run wrangler login first)');
  }
}

if (!BOT_TOKEN && process.argv[2] !== 'config') {
  console.error('Error: TELEGRAM_BOT_TOKEN is required');
  console.error('Create .env.local from .env.example and fill in your values');
  process.exit(1);
}

const API_BASE = `https://api.telegram.org/bot${BOT_TOKEN}`;

async function setWranglerSecrets() {
  const cwd = resolve(import.meta.dir, '..');
  const secrets: Array<{
    name: string;
    value: string | undefined;
    required: boolean;
  }> = [
    { name: 'TELEGRAM_BOT_TOKEN', value: BOT_TOKEN, required: true },
    { name: 'TELEGRAM_WEBHOOK_SECRET', value: WEBHOOK_SECRET, required: false },
    { name: 'ALLOWED_USERS', value: ALLOWED_USERS, required: false },
  ];

  console.log('\nSetting Cloudflare secrets...');

  for (const { name, value, required } of secrets) {
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

async function setWebhook() {
  if (!WEBHOOK_URL) {
    console.error('Error: TELEGRAM_WEBHOOK_URL is required');
    console.error(
      'Example: export TELEGRAM_WEBHOOK_URL=https://duyetbot-telegram.xxx.workers.dev/webhook'
    );
    process.exit(1);
  }

  // Set Cloudflare secrets first
  await setWranglerSecrets();

  // Set Telegram webhook
  console.log('\nSetting Telegram webhook...');
  const body: Record<string, string | boolean> = {
    url: WEBHOOK_URL,
    drop_pending_updates: true,
  };
  if (WEBHOOK_SECRET) {
    body.secret_token = WEBHOOK_SECRET;
  }

  const response = await fetch(`${API_BASE}/setWebhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const result = await response.json();
  console.log('Set webhook result:', JSON.stringify(result, null, 2));
}

async function getWebhookInfo() {
  const response = await fetch(`${API_BASE}/getWebhookInfo`);
  const result = await response.json();
  console.log('Webhook info:', JSON.stringify(result, null, 2));
}

async function deleteWebhook() {
  const response = await fetch(`${API_BASE}/deleteWebhook`, {
    method: 'POST',
  });
  const result = await response.json();
  console.log('Delete webhook result:', JSON.stringify(result, null, 2));
}

const command = process.argv[2];

switch (command) {
  case 'set':
    await setWebhook();
    break;
  case 'info':
    await getWebhookInfo();
    break;
  case 'delete':
    await deleteWebhook();
    break;
  case 'config':
    showConfig();
    break;
  default:
    console.log('Usage:');
    console.log('  bun run webhook:set    - Set webhook URL');
    console.log('  bun run webhook:info   - Get webhook info');
    console.log('  bun run webhook:delete - Delete webhook');
    console.log('  bun run webhook:config - Show current config');
    console.log('');
    console.log('Setup:');
    console.log('  1. Copy .env.example to .env.local');
    console.log('  2. Fill in your values');
    console.log('  3. Run: source .env.local');
}
