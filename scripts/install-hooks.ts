#!/usr/bin/env bun
/**
 * Install git hooks for quality checks
 * Cross-platform using Bun Shell
 */

import { $ } from 'bun';

console.log('Installing git hooks...');

// Create .git/hooks directory if it doesn't exist
await $`mkdir -p .git/hooks`;

// Copy pre-push hook
await $`cp .claude/hooks/pre-push.sh .git/hooks/pre-push`;
await $`chmod +x .git/hooks/pre-push`;

console.log('✓ Git pre-push hook installed successfully!');
console.log('');
console.log("The hook will run automatically before 'git push'.");
console.log('To bypass temporarily, use: git push --no-verify');
