#!/usr/bin/env bun
/**
 * Share Results to Promptfoo Cloud
 *
 * Uploads evaluation results and returns a shareable URL.
 */

import { spawnSync } from 'node:child_process';
import path from 'node:path';

const scriptsDir = import.meta.dir;
const evalDir = path.join(scriptsDir, '..');

console.log('🌐 Uploading results to Promptfoo Cloud...\n');

try {
  const result = spawnSync('npx', ['promptfoo', 'share'], {
    cwd: evalDir,
    encoding: 'utf-8',
    env: { ...process.env, FORCE_COLOR: '1' },
  });

  if (result.status === 0) {
    const output = result.stdout || '';

    // Extract URL from output
    const urlMatch = output.match(/https:\/\/[^\s]+/);

    if (urlMatch) {
      console.log('✅ Results shared successfully!\n');
      console.log('═'.repeat(50));
      console.log(`\n🔗 View online: ${urlMatch[0]}\n`);
      console.log('═'.repeat(50));
      console.log('\nShare this URL with your team for collaborative review.');
    } else {
      console.log('Output:', output);
    }
  } else {
    console.error('\n❌ Failed to share results.');
    if (result.stderr) {
      console.error('Error:', result.stderr);
    }
    console.log('\nTip: Make sure you have run evaluations first:');
    console.log('  bun run prompt:eval');
    process.exit(1);
  }
} catch (error) {
  console.error('\n❌ Failed to share results.');
  console.error(error);
  console.log('\nTip: Make sure you have run evaluations first:');
  console.log('  bun run prompt:eval');
  process.exit(1);
}
