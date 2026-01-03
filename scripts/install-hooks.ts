#!/usr/bin/env bun

/**
 * Install git hooks for quality checks
 *
 * Installs all hooks from .claude/hooks/ to .git/hooks/
 * Cross-platform using Bun Shell
 */

import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { $ } from 'bun';

const HOOKS_SOURCE_DIR = '.claude/hooks';
const HOOKS_TARGET_DIR = '.git/hooks';

// Map of source files to git hook names
const HOOK_MAPPINGS: Record<string, string> = {
  'pre-commit.sh': 'pre-commit',
  'commit-msg.sh': 'commit-msg',
  'pre-push.sh': 'pre-push',
  'post-commit.sh': 'post-commit',
  'post-checkout.sh': 'post-checkout',
  'post-merge.sh': 'post-merge',
};

console.log('🔧 Installing git hooks...');
console.log('');

// Ensure target directory exists
await $`mkdir -p ${HOOKS_TARGET_DIR}`;

// Get all hook files from source directory
const sourceFiles = readdirSync(HOOKS_SOURCE_DIR).filter(
  (file) => file.endsWith('.sh') && HOOK_MAPPINGS[file]
);

if (sourceFiles.length === 0) {
  console.log('⚠️  No hook files found in .claude/hooks/');
  process.exit(1);
}

// Install each hook
const installed: string[] = [];
const skipped: string[] = [];

for (const sourceFile of sourceFiles) {
  const hookName = HOOK_MAPPINGS[sourceFile];
  const sourcePath = join(HOOKS_SOURCE_DIR, sourceFile);
  const targetPath = join(HOOKS_TARGET_DIR, hookName);

  if (!existsSync(sourcePath)) {
    skipped.push(hookName);
    continue;
  }

  try {
    await $`cp ${sourcePath} ${targetPath}`;
    await $`chmod +x ${targetPath}`;
    installed.push(hookName);
    console.log(`✓ ${hookName} installed`);
  } catch (error) {
    console.error(`✗ Failed to install ${hookName}:`, error);
    skipped.push(hookName);
  }
}

console.log('');
console.log('━'.repeat(50));
console.log('');

if (installed.length > 0) {
  console.log(`✅ Successfully installed ${installed.length} git hooks:`);
  console.log('');

  for (const hook of installed) {
    switch (hook) {
      case 'pre-commit':
        console.log('  📝 pre-commit - Runs fast checks on staged files:');
        console.log('     • Biome lint/format with auto-fix');
        console.log('     • Secret detection');
        console.log('     • Debug statement check');
        console.log('     • File size limit (1MB)');
        break;
      case 'commit-msg':
        console.log('  📋 commit-msg - Validates semantic commit format:');
        console.log('     • Enforces type: description format');
        console.log('     • Auto-adds duyetbot co-author');
        break;
      case 'pre-push':
        console.log('  🚀 pre-push - Full quality gate before push:');
        console.log('     • Biome lint with auto-fix');
        console.log('     • TypeScript type-check');
        console.log('     • Build verification');
        console.log('     • Full test suite');
        break;
      default:
        console.log(`  • ${hook}`);
    }
    console.log('');
  }
}

if (skipped.length > 0) {
  console.log(`⚠️  Skipped ${skipped.length} hooks: ${skipped.join(', ')}`);
  console.log('');
}

console.log('💡 To bypass hooks temporarily:');
console.log('   git commit --no-verify');
console.log('   git push --no-verify');
console.log('');
console.log('💡 To disable hooks:');
console.log('   SKIP_HOOKS=1 git commit -m "message"');
console.log('');
