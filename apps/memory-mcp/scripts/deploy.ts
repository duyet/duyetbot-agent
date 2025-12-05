#!/usr/bin/env bun
/**
 * Deploy script that automatically fetches or creates D1 database
 * and injects the database ID into wrangler deploy
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { $ } from 'bun';

// Root directory for running bun wrangler
const rootDir = resolve(import.meta.dir, '..', '..', '..');
// Config file path for wrangler
const configPath = resolve(import.meta.dir, '..', 'wrangler.toml');

const DB_NAME = 'duyetbot-memory';

async function getOrCreateDatabase(): Promise<string> {
  console.log(`\n🔍 Looking for D1 database: ${DB_NAME}...`);

  // Try to list existing databases
  try {
    const result = await $`bun --cwd ${rootDir} wrangler d1 list --json`.quiet();
    const output = result.stdout.toString().trim();

    // Handle empty or non-JSON output
    if (!output || output === '[]') {
      console.log('📋 No databases found, will try to create...');
    } else {
      const databases = JSON.parse(output);
      const existing = databases.find((db: { name: string; uuid: string }) => db.name === DB_NAME);
      if (existing) {
        console.log(`✅ Found existing database: ${existing.uuid}`);
        return existing.uuid;
      }
      console.log(`📋 Database "${DB_NAME}" not found in list, will try to create...`);
    }
  } catch (error: any) {
    const stderr = error.stderr?.toString() || error.message || '';
    if (stderr.includes('Authentication error') || stderr.includes('10000')) {
      console.log('⚠️  API token lacks D1 list permission');
    } else {
      console.log('⚠️  Could not list databases:', stderr.slice(0, 100));
    }
  }

  // Try to create database
  console.log(`\n📦 Creating new D1 database: ${DB_NAME}...`);
  try {
    const result = await $`bun --cwd ${rootDir} wrangler d1 create ${DB_NAME}`.quiet();
    const output = result.stdout.toString();

    // Parse UUID from output like "Created database 'duyetbot-memory' at location: uuid"
    const uuidMatch = output.match(
      /([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i
    );
    if (uuidMatch) {
      console.log(`✅ Created database: ${uuidMatch[1]}`);
      return uuidMatch[1];
    }

    // Try JSON format
    try {
      const created = JSON.parse(output);
      if (created.uuid) {
        console.log(`✅ Created database: ${created.uuid}`);
        return created.uuid;
      }
    } catch {
      // JSON parsing failed, continue to error
    }

    throw new Error(`Could not parse database ID from output: ${output}`);
  } catch (error: any) {
    const stderr = error.stderr?.toString() || error.message || '';

    // Check if database already exists
    if (stderr.includes('already exists') || stderr.includes('duplicate')) {
      console.log('⚠️  Database already exists, trying to fetch ID...');
      try {
        const result = await $`bun --cwd ${rootDir} wrangler d1 list --json`.quiet();
        const databases = JSON.parse(result.stdout.toString());
        const existing = databases.find(
          (db: { name: string; uuid: string }) => db.name === DB_NAME
        );
        if (existing) {
          console.log(`✅ Found existing database: ${existing.uuid}`);
          return existing.uuid;
        }
      } catch {
        // JSON parsing failed, continue to error
      }
    }

    throw new Error(
      `Failed to create or find database.\n\nAPI Error: ${stderr.slice(0, 200)}\n\nPlease create the database manually in Cloudflare Dashboard:\n1. Go to Workers & Pages → D1\n2. Create database named "${DB_NAME}"\n3. Run: D1_DATABASE_ID=<id> bun run deploy\n\nOr update your API token to include D1 permissions.`
    );
  }
}

async function runMigrations(_databaseId: string) {
  console.log('\n📋 Running database migrations...');
  try {
    await $`bun --cwd ${rootDir} wrangler d1 migrations apply ${DB_NAME} --remote --config ${configPath}`;
    console.log('✅ Migrations completed');
  } catch (error: any) {
    console.log('⚠️  Migration warning:', error.message);
    // Continue anyway - migrations might already be applied
  }
}

function substituteWranglerBindings(databaseId: string): string | null {
  const wranglerPath = resolve(import.meta.dir, '..', 'wrangler.toml');

  console.log('\n📝 Updating wrangler.toml with database_id...');

  const original = readFileSync(wranglerPath, 'utf-8');

  // Replace placeholder with actual value
  const content = original.replace(/\$\{D1_DATABASE_ID\}/g, databaseId);

  if (content === original) {
    // Check if already has the correct ID
    if (original.includes(databaseId)) {
      console.log('✅ wrangler.toml already has correct database_id');
      return null;
    }
    console.log('⚠️  No placeholder found in wrangler.toml');
    return null;
  }

  writeFileSync(wranglerPath, content, 'utf-8');
  console.log(`✅ Substituted database_id: ${databaseId}`);
  return original;
}

function revertWranglerBindings(original: string) {
  const wranglerPath = resolve(import.meta.dir, '..', 'wrangler.toml');
  writeFileSync(wranglerPath, original, 'utf-8');
  console.log('✅ Reverted wrangler.toml to original state');
}

async function deploy(databaseId: string) {
  // Substitute the database_id in wrangler.toml
  const original = substituteWranglerBindings(databaseId);

  try {
    // Run migrations (after substitution so wrangler.toml has correct database_id)
    await runMigrations(databaseId);

    // Support both production deploy and branch versions upload
    const command = process.env.WRANGLER_COMMAND || 'deploy';
    const args = process.env.WRANGLER_ARGS ? ` ${process.env.WRANGLER_ARGS}` : '';

    console.log('\n🚀 Deploying to Cloudflare Workers...');
    await $`bun --cwd ${rootDir} wrangler ${command}${args} --config ${configPath}`;
    console.log('\n✅ Deployment complete!');
  } finally {
    // Always revert wrangler.toml back to placeholder
    if (original) {
      revertWranglerBindings(original);
    }
  }
}

async function main() {
  console.log('🔧 Memory MCP Server Deployment\n');

  // Check if D1_DATABASE_ID is already set
  let databaseId = process.env.D1_DATABASE_ID;

  if (databaseId) {
    console.log(`✅ Using provided D1_DATABASE_ID: ${databaseId}`);
  } else {
    databaseId = await getOrCreateDatabase();
  }

  // Deploy (includes migrations)
  await deploy(databaseId);
}

main().catch((error) => {
  console.error('\n❌ Deployment failed:', error.message);
  process.exit(1);
});
