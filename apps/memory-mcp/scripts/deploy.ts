#!/usr/bin/env bun
/**
 * @fileoverview Deploy Script for Memory MCP Server
 *
 * Handles D1 database provisioning, migrations, and Cloudflare Workers deployment.
 * Designed for reliability in CI/CD environments with proper error handling,
 * retry logic, and structured logging.
 *
 * @example
 * ```bash
 * # Production deploy
 * bun run deploy
 *
 * # Branch version upload
 * bun run deploy:branch
 *
 * # Use existing database
 * D1_DATABASE_ID=xxx bun run deploy
 * ```
 *
 * @author duyetbot
 * @license MIT
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { $ } from 'bun';

// =============================================================================
// Exit Codes
// =============================================================================

/** Standard exit codes for different failure scenarios */
const ExitCode = {
  SUCCESS: 0,
  GENERAL_ERROR: 1,
  CONFIG_ERROR: 2,
  DATABASE_ERROR: 3,
  MIGRATION_ERROR: 4,
  DEPLOY_ERROR: 5,
} as const;

type ExitCodeValue = (typeof ExitCode)[keyof typeof ExitCode];

// =============================================================================
// Configuration
// =============================================================================

interface Config {
  readonly dbName: string;
  readonly rootDir: string;
  readonly configPath: string;
  readonly placeholderPattern: RegExp;
  readonly uuidPattern: RegExp;
  readonly maxRetries: number;
  readonly retryDelayMs: number;
}

function createConfig(): Config {
  const scriptDir = import.meta.dir;
  return Object.freeze({
    dbName: 'duyetbot-memory',
    rootDir: resolve(scriptDir, '..', '..', '..'),
    configPath: resolve(scriptDir, '..', 'wrangler.toml'),
    placeholderPattern: /\$\{D1_DATABASE_ID\}/g,
    uuidPattern: /([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i,
    maxRetries: 3,
    retryDelayMs: 1000,
  });
}

const CONFIG = createConfig();

// =============================================================================
// Types
// =============================================================================

interface D1Database {
  readonly name: string;
  readonly uuid: string;
}

interface DeployOptions {
  readonly command: string;
  readonly args: string;
}

/** Result type for operations that can fail */
type Result<T, E = Error> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: E };

function ok<T>(value: T): Result<T, never> {
  return { ok: true, value };
}

function err<E>(error: E): Result<never, E> {
  return { ok: false, error };
}

// =============================================================================
// Structured Logging
// =============================================================================

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogContext {
  readonly [key: string]: unknown;
}

interface Logger {
  debug(message: string, context?: LogContext): void;
  info(message: string, context?: LogContext): void;
  warn(message: string, context?: LogContext): void;
  error(message: string, context?: LogContext): void;
  step(emoji: string, message: string): void;
  success(message: string): void;
}

function createLogger(): Logger {
  const isCI = Boolean(process.env.CI);

  function formatMessage(level: LogLevel, message: string, context?: LogContext): string {
    if (isCI && context) {
      // Structured JSON logging for CI environments
      return JSON.stringify({ level, message, ...context, timestamp: new Date().toISOString() });
    }
    return message;
  }

  return {
    debug(message: string, context?: LogContext): void {
      if (process.env.DEBUG) {
        console.debug(formatMessage('debug', message, context));
      }
    },
    info(message: string, context?: LogContext): void {
      console.log(formatMessage('info', message, context));
    },
    warn(message: string, context?: LogContext): void {
      console.warn(formatMessage('warn', `⚠️  ${message}`, context));
    },
    error(message: string, context?: LogContext): void {
      console.error(formatMessage('error', `❌ ${message}`, context));
    },
    step(emoji: string, message: string): void {
      console.log(`\n${emoji} ${message}`);
    },
    success(message: string): void {
      console.log(`✅ ${message}`);
    },
  };
}

const log = createLogger();

// =============================================================================
// Error Utilities
// =============================================================================

/**
 * Safely extracts error message from unknown error type.
 * Handles Error instances, objects with stderr/message, and primitives.
 */
function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'object' && error !== null) {
    const e = error as Record<string, unknown>;
    if (typeof e.stderr === 'object' && e.stderr !== null && 'toString' in e.stderr) {
      return String((e.stderr as { toString(): string }).toString());
    }
    if (typeof e.message === 'string') {
      return e.message;
    }
  }
  return String(error);
}

