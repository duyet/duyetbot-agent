import { z } from 'zod';

export const configSchema = z.object({
  // OpenRouter API key for LLM access
  openrouterApiKey: z.string().min(1),

  // GitHub token for API operations
  githubToken: z.string().min(1),

  // Memory MCP URL (optional)
  memoryMcpUrl: z.string().url().optional(),

  // Model to use
  model: z.string().default('anthropic/claude-sonnet-4'),

  // Task sources to check
  taskSources: z
    .array(z.enum(['github-issues', 'file', 'memory']))
    .default(['github-issues', 'file', 'memory']),

  // Max iterations per task
  maxIterations: z.number().default(10),

  // Checkpoint directory
  checkpointDir: z.string().default('.agent/checkpoints'),

  // Log directory
  logDir: z.string().default('.agent/logs'),

  // Dry run mode (don't make real changes)
  dryRun: z.boolean().default(false),

  // Repository info
  repository: z
    .object({
      owner: z.string(),
      name: z.string(),
    })
    .optional(),
});

export type Config = z.infer<typeof configSchema>;

export function loadConfig(): Config {
  return configSchema.parse({
    openrouterApiKey: process.env.OPENROUTER_API_KEY,
    githubToken: process.env.GITHUB_TOKEN,
    memoryMcpUrl: process.env.MEMORY_MCP_URL,
    model: process.env.MODEL,
    dryRun: process.env.DRY_RUN === 'true',
    repository: process.env.GITHUB_REPOSITORY
      ? {
          owner: process.env.GITHUB_REPOSITORY.split('/')[0],
          name: process.env.GITHUB_REPOSITORY.split('/')[1],
        }
      : undefined,
  });
}
