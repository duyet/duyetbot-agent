#!/usr/bin/env bun
/**
 * TODO.md Parser & Sync Utility
 *
 * Provides utilities for parsing tasks from TODO.md and integrating with
 * the autonomous planning system (Ralph Loop).
 *
 * Features:
 * - Parse checkbox tasks from TODO.md
 * - Extract priority, tags, and status
 * - Sync tasks with Ralph Loop state
 * - Update TODO.md after task completion
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

// ============================================================================
// Types
// ============================================================================

export interface ParsedTask {
  id: string;
  description: string;
  status: 'pending' | 'completed';
  priority: 'high' | 'medium' | 'low';
  tags: string[];
  lineNumber: number;
  section: string;
}

export interface TodoSection {
  name: string;
  tasks: ParsedTask[];
}

export interface TodoDocument {
  filePath: string;
  sections: TodoSection[];
  totalTasks: number;
  completedTasks: number;
  pendingTasks: number;
}

// ============================================================================
// Task Parsing
// ============================================================================

/**
 * Parse task priority from description
 */
function parsePriority(description: string): 'high' | 'medium' | 'low' {
  const priorityMatch = description.match(/\(priority:\s*(high|medium|low)\)/i);
  return (priorityMatch?.[1]?.toLowerCase() as 'high' | 'medium' | 'low') || 'medium';
}

/**
 * Parse task tags from description
 */
function parseTags(description: string): string[] {
  const tagsMatch = description.match(/\(tags:\s*([^)]+)\)/i);
  if (!tagsMatch) {
    return [];
  }

  return tagsMatch[1]
    .split(',')
    .map((tag) => tag.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * Generate a unique task ID from line number and description
 */
function generateTaskId(lineNumber: number, description: string): string {
  const cleanDesc = description
    .replace(/\(priority:[^)]+\)/gi, '')
    .replace(/\(tags:[^)]+\)/gi, '')
    .trim()
    .slice(0, 50);

  const hash = Bun.hash(cleanDesc);
  return `task_${lineNumber}_${hash.toString(36)}`;
}

/**
 * Clean description by removing priority and tags
 */
function cleanDescription(description: string): string {
  return description
    .replace(/\s*\(priority:\s*high|medium|low\)/gi, '')
    .replace(/\s*\(tags:\s*[^)]+\)/gi, '')
    .trim();
}

/**
 * Parse task line
 */
function parseTaskLine(line: string, lineNumber: number, section: string): ParsedTask | null {
  // Match checkbox format: - [ ] or - [x]
  const checkboxMatch = line.match(/^[\s]*-\s*\[([ x])\]\s*(.+)$/);

  if (!checkboxMatch) {
    return null;
  }

  const status = checkboxMatch[1] === 'x' ? 'completed' : 'pending';
  const rawDescription = checkboxMatch[2];
  const priority = parsePriority(rawDescription);
  const tags = parseTags(rawDescription);
  const description = cleanDescription(rawDescription);

  if (!description) {
    return null;
  }

  return {
    id: generateTaskId(lineNumber, description),
    description,
    status,
    priority,
    tags,
    lineNumber,
    section,
  };
}

/**
 * Parse TODO.md file
 */
