/**
 * Subagent Registry
 *
 * Defines specialized subagent types for task delegation
 * Based on Claude Code's Task tool pattern
 */

import type { Tool, ToolInput, ToolOutput } from '@duyetbot/types';

export type SubagentType = 'plan' | 'research' | 'code' | 'review' | 'test' | 'deploy';

export interface SubagentConfig {
  type: SubagentType;
  description: string;
  prompt?: string;
  tools: Tool[];
  maxIterations?: number;
}

export class SubagentRegistry {
  private subagents = new Map<SubagentType, SubagentConfig>();

  register(config: SubagentConfig): void {
    this.subagents.set(config.type, config);
  }

  get(type: SubagentType): SubagentConfig | undefined {
    return this.subagents.get(type);
  }

  getAll(): SubagentConfig[] {
    return Array.from(this.subagents.values());
  }
}

export class SubagentTask implements Tool {
  name = 'subagent';
  description =
    'Delegate to a specialized subagent for complex tasks. Use when the main task requires specialized expertise (planning, research, code changes, testing, deployment).';

  inputSchema = {} as any;

  validate(_input: ToolInput): boolean {
    return true;
  }

  async execute(input: ToolInput): Promise<ToolOutput> {
    const content = input.content as Record<string, unknown>;

    const subagentType = content.subagent_type as SubagentType;
    const description = content.description as string;
    const prompt = content.prompt as string | undefined;

    return {
      status: 'success',
      content: JSON.stringify({
        subagent_type: subagentType,
        description,
        prompt,
        result: `Subagent ${subagentType} delegated for: ${description}`,
      }),
    };
  }
}

export const subagentTaskTool = new SubagentTask();