/**
 * Creates a standardized error with context for debugging.
 */
function createError(message: string, cause?: unknown): Error {
  const error = new Error(message);
  if (cause !== undefined) {
    error.cause = cause;
  }
  return error;
}

// =============================================================================
// Retry Logic
// =============================================================================

interface RetryOptions {
  readonly maxAttempts: number;
  readonly delayMs: number;
  readonly shouldRetry?: (error: unknown) => boolean;
}

/**
 * Executes an async function with exponential backoff retry.
 */
async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions,
  operationName: string
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= options.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      const shouldRetry = options.shouldRetry?.(error) ?? true;
      if (!shouldRetry || attempt === options.maxAttempts) {
        break;
      }

      const delay = options.delayMs * Math.pow(2, attempt - 1);
      log.warn(`${operationName} failed (attempt ${attempt}/${options.maxAttempts}), retrying in ${delay}ms...`, {
        error: getErrorMessage(error),
      });
      await sleep(delay);
    }
  }

  throw createError(`${operationName} failed after ${options.maxAttempts} attempts`, lastError);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// =============================================================================
// Shell Utilities
// =============================================================================

type ShellPlaceholderResolver = () => Promise<string>;

/**
 * Registry of shell placeholders and their async resolvers.
 * Add new placeholders here to support additional shell substitutions.
 */
const SHELL_PLACEHOLDER_RESOLVERS: ReadonlyMap<string, ShellPlaceholderResolver> = new Map([
  [
    '$(git branch --show-current)',
    async () => {
      try {
        const result = await $`git branch --show-current`.quiet();
        const branch = result.stdout.toString().trim();
        return branch || 'unknown';
      } catch {
        return 'unknown';
      }
    },
  ],
  [
    '$(git rev-parse --short HEAD)',
    async () => {
      try {
        const result = await $`git rev-parse --short HEAD`.quiet();
        const sha = result.stdout.toString().trim();
        return sha || 'unknown';
      } catch {
        return 'unknown';
      }
    },
  ],
]);

/**
 * Resolves shell command substitution placeholders in a string.
 * Required because Bun.spawn doesn't evaluate $(...) syntax.
 */
async function resolveShellPlaceholders(input: string): Promise<string> {
  let result = input;

  for (const [placeholder, resolver] of SHELL_PLACEHOLDER_RESOLVERS) {
    if (result.includes(placeholder)) {
      const value = await resolver();
      result = result.replaceAll(placeholder, value);
      log.debug('Resolved shell placeholder', { placeholder, value });
    }
  }

  return result;
}

/**
 * Parses a command string into an array of arguments.
 * Respects quoted strings (single and double quotes).
 *
 * @example
 * parseCommandArgs('--message="hello world" --tag=v1')
 * // Returns: ['--message=hello world', '--tag=v1']
 */
function parseCommandArgs(input: string): string[] {
  if (!input.trim()) {
    return [];
  }

  const args: string[] = [];
  let current = '';
  let inQuotes = false;
  let quoteChar = '';

  for (let i = 0; i < input.length; i++) {
    const char = input[i];

    if ((char === '"' || char === "'") && !inQuotes) {
      inQuotes = true;
      quoteChar = char;
    } else if (char === quoteChar && inQuotes) {
      inQuotes = false;
      quoteChar = '';
    } else if (char === ' ' && !inQuotes) {
      if (current) {
        args.push(current);
        current = '';
      }
    } else {
      current += char;
    }
  }

  if (current) {
    args.push(current);
  }

  return args;
}

// =============================================================================
// D1 Database Operations
// =============================================================================

/**
 * Lists all D1 databases in the account.
 */
async function listDatabases(): Promise<Result<readonly D1Database[]>> {
  try {
    const result = await $`bun --cwd ${CONFIG.rootDir} wrangler d1 list --json`.quiet();
    const output = result.stdout.toString().trim();

    if (!output || output === '[]') {
      return ok([]);
    }

    const databases = JSON.parse(output) as D1Database[];
    return ok(databases);
  } catch (error) {
    return err(createError('Failed to list D1 databases', error));
  }
}