export function parseTodoFile(filePath: string = resolve(process.cwd(), 'TODO.md')): TodoDocument {
  const content = readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');

  const sections: TodoSection[] = [];
  let currentSection: string = 'General';
  let currentTasks: ParsedTask[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Detect section headers (## or ###)
    const sectionMatch = line.match(/^#{2,3}\s+(.+)$/);
    if (sectionMatch) {
      // Save previous section
      if (currentTasks.length > 0) {
        sections.push({ name: currentSection, tasks: currentTasks });
      }

      currentSection = sectionMatch[1].trim();
      currentTasks = [];
      continue;
    }

    // Parse task line
    const task = parseTaskLine(line, i + 1, currentSection);
    if (task) {
      currentTasks.push(task);
    }
  }

  // Add last section
  if (currentTasks.length > 0) {
    sections.push({ name: currentSection, tasks: currentTasks });
  }

  const allTasks = sections.flatMap((s) => s.tasks);
  const completedTasks = allTasks.filter((t) => t.status === 'completed').length;
  const pendingTasks = allTasks.filter((t) => t.status === 'pending').length;

  return {
    filePath,
    sections,
    totalTasks: allTasks.length,
    completedTasks,
    pendingTasks,
  };
}

// ============================================================================
// Task Filtering
// ============================================================================

/**
 * Get pending tasks by priority
 */
export function getPendingTasksByPriority(
  todoDoc: TodoDocument,
  priority?: 'high' | 'medium' | 'low'
): ParsedTask[] {
  let tasks = todoDoc.sections.flatMap((s) => s.tasks.filter((t) => t.status === 'pending'));

  if (priority) {
    tasks = tasks.filter((t) => t.priority === priority);
  }

  // Sort by priority (high first) then by line number
  const priorityOrder = { high: 0, medium: 1, low: 2 };
  return tasks.sort((a, b) => {
    if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    }
    return a.lineNumber - b.lineNumber;
  });
}

/**
 * Get pending tasks by tag
 */
export function getPendingTasksByTag(todoDoc: TodoDocument, tag: string): ParsedTask[] {
  return todoDoc.sections
    .flatMap((s) => s.tasks)
    .filter((t) => t.status === 'pending' && t.tags.includes(tag.toLowerCase()));
}

/**
 * Get pending tasks by section
 */
export function getPendingTasksBySection(todoDoc: TodoDocument, section: string): ParsedTask[] {
  const sectionData = todoDoc.sections.find((s) => s.name.toLowerCase() === section.toLowerCase());
  return sectionData?.tasks.filter((t) => t.status === 'pending') || [];
}

// ============================================================================
// Task Status Updates
// ============================================================================

/**
 * Mark task as completed in TODO.md
 */
export function markTaskCompleted(
  taskId: string,
  filePath: string = resolve(process.cwd(), 'TODO.md')
): boolean {
  const content = readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const checkboxMatch = line.match(/^[\s]*-\s*\[([ x])\]\s*(.+)$/);

    if (checkboxMatch) {
      const currentStatus = checkboxMatch[1];
      const rawDescription = checkboxMatch[2];
      const description = cleanDescription(rawDescription);

      if (description) {
        const id = generateTaskId(i + 1, description);
        if (id === taskId && currentStatus !== 'x') {
          // Update the line to mark as completed
          lines[i] = line.replace(/^[\s]*-\s*\[\s*\]/, '- [x]');
          writeFileSync(filePath, lines.join('\n'), 'utf-8');
          return true;
        }
      }
    }
  }

  return false;
}

/**
 * Mark task as pending in TODO.md
 */
export function markTaskPending(
  taskId: string,
  filePath: string = resolve(process.cwd(), 'TODO.md')
): boolean {
  const content = readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const checkboxMatch = line.match(/^[\s]*-\s*\[([ x])\]\s*(.+)$/);

    if (checkboxMatch) {
      const currentStatus = checkboxMatch[1];
      const rawDescription = checkboxMatch[2];
      const description = cleanDescription(rawDescription);

      if (description) {
        const id = generateTaskId(i + 1, description);
        if (id === taskId && currentStatus === 'x') {
          // Update the line to mark as pending
          lines[i] = line.replace(/^[\s]*-\s*\[x\]/, '- [ ]');
          writeFileSync(filePath, lines.join('\n'), 'utf-8');
          return true;
        }
      }
    }
  }

  return false;
}

// ============================================================================
// Task Statistics
// ============================================================================

/**
 * Get task statistics by priority
 */
export function getTaskStatsByPriority(
  todoDoc: TodoDocument
): Record<string, { pending: number; completed: number }> {
  const stats: Record<string, { pending: number; completed: number }> = {
    high: { pending: 0, completed: 0 },
    medium: { pending: 0, completed: 0 },
    low: { pending: 0, completed: 0 },
  };

  for (const section of todoDoc.sections) {
    for (const task of section.tasks) {
      if (task.status === 'pending') {
        stats[task.priority].pending++;
      } else {
        stats[task.priority].completed++;
      }
    }
  }

  return stats;
}

/**
 * Get task statistics by tag
 */
export function getTaskStatsByTag(todoDoc: TodoDocument): Record<string, number> {
  const tagCounts: Record<string, number> = {};

  for (const section of todoDoc.sections) {
    for (const task of section.tasks) {
      if (task.status === 'pending') {
        for (const tag of task.tags) {
          tagCounts[tag] = (tagCounts[tag] || 0) + 1;
        }
      }
    }
  }

  return tagCounts;
}

// ============================================================================
// Ralph Loop Integration
// ============================================================================

/**
 * Convert parsed tasks to Ralph Loop format
 */
export function toRalphLoopTasks(todoDoc: TodoDocument): Array<{
  id: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  tags: string[];
  section: string;
}> {
  return getPendingTasksByPriority(todoDoc).map((task) => ({
    id: task.id,
    description: task.description,
    priority: task.priority,
    tags: task.tags,
    section: task.section,
  }));
}

