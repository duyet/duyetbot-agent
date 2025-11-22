#!/usr/bin/env bun
/**
 * Telegram webhook configuration script
 *
 * Usage:
 *   bun run webhook:set   - Set webhook URL
 *   bun run webhook:info  - Get webhook info
 *   bun run webhook:delete - Delete webhook
 */

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const WEBHOOK_URL = process.env.TELEGRAM_WEBHOOK_URL;
const WEBHOOK_SECRET = process.env.TELEGRAM_WEBHOOK_SECRET;

if (!BOT_TOKEN) {
  console.error("Error: TELEGRAM_BOT_TOKEN is required");
  console.error("Set it with: export TELEGRAM_BOT_TOKEN=your_token");
  process.exit(1);
}

const API_BASE = `https://api.telegram.org/bot${BOT_TOKEN}`;

async function setWebhook() {
  if (!WEBHOOK_URL) {
    console.error("Error: TELEGRAM_WEBHOOK_URL is required");
    console.error(
      "Example: export TELEGRAM_WEBHOOK_URL=https://duyetbot-telegram.xxx.workers.dev/webhook",
    );
    process.exit(1);
  }

  const body: Record<string, string> = { url: WEBHOOK_URL };
  if (WEBHOOK_SECRET) {
    body.secret_token = WEBHOOK_SECRET;
  }

  const response = await fetch(`${API_BASE}/setWebhook`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const result = await response.json();
  console.log("Set webhook result:", JSON.stringify(result, null, 2));
}

async function getWebhookInfo() {
  const response = await fetch(`${API_BASE}/getWebhookInfo`);
  const result = await response.json();
  console.log("Webhook info:", JSON.stringify(result, null, 2));
}

async function deleteWebhook() {
  const response = await fetch(`${API_BASE}/deleteWebhook`, {
    method: "POST",
  });
  const result = await response.json();
  console.log("Delete webhook result:", JSON.stringify(result, null, 2));
}

const command = process.argv[2];

switch (command) {
  case "set":
    await setWebhook();
    break;
  case "info":
    await getWebhookInfo();
    break;
  case "delete":
    await deleteWebhook();
    break;
  default:
    console.log("Usage:");
    console.log("  bun run webhook:set    - Set webhook URL");
    console.log("  bun run webhook:info   - Get webhook info");
    console.log("  bun run webhook:delete - Delete webhook");
    console.log("");
    console.log("Environment variables:");
    console.log("  TELEGRAM_BOT_TOKEN     - Bot token (required)");
    console.log("  TELEGRAM_WEBHOOK_URL   - Webhook URL (required for set)");
    console.log("  TELEGRAM_WEBHOOK_SECRET - Secret token (optional)");
}
