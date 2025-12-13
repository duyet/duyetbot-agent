import type { PlatformConfig } from '../agents/base-agent.js';
import type { CloudflareAgentState } from '../cloudflare-agent.js';

export interface CommandContext {
  /** Is the user an admin */
  isAdmin?: boolean;
  /** Username of the caller */
  username?: string;
  /** Parse mode for response formatting */
  parseMode?: 'HTML' | 'MarkdownV2';
  /** Current agent state */
  state: CloudflareAgentState;
  /** Function to update agent state */
  setState: (newState: CloudflareAgentState) => void;
  /** Reset MCP connection state */
  resetMcp?: () => void;
  /** Agent configuration */
  config: {
    welcomeMessage?: string;
    helpMessage?: string;
    tools?: Array<{ name: string; description?: string }>;
    mcpServers?: Array<{ name: string; url: string }>;
    maxHistory?: number;
    maxToolIterations?: number;
    maxTools?: number;
    thinkingRotationInterval?: number;
    router?: {
      platform: string;
      debug?: boolean;
    };
  };
}

export type CommandHandler = (text: string, ctx: CommandContext) => Promise<string | null>;
