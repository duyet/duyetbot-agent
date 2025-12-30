/**
 * Duyet MCP Client Tool
 *
 * Client for connecting to the duyet MCP server (https://mcp.duyet.net)
 * Provides access to Duyet's profile information, CV, blog posts, and GitHub activity.
 *
 * This tool calls the duyet MCP server's HTTP endpoints directly,
 * which is simpler than implementing the full MCP protocol for AI SDK v6.
 *
 * MCP Server: https://github.com/duyet/duyet-mcp-server
 */

import type { Tool, ToolInput, ToolOutput } from '@duyetbot/types';
import { z } from 'zod';

/**
 * Environment variables needed for duyet MCP client
 */
export interface DuyetMCPEnv {
  /** URL of the duyet MCP server (default: https://mcp.duyet.net) */
  DUYET_MCP_URL?: string;
}

/**
 * Duyet MCP client for making HTTP requests to the MCP server
 */
class DuyetMCPClient {
  private baseURL: string;

  constructor(env?: DuyetMCPEnv) {
    this.baseURL = (env?.DUYET_MCP_URL || 'https://mcp.duyet.net').replace(/\/$/, '');
  }

  /**
   * Make a request to the duyet MCP server
   */
  private async request(path: string, options?: RequestInit): Promise<unknown> {
    const url = `${this.baseURL}${path}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    });

    if (!response.ok) {
      throw new Error(`Duyet MCP server error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Get Duyet's about information
   * Corresponds to: duyet://about resource
   */
  async getAbout(): Promise<unknown> {
    return this.request('/api/resources/about');
  }

  /**
   * Get Duyet's CV in different formats
   * Corresponds to: get_cv tool
   */
  async getCV(format: 'summary' | 'detailed' | 'json' = 'detailed'): Promise<unknown> {
    return this.request(`/api/tools/cv?format=${format}`);
  }

  /**
   * Get blog posts
   * Corresponds to: get_blog_posts tool
   */
  async getBlogPosts(limit: number = 5): Promise<unknown> {
    return this.request(`/api/tools/blog/posts?limit=${limit}`);
  }

  /**
   * Get blog post content
   * Corresponds to: get_blog_post_content tool
   */
  async getBlogPostContent(url: string): Promise<unknown> {
    return this.request(`/api/tools/blog/post?url=${encodeURIComponent(url)}`);
  }

  /**
   * Get GitHub activity
   * Corresponds to: get_github_activity tool
   */
  async getGitHubActivity(limit: number = 10): Promise<unknown> {
    return this.request(`/api/tools/github/activity?limit=${limit}`);
  }

  /**
   * Send a message to Duyet
   * Corresponds to: send_message tool
   */
  async sendMessage(message: string, email?: string): Promise<unknown> {
    return this.request('/api/tools/message', {
      method: 'POST',
      body: JSON.stringify({ message, email }),
    });
  }

  /**
   * Get hiring information
   * Corresponds to: hire_me tool
   */
  async getHireInfo(): Promise<unknown> {
    return this.request('/api/tools/hire');
  }

  /**
   * Send a greeting
   * Corresponds to: say_hi tool
   */
  async sayHi(personalMessage?: string): Promise<unknown> {
    return this.request('/api/tools/hi', {
      method: 'POST',
      body: JSON.stringify({ message: personalMessage }),
    });
  }
}

/**
 * Create a duyet MCP client instance
 */
export function createDuyetMCPClient(env?: DuyetMCPEnv): DuyetMCPClient {
  return new DuyetMCPClient(env);
}

/**
 * Input schema for duyet MCP client tool
 */
const duyetMCPInputSchema = z.object({
  action: z.enum([
    'get_about',
    'get_cv',
    'get_blog_posts',
    'get_blog_post',
    'get_github_activity',
    'send_message',
    'get_hire_info',
    'say_hi',
  ]),
  format: z.enum(['summary', 'detailed', 'json']).optional(),
  limit: z.number().optional(),
  url: z.string().optional(),
  message: z.string().optional(),
  email: z.string().optional(),
});

export type DuyetMCPInput = z.infer<typeof duyetMCPInputSchema>;

/**
 * Helper to extract environment from ToolInput metadata
 */
function getEnvFromInput(input: ToolInput): DuyetMCPEnv | undefined {
  const metadata = input.metadata as { env?: DuyetMCPEnv } | undefined;
  return metadata?.env;
}

/**
 * Duyet MCP Client Tool for @duyetbot/tools
 *
 * This tool provides access to all duyet MCP server tools through a single interface.
 * The 'action' parameter determines which operation to perform.
 */
export const duyetMCPClientTool: Tool = {
  name: 'duyet_mcp_client',
  description: `Access information about Duyet including profile, CV, blog posts, GitHub activity, and contact options.

Available actions:
- get_about: Get basic information about Duyet (experience, skills, contact)
- get_cv: Get CV/resume in summary, detailed, or JSON format
- get_blog_posts: Get latest blog posts from blog.duyet.net
- get_blog_post: Get full content of a specific blog post by URL
- get_github_activity: Get recent GitHub contributions and activity
- send_message: Send a message to Duyet for collaboration or inquiries
- get_hire_info: Get information about hiring Duyet
- say_hi: Send a friendly greeting to Duyet`,
  inputSchema: duyetMCPInputSchema,
  async execute(input: ToolInput): Promise<ToolOutput> {
    const client = createDuyetMCPClient(getEnvFromInput(input));

    // Parse and validate input
    const parsedInput = duyetMCPInputSchema.parse(
      typeof input.content === 'string'
        ? JSON.parse(input.content)
        : input.content
    );

    const { action, ...params } = parsedInput;

    try {
      let result: unknown;

      switch (action) {
        case 'get_about':
          result = await client.getAbout();
          break;

        case 'get_cv':
          result = await client.getCV(params.format || 'detailed');
          break;

        case 'get_blog_posts':
          result = await client.getBlogPosts(params.limit || 5);
          break;

        case 'get_blog_post':
          if (!params.url) {
            throw new Error('url parameter is required for get_blog_post action');
          }
          result = await client.getBlogPostContent(params.url);
          break;

        case 'get_github_activity':
          result = await client.getGitHubActivity(params.limit || 10);
          break;

        case 'send_message':
          if (!params.message) {
            throw new Error('message parameter is required for send_message action');
          }
          result = await client.sendMessage(params.message, params.email);
          break;

        case 'get_hire_info':
          result = await client.getHireInfo();
          break;

        case 'say_hi':
          result = await client.sayHi(params.message);
          break;

        default:
          throw new Error(`Unknown action: ${action}`);
      }

      return {
        status: 'success',
        content: result as string | Record<string, unknown>,
        metadata: { action },
      };
    } catch (error) {
      return {
        status: 'error',
        content: '',
        error: {
          message: error instanceof Error ? error.message : String(error),
        },
        metadata: { action },
      };
    }
  },
};

/**
 * AI SDK v6 wrapper for duyet MCP client
 *
 * Use this directly with AI SDK's streamText() tools parameter
 * Note: The duyetMCPClientTool already works with AI SDK v6 via agent-tools.ts conversion
 */
export const duyetMCPClientToolForAI = duyetMCPClientTool;
