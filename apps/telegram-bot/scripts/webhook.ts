#!/usr/bin/env bun
/**
 * Telegram webhook configuration script
 *
 * Usage:
 *   bun run webhook:set   - Set webhook URL
 *   bun run webhook:info  - Get webhook info
 *   bun run webhook:delete - Delete webhook
 */

import { existsSync, readFileSync } from "fs";
import { resolve } from "path";

// Load .env.local if exists
const envPath = resolve(import.meta.dir, "../.env.local");
if (existsSync(envPath)) {
  const envContent = readFileSync(envPath, "utf-8");
  for (const line of envContent.split("\n")) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#")) {
      const [key, ...valueParts] = trimmed.split("=");
      const value = valueParts.join("=");
      if (key && value) {
        process.env[key] = value;
      }
    }
  }
}

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const WEBHOOK_URL = process.env.TELEGRAM_WEBHOOK_URL;
const WEBHOOK_SECRET = process.env.TELEGRAM_WEBHOOK_SECRET;
const AI_GATEWAY_URL = process.env.AI_GATEWAY_URL;
const MODEL = process.env.MODEL;
const ALLOWED_USERS = process.env.ALLOWED_USERS;

function showConfig() {
  console.log("Current configuration:");
  console.log(`  TELEGRAM_BOT_TOKEN:     ${BOT_TOKEN ? "✓ set" : "✗ not set"}`);
  console.log(`  TELEGRAM_WEBHOOK_URL:   ${WEBHOOK_URL || "not set"}`);
  console.log(
    `  TELEGRAM_WEBHOOK_SECRET: ${WEBHOOK_SECRET ? "✓ set" : "not set"}`,
  );
  console.log(`  AI_GATEWAY_URL:         ${AI_GATEWAY_URL || "not set"}`);
  console.log(
    `  MODEL:                  ${MODEL || "x-ai/grok-4.1-fast (default)"}`,
  );
  console.log(`  ALLOWED_USERS:          ${ALLOWED_USERS || "all users"}`);
}

if (!BOT_TOKEN && process.argv[2] !== "config") {
  console.error("Error: TELEGRAM_BOT_TOKEN is required");
  console.error("Create .env.local from .env.example and fill in your values");
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
  case "config":
    showConfig();
    break;
  default:
    console.log("Usage:");
    console.log("  bun run webhook:set    - Set webhook URL");
    console.log("  bun run webhook:info   - Get webhook info");
    console.log("  bun run webhook:delete - Delete webhook");
    console.log("  bun run webhook:config - Show current config");
    console.log("");
    console.log("Setup:");
    console.log("  1. Copy .env.example to .env.local");
    console.log("  2. Fill in your values");
    console.log("  3. Run: source .env.local");
}
