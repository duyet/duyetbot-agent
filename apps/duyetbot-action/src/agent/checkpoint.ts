/**
 * Checkpoint Manager
 *
 * Manages agent state persistence for resumable execution
 */

import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { z } from 'zod';

/**
 * Checkpoint schema
 */
export const checkpointSchema = z.object({
  taskId: z.string(),
  status: z.enum(['in_progress', 'completed', 'failed']),
  step: z.number(),
  context: z.string(),
  lastOutput: z.string(),
  messages: z.array(z.any()), // Conversation history
  timestamp: z.number(),
});

/**
 * Checkpoint type
 */
export type Checkpoint = z.infer<typeof checkpointSchema>;

/**
 * Checkpoint manager for saving and loading agent state
 */
export class CheckpointManager {
  constructor(private checkpointDir: string) {}

  /**
   * Save a checkpoint
   */
  async save(checkpoint: Checkpoint): Promise<void> {
    // Ensure directory exists
    await mkdir(this.checkpointDir, { recursive: true });

    // Validate checkpoint
    const validated = checkpointSchema.parse(checkpoint);

    // Write checkpoint file
    const filePath = this.getCheckpointPath(checkpoint.taskId);
    const content = JSON.stringify(validated, null, 2);
    await writeFile(filePath, content, 'utf-8');
  }

  /**
   * Load a checkpoint
   */
  async load(taskId: string): Promise<Checkpoint | null> {
    try {
      const filePath = this.getCheckpointPath(taskId);
      const content = await readFile(filePath, 'utf-8');
      const data = JSON.parse(content);
      return checkpointSchema.parse(data);
    } catch (_error) {
      // File doesn't exist or is invalid
      return null;
    }
  }

  /**
   * Delete a checkpoint
   */
  async delete(taskId: string): Promise<void> {
    try {
      const filePath = this.getCheckpointPath(taskId);
      await rm(filePath, { force: true });
    } catch {
      // Ignore errors (file might not exist)
    }
  }

  /**
   * List all checkpoint task IDs
   */
  async list(): Promise<string[]> {
    try {
      const files = await readdir(this.checkpointDir);
      return files.filter((f) => f.endsWith('.json')).map((f) => f.replace('.json', ''));
    } catch {
      return [];
    }
  }

  /**
   * Get checkpoint file path
   */
  private getCheckpointPath(taskId: string): string {
    return join(this.checkpointDir, `${taskId}.json`);
  }
}