/**
 * Finds a database by name in the account.
 */
async function findDatabase(name: string): Promise<D1Database | undefined> {
  const result = await listDatabases();

  if (!result.ok) {
    const message = getErrorMessage(result.error);
    if (message.includes('Authentication error') || message.includes('10000')) {
      log.warn('API token lacks D1 list permission');
    } else {
      log.warn(`Could not list databases: ${message.slice(0, 100)}`);
    }
    return undefined;
  }

  return result.value.find((db) => db.name === name);
}

/**
 * Creates a new D1 database.
 */
async function createDatabase(name: string): Promise<Result<string>> {
  try {
    const result = await $`bun --cwd ${CONFIG.rootDir} wrangler d1 create ${name}`.quiet();
    const output = result.stdout.toString();

    // Try UUID regex first (most reliable)
    const uuidMatch = output.match(CONFIG.uuidPattern);
    if (uuidMatch) {
      return ok(uuidMatch[1]);
    }

    // Try JSON format as fallback
    try {
      const parsed = JSON.parse(output) as { uuid?: string };
      if (parsed.uuid) {
        return ok(parsed.uuid);
      }
    } catch {
      // Not JSON, continue to error
    }

    return err(createError(`Could not parse database ID from wrangler output: ${output.slice(0, 200)}`));
  } catch (error) {
    return err(createError('Failed to create D1 database', error));
  }
}

/**
 * Gets or creates the D1 database for this deployment.
 * Handles race conditions and API permission issues gracefully.
 */
async function getOrCreateDatabase(): Promise<string> {
  log.step('🔍', `Looking for D1 database: ${CONFIG.dbName}...`);

  // Try to find existing database
  const existing = await findDatabase(CONFIG.dbName);
  if (existing) {
    log.success(`Found existing database: ${existing.uuid}`);
    return existing.uuid;
  }

  // Try to create new database
  log.step('📦', `Creating new D1 database: ${CONFIG.dbName}...`);

  const createResult = await createDatabase(CONFIG.dbName);

  if (createResult.ok) {
    log.success(`Created database: ${createResult.value}`);
    return createResult.value;
  }

  // Handle "already exists" race condition
  const errorMessage = getErrorMessage(createResult.error);
  if (errorMessage.includes('already exists') || errorMessage.includes('duplicate')) {
    log.warn('Database already exists (race condition), fetching ID...');
    const db = await findDatabase(CONFIG.dbName);
    if (db) {
      log.success(`Found existing database: ${db.uuid}`);
      return db.uuid;
    }
  }

  // Fatal error - provide helpful manual instructions
  throw createError(
    [
      'Failed to create or find D1 database.',
      '',
      `Error: ${errorMessage.slice(0, 200)}`,
      '',
      'Manual resolution:',
      '  1. Go to Cloudflare Dashboard → Workers & Pages → D1',
      `  2. Create database named "${CONFIG.dbName}"`,
      '  3. Run: D1_DATABASE_ID=<uuid> bun run deploy',
      '',
      'Or update your API token to include D1 permissions.',
    ].join('\n')
  );
}

// =============================================================================
// Wrangler Configuration
// =============================================================================

interface WranglerConfigState {
  readonly modified: boolean;
  readonly originalContent: string | null;
}

/**
 * Substitutes placeholders in wrangler.toml with actual values.
 * Returns state needed to revert changes after deployment.
 */
function substituteWranglerConfig(databaseId: string): WranglerConfigState {
  log.step('📝', 'Updating wrangler.toml with database_id...');

  const originalContent = readFileSync(CONFIG.configPath, 'utf-8');
  const updatedContent = originalContent.replace(CONFIG.placeholderPattern, databaseId);

  if (updatedContent === originalContent) {
    if (originalContent.includes(databaseId)) {
      log.success('wrangler.toml already has correct database_id');
    } else {
      log.warn('No ${D1_DATABASE_ID} placeholder found in wrangler.toml');
    }
    return { modified: false, originalContent: null };
  }

  writeFileSync(CONFIG.configPath, updatedContent, 'utf-8');
  log.success(`Substituted database_id: ${databaseId}`);

  return { modified: true, originalContent };
}

/**
 * Reverts wrangler.toml to its original state.
 */
