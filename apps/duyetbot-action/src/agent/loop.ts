/**
 * Agent Loop
 *
 * Main agent loop with SDK integration and checkpoint support
 */

import type { SDKAnyMessage } from '@duyetbot/core';
import { query } from '@duyetbot/core';
import { getPlatformTools } from '@duyetbot/tools';
import type { Config } from '../config.js';
import { buildSystemPrompt } from '../prompts/index.js';
import type { Task } from '../tasks/types.js';
import { type Checkpoint, CheckpointManager } from './checkpoint.js';

/**
 * Agent loop options
 */
export interface AgentLoopOptions {
  config: Config;
  task: Task;
  onProgress?: (step: number, message: string) => void;
}

/**
 * Agent result
 */
export interface AgentResult {
  success: boolean;
  output: string;
  error?: string;
  tokensUsed: number;
  stepsCompleted: number;
}

/**
 * Main agent loop with checkpoint support
 */
export class AgentLoop {
  private checkpoints: CheckpointManager;

  constructor(private options: AgentLoopOptions) {
    this.checkpoints = new CheckpointManager(options.config.checkpointDir);
  }

  /**
   * Run the agent loop
   */
  async run(): Promise<AgentResult> {
    const { config, task, onProgress } = this.options;

    // Check for existing checkpoint
    const existingCheckpoint = await this.checkpoints.load(task.id);
    if (existingCheckpoint && existingCheckpoint.status === 'in_progress') {
      console.log(`Resuming task ${task.id} from checkpoint...`);
      return this.resume(existingCheckpoint);
    }

    // Build system prompt
    const systemPrompt = buildSystemPrompt({
      task,
      repositoryInfo: config.repository
        ? {
            owner: config.repository.owner,
            name: config.repository.name,
            branch: 'main',
          }
        : undefined,
    });

    // Get platform tools (server mode = full access)
    const tools = getPlatformTools('server');

    // Initialize checkpoint
    const checkpoint: Checkpoint = {
      taskId: task.id,
      status: 'in_progress',
      step: 0,
      context: task.description,
      lastOutput: '',
      messages: [],
      timestamp: Date.now(),
    };

    await this.checkpoints.save(checkpoint);

    // Track metrics
    let totalTokens = 0;
    let stepsCompleted = 0;
    let finalOutput = '';
    let error: string | undefined;

    try {
      // Run SDK query loop
      const messages: SDKAnyMessage[] = [];

      for await (const message of query(task.description, {
        systemPrompt,
        tools: tools as never,
        model: config.model,
        sessionId: task.id,
      })) {
        messages.push(message);

        // Track progress
        if (message.type === 'assistant') {
          stepsCompleted++;
          onProgress?.(stepsCompleted, message.content);

          // Update checkpoint periodically (every 2 steps)
          if (stepsCompleted % 2 === 0) {
            checkpoint.step = stepsCompleted;
            checkpoint.lastOutput = message.content;
            checkpoint.messages = messages;
            checkpoint.timestamp = Date.now();
            await this.checkpoints.save(checkpoint);
          }
        }

        // Track result
        if (message.type === 'result') {
          finalOutput = message.content;
          totalTokens = message.totalTokens || 0;
        }

        // Safety limit
        if (stepsCompleted >= config.maxIterations) {
          console.warn(`Max iterations (${config.maxIterations}) reached`);
          break;
        }
      }

      // Mark as completed
      checkpoint.status = 'completed';
      checkpoint.step = stepsCompleted;
      checkpoint.lastOutput = finalOutput;
      checkpoint.messages = messages;
      checkpoint.timestamp = Date.now();
      await this.checkpoints.save(checkpoint);

      return {
        success: true,
        output: finalOutput,
        tokensUsed: totalTokens,
        stepsCompleted,
      };
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);

      // Mark as failed
      checkpoint.status = 'failed';
      checkpoint.lastOutput = error;
      checkpoint.timestamp = Date.now();
      await this.checkpoints.save(checkpoint);

      return {
        success: false,
        output: finalOutput,
        error,
        tokensUsed: totalTokens,
        stepsCompleted,
      };
    }
  }

  /**
   * Resume from checkpoint
   */
  async resume(checkpoint?: Checkpoint): Promise<AgentResult> {
    const { config, task, onProgress } = this.options;

    // Load checkpoint if not provided
    const resumeCheckpoint = checkpoint || (await this.checkpoints.load(task.id));
    if (!resumeCheckpoint) {
      throw new Error(`No checkpoint found for task ${task.id}`);
    }

    console.log(`Resuming from step ${resumeCheckpoint.step}...`);

    // Build system prompt with checkpoint context
    const systemPrompt = buildSystemPrompt({
      task,
      checkpoint: resumeCheckpoint,
      repositoryInfo: config.repository
        ? {
            owner: config.repository.owner,
            name: config.repository.name,
            branch: 'main',
          }
        : undefined,
    });

    // Get platform tools
    const tools = getPlatformTools('server');

    // Track metrics
    let totalTokens = 0;
    let stepsCompleted = resumeCheckpoint.step;
    let finalOutput = resumeCheckpoint.lastOutput;
    let error: string | undefined;

    try {
      // Continue from last output
      const continuationPrompt = `Continue from where you left off:\n${resumeCheckpoint.lastOutput}`;

      const messages: SDKAnyMessage[] = [...resumeCheckpoint.messages];

      for await (const message of query(continuationPrompt, {
        systemPrompt,
        tools: tools as never,
        model: config.model,
        sessionId: task.id,
        resume: task.id, // Resume session
      })) {
        messages.push(message);

        // Track progress
        if (message.type === 'assistant') {
          stepsCompleted++;
          onProgress?.(stepsCompleted, message.content);

          // Update checkpoint periodically
          if (stepsCompleted % 2 === 0) {
            resumeCheckpoint.step = stepsCompleted;
            resumeCheckpoint.lastOutput = message.content;
            resumeCheckpoint.messages = messages;
            resumeCheckpoint.timestamp = Date.now();
            await this.checkpoints.save(resumeCheckpoint);
          }
        }

        // Track result
        if (message.type === 'result') {
          finalOutput = message.content;
          totalTokens = message.totalTokens || 0;
        }

        // Safety limit
        if (stepsCompleted >= config.maxIterations) {
          console.warn(`Max iterations (${config.maxIterations}) reached`);
          break;
        }
      }

      // Mark as completed
      resumeCheckpoint.status = 'completed';
      resumeCheckpoint.step = stepsCompleted;
      resumeCheckpoint.lastOutput = finalOutput;
      resumeCheckpoint.messages = messages;
      resumeCheckpoint.timestamp = Date.now();
      await this.checkpoints.save(resumeCheckpoint);

      return {
        success: true,
        output: finalOutput,
        tokensUsed: totalTokens,
        stepsCompleted,
      };
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);

      // Mark as failed
      resumeCheckpoint.status = 'failed';
      resumeCheckpoint.lastOutput = error;
      resumeCheckpoint.timestamp = Date.now();
      await this.checkpoints.save(resumeCheckpoint);

      return {
        success: false,
        output: finalOutput,
        error,
        tokensUsed: totalTokens,
        stepsCompleted,
      };
    }
  }
}
