#!/usr/bin/env bun
/**
 * Dependency Checker Script
 *
 * Validates that all imports in the codebase have corresponding package.json dependencies.
 * This catches missing workspace dependencies before they cause CI failures.
 *
 * Uses only built-in Node.js APIs - no shell execution.
 * Usage: bun run scripts/check-deps.ts
 */

import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

interface PackageCheckResult {
  issues: string[];
  packageName: string;
}

const ROOT = process.cwd();

/**
 * Get all packages in the monorepo
 */
function getPackages(): string[] {
  const packages: string[] = [];

  try {
    const packagesDir = join(ROOT, 'packages');
    readdirSync(packagesDir, { withFileTypes: true }).forEach((entry) => {
      if (entry.isDirectory() && !entry.name.startsWith('.')) {
        packages.push(join(packagesDir, entry.name));
      }
    });
  } catch {
    // packages directory might not exist
  }

  try {
    const appsDir = join(ROOT, 'apps');
    readdirSync(appsDir, { withFileTypes: true }).forEach((entry) => {
      if (entry.isDirectory() && !entry.name.startsWith('.')) {
        packages.push(join(appsDir, entry.name));
      }
    });
  } catch {
    // apps directory might not exist
  }

  return packages;
}

/**
 * Extract @duyetbot imports from file content
 */
function extractImports(content: string): string[] {
  const imports = new Set<string>();

  // Match: from "@duyetbot/..." or from '@duyetbot/...'
  const importMatches = content.matchAll(/from\s+['"](@duyetbot\/[^'"]+)['"]/g);
  for (const match of importMatches) {
    imports.add(match[1]);
  }

  // Match: import("@duyetbot/...") or import('@duyetbot/...')
  const dynamicMatches = content.matchAll(/import\s*\(\s*['"](@duyetbot\/[^'"]+)['"]\s*\)/g);
  for (const match of dynamicMatches) {
    imports.add(match[1]);
  }

  // Match: require("@duyetbot/...") or require('@duyetbot/...')
  const requireMatches = content.matchAll(/require\s*\(\s*['"](@duyetbot\/[^'"]+)['"]\s*\)/g);
  for (const match of requireMatches) {
    imports.add(match[1]);
  }

  return Array.from(imports);
}

/**
 * Get all TypeScript/JavaScript files recursively from a directory
 */
function getSourceFiles(dir: string): string[] {
  const files: string[] = [];

  try {
    const entries = readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      // Skip hidden files and common exclusions
      if (entry.name.startsWith('.') || ['node_modules', 'dist', 'build'].includes(entry.name)) {
        continue;
      }

      const fullPath = join(dir, entry.name);

      if (entry.isDirectory()) {
        files.push(...getSourceFiles(fullPath));
      } else if (/\.[jt]sx?$/.test(entry.name)) {
        files.push(fullPath);
      }
    }
  } catch {
    // Directory might not exist or be inaccessible
  }

  return files;
}

/**
 * Check dependencies for a single package
 */
function checkPackage(packageDir: string): PackageCheckResult {
  const packageJsonPath = join(packageDir, 'package.json');

  let packageJson: any = {};
  try {
    const content = readFileSync(packageJsonPath, 'utf-8');
    packageJson = JSON.parse(content);
  } catch {
    return { issues: [], packageName: relative(ROOT, packageDir) };
  }

  const packageName = packageJson.name || relative(ROOT, packageDir);

  // Collect all declared dependencies
  const dependencies = new Set<string>([
    ...Object.keys(packageJson.dependencies ?? {}),
    ...Object.keys(packageJson.devDependencies ?? {}),
  ]);

  // Check src directory
  const srcDir = join(packageDir, 'src');
  let sourceFiles: string[] = [];

  try {
    sourceFiles = getSourceFiles(srcDir);
  } catch {
    return { issues: [], packageName };
  }

  const issues: string[] = [];

  // Check each source file for missing dependencies
  for (const file of sourceFiles) {
    try {
      const content = readFileSync(file, 'utf-8');
      const imports = extractImports(content);

      for (const fullImport of imports) {
        // Get base package name (everything before the second /)
        // e.g., "@duyetbot/types/mention-parser" -> "@duyetbot/types"
        const baseModule = fullImport.split('/').slice(0, 2).join('/');

        if (!dependencies.has(baseModule) && !dependencies.has(fullImport)) {
          const relPath = relative(ROOT, file);
          issues.push(
            `${relPath} - Missing dependency: "${baseModule}" (imported as "${fullImport}")`
          );
        }
      }
    } catch {
      // File might not be readable
    }
  }

  return { issues, packageName };
}

/**
 * Main execution
 */
function main(): void {
  console.log('🔍 Checking dependencies in all packages and apps...\n');

  const packages = getPackages();
  let totalIssues = 0;
  const results: PackageCheckResult[] = [];

  for (const packageDir of packages) {
    const result = checkPackage(packageDir);
    if (result.issues.length > 0) {
      results.push(result);
      totalIssues += result.issues.length;
    }
  }

  if (totalIssues === 0) {
    console.log('✅ All dependencies are properly declared!\n');
    process.exit(0);
  }

  console.log(`❌ Found ${totalIssues} missing dependencies:\n`);

  for (const { packageName, issues } of results) {
    console.log(`📦 ${packageName}:`);
    for (const issue of issues) {
      console.log(`   ${issue}`);
    }
    console.log();
  }

  console.log('⚠️  Fix these issues by adding missing dependencies to package.json\n');
  process.exit(1);
}

main();