function revertWranglerConfig(state: WranglerConfigState): void {
  if (state.modified && state.originalContent !== null) {
    writeFileSync(CONFIG.configPath, state.originalContent, 'utf-8');
    log.success('Reverted wrangler.toml to original state');
  }
}

// =============================================================================
// Migrations
// =============================================================================

/**
 * Runs D1 database migrations.
 * Non-fatal on failure (migrations may already be applied).
 */
async function runMigrations(): Promise<void> {
  log.step('📋', 'Running database migrations...');

  try {
    await $`bun --cwd ${CONFIG.rootDir} wrangler d1 migrations apply ${CONFIG.dbName} --remote --config ${CONFIG.configPath}`;
    log.success('Migrations completed');
  } catch (error) {
    // Migrations may already be applied - log warning but continue
    log.warn(`Migration warning: ${getErrorMessage(error)}`);
  }
}

// =============================================================================
// Deployment
// =============================================================================

/**
 * Reads deployment configuration from environment variables.
 */
function getDeployOptions(): DeployOptions {
  return {
    command: process.env.WRANGLER_COMMAND ?? 'deploy',
    args: process.env.WRANGLER_ARGS ?? '',
  };
}

/**
 * Builds the complete wrangler command array.
 */
async function buildWranglerCommand(options: DeployOptions): Promise<readonly string[]> {
  const resolvedArgs = await resolveShellPlaceholders(options.args);

  const command = [
    'bun',
    '--cwd',
    CONFIG.rootDir,
    'wrangler',
    ...options.command.split(/\s+/).filter(Boolean),
    ...parseCommandArgs(resolvedArgs),
    '--config',
    CONFIG.configPath,
  ];

  return Object.freeze(command);
}

/**
 * Executes the wrangler deployment command.
 */
async function executeWrangler(command: readonly string[]): Promise<void> {
  log.info(`Executing: ${command.join(' ')}`);

  const proc = Bun.spawn([...command], {
    cwd: CONFIG.rootDir,
    stdout: 'inherit',
    stderr: 'inherit',
  });

  const exitCode = await proc.exited;

  if (exitCode !== 0) {
    throw createError(`Wrangler exited with code ${exitCode}`);
  }
}

/**
 * Main deployment orchestrator.
 * Handles config substitution, migrations, and wrangler execution.
 */
async function deploy(databaseId: string): Promise<void> {
  const configState = substituteWranglerConfig(databaseId);

  try {
    await runMigrations();

    log.step('🚀', 'Deploying to Cloudflare Workers...');

    const options = getDeployOptions();
    const command = await buildWranglerCommand(options);

    await withRetry(
      () => executeWrangler(command),
      {
        maxAttempts: CONFIG.maxRetries,
        delayMs: CONFIG.retryDelayMs,
        shouldRetry: (error) => {
          const message = getErrorMessage(error);
          // Retry on transient network errors
          return message.includes('ECONNRESET') || message.includes('ETIMEDOUT');
        },
      },
      'Wrangler deployment'
    );

    log.info('\n✅ Deployment complete!');
  } finally {
    revertWranglerConfig(configState);
  }
}

// =============================================================================
// Main Entry Point
// =============================================================================

async function main(): Promise<ExitCodeValue> {
  log.info('🔧 Memory MCP Server Deployment\n');

  try {
    // Use provided database ID or auto-discover/create
    const providedId = process.env.D1_DATABASE_ID;
    const databaseId = providedId ?? (await getOrCreateDatabase());

    if (providedId) {
      log.success(`Using provided D1_DATABASE_ID: ${databaseId}`);
    }

    await deploy(databaseId);
    return ExitCode.SUCCESS;
  } catch (error) {
    log.error(`Deployment failed: ${getErrorMessage(error)}`);

    // Return specific exit code based on error type
    const message = getErrorMessage(error);
    if (message.includes('database')) {
      return ExitCode.DATABASE_ERROR;
    }
    if (message.includes('migration')) {
      return ExitCode.MIGRATION_ERROR;
    }
    if (message.includes('Wrangler')) {
      return ExitCode.DEPLOY_ERROR;
    }

    return ExitCode.GENERAL_ERROR;
  }
}

// Execute and exit with appropriate code
main().then((code) => process.exit(code));
