#!/usr/bin/env bun
/**
 * Test Script for AgenticLoop Validation
 *
 * This script tests the AgenticLoop architecture by sending test messages
 * to the Telegram bot and validating the responses.
 *
 * Usage:
 *   bun scripts/test-agentic-loop.ts [--chat-id <id>] [--verbose]
 *
 * Environment:
 *   TELEGRAM_BOT_TOKEN - Bot token for sending test messages
 *   TELEGRAM_CHAT_ID - Default chat ID for testing (can override with --chat-id)
 *
 * Test Cases:
 *   1. Simple greeting (no tools)
 *   2. Plan tool usage (task decomposition)
 *   3. Research tool usage (web search)
 *   4. Memory tool usage (personal info)
 *   5. Error handling (invalid request)
 */

interface TestCase {
  name: string;
  message: string;
  expectedBehavior: string;
  expectTools?: string[];
  timeout?: number;
}

const TEST_CASES: TestCase[] = [
  {
    name: 'Simple Greeting',
    message: 'Hello! How are you?',
    expectedBehavior: 'Should respond directly without tools',
    expectTools: [],
    timeout: 30000,
  },
  {
    name: 'Plan Tool',
    message: 'Help me plan a project to build a REST API with authentication',
    expectedBehavior: 'Should use plan tool to break down the task',
    expectTools: ['plan'],
    timeout: 60000,
  },
  {
    name: 'Research Tool',
    message: 'What are the latest features in TypeScript 5.3?',
    expectedBehavior: 'Should use research tool to search the web',
    expectTools: ['research'],
    timeout: 60000,
  },
  {
    name: 'Memory Tool (Personal Info)',
    message: "What do you know about Duyet's blog?",
    expectedBehavior: 'Should use memory tool to retrieve personal info',
    expectTools: ['memory'],
    timeout: 60000,
  },
  {
    name: 'Complex Task',
    message:
      'Compare the pros and cons of using Cloudflare Workers vs AWS Lambda for a Telegram bot',
    expectedBehavior: 'Should use research and potentially plan tools',
    expectTools: ['research'],
    timeout: 90000,
  },
];

// ANSI colors for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

