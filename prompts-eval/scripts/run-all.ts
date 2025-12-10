#!/usr/bin/env bun
/**
 * Run All Promptfoo Evaluations
 *
 * Executes all 4 test suites sequentially and reports results.
 */

import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';

const CONFIGS = [
  { name: 'Router Classification', file: 'router.promptfoo.yaml' },
  { name: 'Telegram Format', file: 'telegram.promptfoo.yaml' },
  { name: 'GitHub Format', file: 'github.promptfoo.yaml' },
  { name: 'GitHub MCP Quality', file: 'github-mcp.promptfoo.yaml' },
  { name: 'Response Quality', file: 'quality.promptfoo.yaml' },
];

// Ensure results directory exists
const scriptsDir = import.meta.dir;
const evalDir = path.join(scriptsDir, '..');
const resultsDir = path.join(evalDir, 'results');
const configsDir = path.join(evalDir, 'configs');

if (!existsSync(resultsDir)) {
  mkdirSync(resultsDir, { recursive: true });
  console.log('📁 Created results directory\n');
}

console.log('🚀 Running Promptfoo Evaluations\n');
console.log('═'.repeat(50));

const results: Array<{ name: string; success: boolean; error?: string }> = [];

for (const config of CONFIGS) {
  console.log(`\n📋 ${config.name}`);
  console.log('─'.repeat(50));

  const configPath = path.join(configsDir, config.file);

  if (!existsSync(configPath)) {
    console.log(`⚠️  Config not found: ${config.file}`);
    results.push({ name: config.name, success: false, error: 'Config not found' });
    continue;
  }

  try {
    const result = spawnSync('npx', ['promptfoo', 'eval', '-c', `configs/${config.file}`], {
      cwd: evalDir,
      stdio: 'inherit',
      env: { ...process.env, FORCE_COLOR: '1' },
    });

    if (result.status === 0) {
      console.log(`✅ ${config.name} completed\n`);
      results.push({ name: config.name, success: true });
    } else {
      console.error(`❌ ${config.name} failed with status ${result.status}\n`);
      results.push({
        name: config.name,
        success: false,
        error: `Exit code ${result.status}`,
      });
    }
  } catch (error) {
    console.error(`❌ ${config.name} failed\n`);
    results.push({
      name: config.name,
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

// Summary
console.log(`\n${'═'.repeat(50)}`);
console.log('📊 Summary\n');

const passed = results.filter((r) => r.success).length;
const failed = results.filter((r) => !r.success).length;

for (const result of results) {
  const status = result.success ? '✅' : '❌';
  console.log(`${status} ${result.name}`);
  if (result.error) {
    console.log(`   └─ ${result.error}`);
  }
}

console.log(`\n${passed}/${results.length} suites passed`);

if (failed > 0) {
  console.log('\n⚠️  Some evaluations failed. Check the logs above for details.');
  process.exit(1);
}

console.log('\n✨ All evaluations completed successfully!');
console.log('\nNext steps:');
console.log('  bun run prompt:view     # Open interactive web UI');
console.log('  bun run prompt:report   # Generate HTML dashboard');
console.log('  bun run prompt:share    # Share results online');
