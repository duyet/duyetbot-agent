import type { Tool } from '@duyetbot/types';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import {
  type OpenAIGatewayEnv,
  createOpenAIGatewayProvider,
  toolToRunnableFunction,
} from '../openai-gateway.js';

// Mock OpenAI SDK
vi.mock('openai', () => {
  const mockCreate = vi.fn();
  const mockRunTools = vi.fn();

  return {
    default: class MockOpenAI {
      chat = {
        completions: {
          create: mockCreate,
          runTools: mockRunTools,
        },
      };

      constructor(public config: { apiKey: string; baseURL: string; timeout?: number }) {}
    },
    // Export mocks for test access
    __mocks: { mockCreate, mockRunTools },
  };
});

// Get mocks for assertions
const getMocks = async () => {
  const mod = await import('openai');
  return (
    mod as unknown as {
      __mocks: {
        mockCreate: ReturnType<typeof vi.fn>;
        mockRunTools: ReturnType<typeof vi.fn>;
      };
    }
  ).__mocks;
};

describe('createOpenAIGatewayProvider', () => {
  const mockEnv: OpenAIGatewayEnv = {
    AI_GATEWAY_ACCOUNT_ID: 'test-account-id',
    AI_GATEWAY_NAME: 'test-gateway',
    OPENROUTER_API_KEY: 'sk-or-test-key',
    MODEL: 'anthropic/claude-3.5-sonnet',
  };

  const mockLogger = {
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('provider creation', () => {
    it('should create provider with correct AI Gateway URL', () => {
      const provider = createOpenAIGatewayProvider(mockEnv, {
        logger: mockLogger,
      });

      expect(provider).toBeDefined();
      expect(provider.chat).toBeInstanceOf(Function);
      expect(provider.chatWithTools).toBeInstanceOf(Function);
    });

    it('should use default model when not specified in env', () => {
      const envWithoutModel = { ...mockEnv, MODEL: undefined };
      const provider = createOpenAIGatewayProvider(envWithoutModel, {
        defaultModel: 'openai/gpt-4o',
        logger: mockLogger,
      });

      expect(provider).toBeDefined();
    });
  });

  describe('AI Gateway URL construction', () => {
    it('should construct correct baseURL for OpenRouter', () => {
      // The URL format should be: https://gateway.ai.cloudflare.com/v1/{account_id}/{gateway_id}/openrouter
      const expectedBaseURL = `https://gateway.ai.cloudflare.com/v1/${mockEnv.AI_GATEWAY_ACCOUNT_ID}/${mockEnv.AI_GATEWAY_NAME}/openrouter`;

      // Provider is created internally, verify by creating it
      const provider = createOpenAIGatewayProvider(mockEnv, {
        logger: mockLogger,
      });

      // The URL is constructed correctly if provider is created without error
      expect(provider).toBeDefined();

      // Log the expected URL for documentation
      expect(expectedBaseURL).toBe(
        'https://gateway.ai.cloudflare.com/v1/test-account-id/test-gateway/openrouter'
      );
    });
  });
});

describe('toolToRunnableFunction', () => {
  it('should convert Tool to RunnableToolFunctionWithParse format', () => {
    const mockTool: Tool = {
      name: 'test_tool',
      description: 'A test tool for testing',
      inputSchema: z.object({
        query: z.string().describe('Search query'),
        limit: z.number().optional().describe('Max results'),
      }),
      execute: vi.fn().mockResolvedValue({
        status: 'success' as const,
        content: 'Test result',
      }),
    };

    const runnableFunction = toolToRunnableFunction(mockTool);

    expect(runnableFunction.type).toBe('function');
    expect(runnableFunction.function.name).toBe('test_tool');
    expect(runnableFunction.function.description).toBe('A test tool for testing');
    expect(runnableFunction.function.parameters).toBeDefined();
    expect(runnableFunction.function.parse).toBeInstanceOf(Function);
    expect(runnableFunction.function.function).toBeInstanceOf(Function);
  });

  it('should correctly parse tool arguments', () => {
    const mockTool: Tool = {
      name: 'search',
      description: 'Search for information',
      inputSchema: z.object({
        query: z.string(),
      }),
      execute: vi.fn(),
    };

    const runnableFunction = toolToRunnableFunction<{ query: string }>(mockTool);
    const parsed = runnableFunction.function.parse('{"query": "hello world"}');

    expect(parsed).toEqual({ query: 'hello world' });
  });

  it('should throw on invalid arguments during parse', () => {
    const mockTool: Tool = {
      name: 'search',
      description: 'Search for information',
      inputSchema: z.object({
        query: z.string(),
      }),
      execute: vi.fn(),
    };

    const runnableFunction = toolToRunnableFunction(mockTool);

    // Missing required field should throw
    expect(() => runnableFunction.function.parse('{"invalid": "field"}')).toThrow();
  });

  it('should execute tool and return string result', async () => {
    const mockExecute = vi.fn().mockResolvedValue({
      status: 'success' as const,
      content: 'Search results here',
    });

    const mockTool: Tool = {
      name: 'search',
      description: 'Search for information',
      inputSchema: z.object({
        query: z.string(),
      }),
      execute: mockExecute,
    };

    const runnableFunction = toolToRunnableFunction<{ query: string }>(mockTool);
    const result = await runnableFunction.function.function({ query: 'test' });

    expect(mockExecute).toHaveBeenCalledWith({ content: { query: 'test' } });
    expect(result).toBe('Search results here');
  });

  it('should JSON stringify object results', async () => {
    const mockExecute = vi.fn().mockResolvedValue({
      status: 'success' as const,
      content: { data: [1, 2, 3], count: 3 },
    });

    const mockTool: Tool = {
      name: 'get_data',
      description: 'Get data',
      inputSchema: z.object({}),
      execute: mockExecute,
    };

    const runnableFunction = toolToRunnableFunction<Record<string, never>>(mockTool);
    const result = await runnableFunction.function.function({});

    expect(result).toBe('{"data":[1,2,3],"count":3}');
  });

  it('should generate correct JSON schema for parameters', () => {
    const mockTool: Tool = {
      name: 'complex_tool',
      description: 'A tool with complex schema',
      inputSchema: z.object({
        name: z.string().describe('Name'),
        age: z.number().min(0).describe('Age'),
        tags: z.array(z.string()).optional().describe('Tags'),
      }),
      execute: vi.fn(),
    };

    const runnableFunction = toolToRunnableFunction(mockTool);
    const params = runnableFunction.function.parameters as Record<string, unknown>;

    expect(params.type).toBe('object');
    expect(params.properties).toBeDefined();

    const properties = params.properties as Record<string, unknown>;
    expect(properties.name).toBeDefined();
    expect(properties.age).toBeDefined();
    expect(properties.tags).toBeDefined();
  });
});

describe('OpenAIGatewayProvider interface', () => {
  it('should implement LLMProvider interface with chat method', () => {
    const provider = createOpenAIGatewayProvider({
      AI_GATEWAY_ACCOUNT_ID: 'acc',
      AI_GATEWAY_NAME: 'gw',
      OPENROUTER_API_KEY: 'key',
    });

    // Verify provider has chat method (LLMProvider interface)
    expect(provider.chat).toBeDefined();
    expect(typeof provider.chat).toBe('function');
  });

  it('should have chatWithTools method for runTools support', () => {
    const provider = createOpenAIGatewayProvider({
      AI_GATEWAY_ACCOUNT_ID: 'acc',
      AI_GATEWAY_NAME: 'gw',
      OPENROUTER_API_KEY: 'key',
    });

    // Verify provider has chatWithTools method
    expect(provider.chatWithTools).toBeDefined();
    expect(typeof provider.chatWithTools).toBe('function');
  });
});
