import type { Tool, ToolInput, ToolOutput } from '@duyetbot/types';
import { z } from 'zod';

export class ToolSearchIndex {
  tools = new Map<string, Tool>();
  categories = new Map<string, string[]>();
  descriptions = new Map<string, string>();

  constructor(tools: Tool[]) {
    this.buildIndex(tools);
  }

  buildIndex(tools: Tool[]): void {
    for (const tool of tools) {
      this.tools.set(tool.name, tool);
      this.descriptions.set(tool.name, tool.description);

      const category = this.categorizeTool(tool.name);
      if (!this.categories.has(category)) {
        this.categories.set(category, []);
      }
      this.categories.get(category)!.push(tool.name);
    }
  }

  categorizeTool(toolName: string): string {
    const lowerName = toolName.toLowerCase();

    if (
      ['bash', 'git', 'read', 'write', 'edit', 'file'].some((keyword) =>
        lowerName.includes(keyword)
      )
    ) {
      return 'filesystem';
    }

    if (
      ['github', 'issue', 'pr', 'pull', 'commit'].some((keyword) => lowerName.includes(keyword))
    ) {
      return 'github';
    }

    if (lowerName.includes('search') || lowerName.includes('research')) {
      return 'search';
    }

    if (lowerName.includes('plan') || lowerName.includes('todo')) {
      return 'planning';
    }

    if (lowerName.includes('deploy') || lowerName.includes('build')) {
      return 'deployment';
    }

    return 'other';
  }

  search(query: string, limit = 10): Tool[] {
    const lowerQuery = query.toLowerCase();
    const keywords = lowerQuery.split(/\s+/).filter((kw) => kw.length > 2);

    const scoredTools: Array<{ tool: Tool; score: number }> = [];

    for (const [toolName, tool] of this.tools.entries()) {
      let score = 0;

      const lowerToolName = toolName.toLowerCase();
      const lowerDesc = tool.description.toLowerCase();

      for (const keyword of keywords) {
        if (lowerToolName.includes(keyword)) {
          score += 10;
        }
        if (lowerDesc.includes(keyword)) {
          score += 5;
        }
      }

      if (lowerQuery === lowerToolName) {
        score += 100;
      }

      if (lowerDesc.includes(lowerQuery)) {
        score += 50;
      }

      if (score > 0) {
        scoredTools.push({ tool, score });
      }
    }

    scoredTools.sort((a, b) => b.score - a.score);

    return scoredTools.slice(0, limit).map((item) => item.tool);
  }

  searchByCategory(category: string): Tool[] {
    return this.categories.get(category)?.map((name) => this.tools.get(name)!) || [];
  }

  getAllCategories(): string[] {
    return Array.from(this.categories.keys());
  }

  getToolNames(): string[] {
    return Array.from(this.tools.keys());
  }

  getTool(name: string): Tool | undefined {
    return this.tools.get(name);
  }

  getToolCount(): number {
    return this.tools.size;
  }
}

const toolSearchInputSchema = z.object({
  query: z.string().min(1, 'Search query cannot be empty').max(200, 'Search query too long'),
  category: z.string().optional(),
  limit: z.number().min(1).max(50).default(10).optional(),
});

export class ToolSearchTool implements Tool {
  name = 'tool_search';
  description =
    'Search for available tools. Use this when you need to find a tool for a specific task. Returns tool definitions that you can then use.';

  inputSchema = toolSearchInputSchema;

  index: ToolSearchIndex | undefined;

  validate(input: ToolInput): boolean {
    const result = this.inputSchema.safeParse(input.content);
    return result.success;
  }

  initialize(tools: Tool[]): void {
    this.index = new ToolSearchIndex(tools);
  }

  async execute(input: ToolInput): Promise<ToolOutput> {
    const startTime = Date.now();

    try {
      if (!this.index) {
        return {
          status: 'error',
          content: 'Tool search index not initialized',
          error: {
            message: 'Tool search tool not initialized with available tools',
            code: 'NOT_INITIALIZED',
          },
        };
      }

      const parsed = this.inputSchema.safeParse(input.content);
      if (!parsed.success) {
        return {
          status: 'error',
          content: 'Invalid input',
          error: {
            message: `Invalid input: ${parsed.error.message}`,
            code: 'INVALID_INPUT',
          },
        };
      }

      const data = parsed.data;

      let matchingTools: Tool[];

      if (data.category) {
        matchingTools = this.index.searchByCategory(data.category);
      } else {
        matchingTools = this.index.search(data.query, data.limit);
      }

      if (matchingTools.length === 0) {
        const allCategories = this.index.getAllCategories().join(', ');
        return {
          status: 'success',
          content: `No tools found for query: "${data.query}"\n\nAvailable categories: ${allCategories}\nTotal tools: ${this.index.getToolCount()}`,
        };
      }

      const toolDefs = matchingTools.map((tool) => this.formatToolDefinition(tool)).join('\n\n');

      const duration = Date.now() - startTime;

      return {
        status: 'success',
        content: `Found ${matchingTools.length} tool(s):\n\n${toolDefs}`,
        metadata: {
          query: data.query,
          category: data.category,
          toolCount: matchingTools.length,
          duration,
        },
      };
    } catch (error) {
      return {
        status: 'error',
        content: 'An error occurred while searching for tools',
        error: {
          message: error instanceof Error ? error.message : String(error),
          code: 'SEARCH_ERROR',
        },
        metadata: { duration: Date.now() - startTime },
      };
    }
  }

  formatToolDefinition(tool: Tool): string {
    const lines: string[] = [];

    lines.push(`**${tool.name}**`);
    lines.push(`${tool.description}\n`);

    try {
      const schemaDef = tool.inputSchema._def;
      if (schemaDef && 'shape' in schemaDef && typeof schemaDef.shape === 'function') {
        const shape = schemaDef.shape();

        if (Object.keys(shape).length > 0) {
          lines.push('Parameters:');
          for (const [paramName, paramSchema] of Object.entries(shape)) {
            const description = this.getParameterDescription(paramSchema);
            lines.push(`  - \`${paramName}\`: ${description}`);
          }
          lines.push('');
        }
      }
    } catch (e) {
      lines.push('Parameters: (see tool definition)\n');
    }

    return lines.join('\n');
  }

  getParameterDescription(paramSchema: any): string {
    if (paramSchema._def?.description) {
      return paramSchema._def.description;
    }

    if (paramSchema._def?.type) {
      return paramSchema._def.type;
    }

    return 'parameter';
  }
}

export const toolSearchTool = new ToolSearchTool();
