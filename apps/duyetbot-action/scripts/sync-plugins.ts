#!/usr/bin/env bun
/**
 * Sync Claude Plugins
 *
 * Syncs plugins from external repositories to the .claude directory.
 * Sources:
 * - https://github.com/duyet/claude-plugins
 * - https://github.com/numman-ali/cc-mirror
 */

import { $ } from 'bun';

const PLUGINS_DIR = '.claude';
const TEMP_DIR = '/tmp/claude-plugins-sync';

// Plugin sources configuration
const PLUGIN_SOURCES = [
  {
    name: 'claude-plugins',
    repo: 'https://github.com/duyet/claude-plugins.git',
    branch: 'main',
    files: [
      // Team agents
      { src: 'team-agents/agents/leader.md', dest: 'agents/leader.md' },
      { src: 'team-agents/agents/senior-engineer.md', dest: 'agents/senior-engineer.md' },
      { src: 'team-agents/agents/junior-engineer.md', dest: 'agents/junior-engineer.md' },
      // Team agent skills
      {
        src: 'team-agents/skills/task-decomposition/SKILL.md',
        dest: 'skills/task-decomposition/SKILL.md',
      },
      {
        src: 'team-agents/skills/backend-api-patterns/SKILL.md',
        dest: 'skills/backend-api-patterns/SKILL.md',
      },
      {
        src: 'team-agents/skills/typescript-patterns/SKILL.md',
        dest: 'skills/typescript-patterns/SKILL.md',
      },
      {
        src: 'team-agents/skills/react-nextjs-patterns/SKILL.md',
        dest: 'skills/react-nextjs-patterns/SKILL.md',
      },
      { src: 'team-agents/skills/quality-gates/SKILL.md', dest: 'skills/quality-gates/SKILL.md' },
      // Frontend design
      {
        src: 'frontend-design/skills/frontend-design/SKILL.md',
        dest: 'skills/frontend-design/SKILL.md',
      },
      {
        src: 'frontend-design/skills/frontend-design/references/shadcn.md',
        dest: 'skills/frontend-design/references/shadcn.md',
      },
      // Terminal UI design
      {
        src: 'terminal-ui-design/skills/terminal-ui-design/SKILL.md',
        dest: 'skills/terminal-ui-design/SKILL.md',
      },
      // Interview
      { src: 'interview/commands/interview.md', dest: 'skills/interview/SKILL.md' },
    ],
  },
];

const ORCHESTRATION_SKILL = {
  name: 'orchestration',
  url: 'https://raw.githubusercontent.com/numman-ali/cc-mirror/main/src/skills/orchestration/SKILL.md',
  dest: 'skills/orchestration/SKILL.md',
};

/**
 * Ensure directory exists
 */
async function ensureDir(path: string): Promise<void> {
  await $`mkdir -p ${path}`;
}

/**
 * Clone or update a git repository
 */
async function cloneOrUpdateRepo(repo: string, dest: string, branch = 'main'): Promise<void> {
  const dirExists = await Bun.file(dest).exists();

  if (dirExists) {
    console.log(`Updating ${repo}...`);
    await $`cd ${dest} && git fetch origin && git checkout origin/${branch} --quiet`;
  } else {
    console.log(`Cloning ${repo}...`);
    await $`git clone --depth 1 --branch ${branch} ${repo} ${dest}`;
  }
}

/**
 * Copy file from source to destination
 */
async function copyFile(src: string, dest: string): Promise<boolean> {
  const srcPath = `${TEMP_DIR}/claude-plugins/${src}`;
  const destPath = `${PLUGINS_DIR}/${dest}`;

  // Ensure destination directory exists
  const destDir = destPath.substring(0, destPath.lastIndexOf('/'));
  await ensureDir(destDir);

  // Check if source exists
  const srcExists = await Bun.file(srcPath).exists();
  if (!srcExists) {
    console.warn(`  Warning: ${src} not found, skipping`);
    return false;
  }

  // Copy file
  await Bun.write(destPath, await Bun.file(srcPath).text());
  console.log(`  Copied: ${src} -> ${dest}`);
  return true;
}

/**
 * Download file from URL
 */
async function downloadFile(url: string, dest: string): Promise<void> {
  const destPath = `${PLUGINS_DIR}/${dest}`;

  // Ensure destination directory exists
  const destDir = destPath.substring(0, destPath.lastIndexOf('/'));
  await ensureDir(destDir);

  console.log(`Downloading ${url}...`);
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download ${url}: ${response.statusText}`);
  }

  await Bun.write(destPath, await response.text());
  console.log(`  Downloaded: ${dest}`);
}

/**
 * Main sync function
 */
async function sync(): Promise<void> {
  console.log('='.repeat(60));
  console.log('Claude Plugins Sync');
  console.log('='.repeat(60));
  console.log();

  let filesCopied = 0;
  let filesSkipped = 0;

  // Clean temp dir
  await $`rm -rf ${TEMP_DIR}`;
  await ensureDir(TEMP_DIR);

  try {
    // Process each plugin source
    for (const source of PLUGIN_SOURCES) {
      console.log(`\n[${source.name}]`);
      const repoDir = `${TEMP_DIR}/${source.name}`;

      // Clone or update repository
      await cloneOrUpdateRepo(source.repo, repoDir, source.branch);

      // Copy files
      for (const file of source.files) {
        const success = await copyFile(file.src, file.dest);
        if (success) {
          filesCopied++;
        } else {
          filesSkipped++;
        }
      }
    }

    // Download orchestration skill
    console.log('\n[orchestration]');
    await downloadFile(ORCHESTRATION_SKILL.url, ORCHESTRATION_SKILL.dest);
    filesCopied++;

    console.log();
    console.log('='.repeat(60));
    console.log('Sync complete!');
    console.log(`  Files copied: ${filesCopied}`);
    if (filesSkipped > 0) {
      console.log(`  Files skipped: ${filesSkipped}`);
    }
    console.log('='.repeat(60));
  } finally {
    // Clean temp dir
    await $`rm -rf ${TEMP_DIR}`;
  }
}

// Run sync
sync().catch((err) => {
  console.error('Sync failed:', err);
  process.exit(1);
});