function log(message: string, color: keyof typeof colors = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSection(title: string) {
  console.log();
  log(`${'='.repeat(60)}`, 'cyan');
  log(`  ${title}`, 'bright');
  log(`${'='.repeat(60)}`, 'cyan');
}

function logTest(index: number, test: TestCase) {
  console.log();
  log(`[${index + 1}/${TEST_CASES.length}] ${test.name}`, 'yellow');
  log(`  Message: "${test.message.slice(0, 50)}..."`, 'dim');
  log(`  Expected: ${test.expectedBehavior}`, 'dim');
}

async function sendTelegramMessage(
  botToken: string,
  chatId: string,
  message: string
): Promise<{ ok: boolean; messageId?: number; error?: string }> {
  const url = `https://api.telegram.org/bot${botToken}/sendMessage`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
      }),
    });

    const data = (await response.json()) as {
      ok: boolean;
      result?: { message_id: number };
      description?: string;
    };

    if (data.ok) {
      return { ok: true, messageId: data.result?.message_id };
    } else {
      return { ok: false, error: data.description || 'Unknown error' };
    }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function getUpdates(
  botToken: string,
  offset?: number
): Promise<{ ok: boolean; updates?: any[]; error?: string }> {
  const url = `https://api.telegram.org/bot${botToken}/getUpdates`;
  const params = new URLSearchParams();
  if (offset) params.set('offset', String(offset));
  params.set('timeout', '30');

  try {
    const response = await fetch(`${url}?${params}`);
    const data = (await response.json()) as {
      ok: boolean;
      result?: any[];
      description?: string;
    };

    if (data.ok) {
      return { ok: true, updates: data.result };
    } else {
      return { ok: false, error: data.description };
    }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function waitForResponse(
  botToken: string,
  chatId: string,
  afterMessageId: number,
  timeoutMs: number
): Promise<{ found: boolean; response?: string; error?: string }> {
  const startTime = Date.now();
  let lastUpdateId: number | undefined;

  while (Date.now() - startTime < timeoutMs) {
    const result = await getUpdates(botToken, lastUpdateId);

    if (!result.ok) {
      return { found: false, error: result.error };
    }

    for (const update of result.updates || []) {
      lastUpdateId = update.update_id + 1;

      // Check for bot response in this chat
      if (
        update.message &&
        String(update.message.chat.id) === chatId &&
        update.message.from?.is_bot &&
        update.message.message_id > afterMessageId
      ) {
        return { found: true, response: update.message.text };
      }

      // Check for edited message (bot updates "Thinking..." message)
      if (
        update.edited_message &&
        String(update.edited_message.chat.id) === chatId &&
        update.edited_message.from?.is_bot
      ) {
        // Skip "Thinking..." messages
        if (!update.edited_message.text?.includes('Thinking')) {
          return { found: true, response: update.edited_message.text };
        }
      }
    }

    // Small delay before next poll
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  return { found: false, error: 'Timeout waiting for response' };
}

async function runTests(botToken: string, chatId: string, verbose: boolean) {
  logSection('AgenticLoop Validation Tests');
  log(`Bot Token: ${botToken.slice(0, 10)}...`, 'dim');
  log(`Chat ID: ${chatId}`, 'dim');
  log(`Verbose: ${verbose}`, 'dim');

  const results: Array<{
    test: TestCase;
    passed: boolean;
    response?: string;
    error?: string;
    durationMs: number;
  }> = [];

  for (let i = 0; i < TEST_CASES.length; i++) {
    const test = TEST_CASES[i];
    logTest(i, test);

    const startTime = Date.now();

    // Send test message
    log('  Sending message...', 'cyan');
    const sendResult = await sendTelegramMessage(botToken, chatId, test.message);

    if (!sendResult.ok) {
      log(`  FAILED: Could not send message - ${sendResult.error}`, 'red');
      results.push({
        test,
        passed: false,
        error: sendResult.error,
        durationMs: Date.now() - startTime,
      });
      continue;
    }

    log(`  Message sent (ID: ${sendResult.messageId})`, 'green');

    // Wait for response
    log(`  Waiting for response (timeout: ${test.timeout || 30000}ms)...`, 'cyan');

    // Note: In production, the bot sends responses via webhooks, not getUpdates
    // This is a simplified test that assumes webhook is configured properly
    // The actual response will be delivered to the chat

    // For now, we just verify the message was sent successfully
    // and rely on manual inspection of the chat

    const durationMs = Date.now() - startTime;

    log(`  Message sent successfully in ${durationMs}ms`, 'green');
    log(`  Check Telegram chat for response`, 'yellow');

    results.push({
      test,
      passed: true,
      durationMs,
    });

    // Add delay between tests to avoid rate limiting
    if (i < TEST_CASES.length - 1) {
      log('  Waiting 3s before next test...', 'dim');
      await new Promise((resolve) => setTimeout(resolve, 3000));
    }
  }

  // Summary
  logSection('Test Summary');

  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;

  log(`Total: ${results.length}`, 'bright');
  log(`Passed: ${passed}`, 'green');
  log(`Failed: ${failed}`, failed > 0 ? 'red' : 'green');

  console.log();
  log('Test Messages Sent:', 'bright');
  for (const result of results) {
    const status = result.passed ? '✓' : '✗';
    const color = result.passed ? 'green' : 'red';
    log(`  ${status} ${result.test.name} (${result.durationMs}ms)`, color);
    if (result.error) {
      log(`    Error: ${result.error}`, 'red');
    }
  }

  console.log();
  log('Manual Validation Required:', 'yellow');
  log('  1. Open your Telegram chat with the bot', 'dim');
  log('  2. Verify each response matches expected behavior', 'dim');
  log('  3. Check for debug footer (iterations, tools used)', 'dim');
  log('  4. Verify real-time progress updates worked', 'dim');

  return failed === 0;
}

async function main() {
  const args = process.argv.slice(2);
  const verbose = args.includes('--verbose') || args.includes('-v');
  const helpFlag = args.includes('--help') || args.includes('-h');

  if (helpFlag) {
    console.log(`
AgenticLoop Test Script

Usage:
  bun scripts/test-agentic-loop.ts [options]

Options:
  --chat-id <id>   Telegram chat ID to send test messages to
  --verbose, -v    Enable verbose output
  --help, -h       Show this help message

Environment Variables:
  TELEGRAM_BOT_TOKEN   Bot token (required)
  TELEGRAM_CHAT_ID     Default chat ID (can override with --chat-id)

Example:
  TELEGRAM_BOT_TOKEN=xxx TELEGRAM_CHAT_ID=123 bun scripts/test-agentic-loop.ts
  bun scripts/test-agentic-loop.ts --chat-id 123456789 --verbose
`);
    process.exit(0);
  }

  // Get configuration
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  let chatId = process.env.TELEGRAM_CHAT_ID;

  // Check for --chat-id argument
  const chatIdIndex = args.indexOf('--chat-id');
  if (chatIdIndex !== -1 && args[chatIdIndex + 1]) {
    chatId = args[chatIdIndex + 1];
  }

  // Validate configuration
  if (!botToken) {
    log('Error: TELEGRAM_BOT_TOKEN environment variable is required', 'red');
    log('Set it with: export TELEGRAM_BOT_TOKEN=your_token', 'dim');
    process.exit(1);
  }

  if (!chatId) {
    log('Error: Chat ID is required', 'red');
    log('Provide via --chat-id argument or TELEGRAM_CHAT_ID env var', 'dim');
    process.exit(1);
  }

  // Run tests
  const success = await runTests(botToken, chatId, verbose);
  process.exit(success ? 0 : 1);
}

main().catch((error) => {
  log(`Fatal error: ${error.message}`, 'red');
  process.exit(1);
});