/**
 * Format tasks for Ralph Loop prompt
 */
export function formatTasksForRalphLoop(todoDoc: TodoDocument): string {
  const tasks = getPendingTasksByPriority(todoDoc);

  if (tasks.length === 0) {
    return 'No pending tasks found in TODO.md';
  }

  const lines: string[] = [
    `# Pending Tasks from TODO.md`,
    `Total: ${todoDoc.pendingTasks} pending, ${todoDoc.completedTasks} completed`,
    ``,
  ];

  // Group by priority
  const byPriority = {
    high: tasks.filter((t) => t.priority === 'high'),
    medium: tasks.filter((t) => t.priority === 'medium'),
    low: tasks.filter((t) => t.priority === 'low'),
  };

  for (const [priority, priorityTasks] of Object.entries(byPriority)) {
    if (priorityTasks.length === 0) {
      continue;
    }

    lines.push(`## ${priority.toUpperCase()} Priority (${priorityTasks.length} tasks)`);

    for (const task of priorityTasks) {
      const tags = task.tags.length > 0 ? ` [${task.tags.join(', ')}]` : '';
      lines.push(`- [${task.id.slice(0, 12)}] ${task.description}${tags} (${task.section})`);
    }

    lines.push('');
  }

  return lines.join('\n');
}

// ============================================================================
// CLI
// ============================================================================

/**
 * CLI entry point
 */
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  const todoDoc = parseTodoFile();

  switch (command) {
    case 'list': {
      const priority = args[1] as 'high' | 'medium' | 'low' | undefined;
      const tasks = getPendingTasksByPriority(todoDoc, priority);

      console.log(
        `\n📋 Pending Tasks${priority ? ` (${priority} priority)` : ''} (${tasks.length} total)\n`
      );

      for (const task of tasks.slice(0, 20)) {
        const priorityIcon = { high: '🔴', medium: '🟡', low: '🟢' }[task.priority];
        const tags = task.tags.length > 0 ? ` [${task.tags.join(', ')}]` : '';
        console.log(`${priorityIcon} ${task.description}${tags}`);
        console.log(`   ID: ${task.id} | ${task.section}\n`);
      }

      if (tasks.length > 20) {
        console.log(`... and ${tasks.length - 20} more tasks\n`);
      }

      break;
    }

    case 'stats': {
      const priorityStats = getTaskStatsByPriority(todoDoc);
      const tagStats = getTaskStatsByTag(todoDoc);

      console.log(`\n📊 TODO.md Statistics\n`);
      console.log(`Total Tasks: ${todoDoc.totalTasks}`);
      console.log(`Completed: ${todoDoc.completedTasks}`);
      console.log(`Pending: ${todoDoc.pendingTasks}\n`);

      console.log(`By Priority:`);
      for (const [priority, stats] of Object.entries(priorityStats)) {
        const icon = { high: '🔴', medium: '🟡', low: '🟢' }[priority as keyof typeof icon];
        console.log(
          `  ${icon} ${priority}: ${stats.pending} pending, ${stats.completed} completed`
        );
      }

      if (Object.keys(tagStats).length > 0) {
        console.log(`\nBy Tag:`);
        for (const [tag, count] of Object.entries(tagStats).sort((a, b) => b[1] - a[1])) {
          console.log(`  #${tag}: ${count}`);
        }
      }

      console.log('');

      break;
    }

    case 'complete': {
      const taskId = args[1];
      if (!taskId) {
        console.error('Usage: bun scripts/todo-parser.ts complete <task_id>');
        process.exit(1);
      }

      const success = markTaskCompleted(taskId);
      if (success) {
        console.log(`✅ Task ${taskId} marked as completed`);
      } else {
        console.error(`❌ Task ${taskId} not found or already completed`);
        process.exit(1);
      }

      break;
    }

    case 'ralph': {
      console.log(formatTasksForRalphLoop(todoDoc));
      break;
    }

    default: {
      console.log(`
Usage: bun scripts/todo-parser.ts <command>

Commands:
  list [priority]    List pending tasks (high|medium|low)
  stats             Show task statistics
  complete <id>     Mark task as completed
  ralph             Format tasks for Ralph Loop

Examples:
  bun scripts/todo-parser.ts list high
  bun scripts/todo-parser.ts stats
  bun scripts/todo-parser.ts complete task_123_abc
  bun scripts/todo-parser.ts ralph > ralph-tasks.md
      `);
    }
  }
}

if (import.meta.main) {
  main().catch(console.error);
}
