import type { Tool, ToolInput, ToolOutput } from '@duyetbot/types';
import { beforeEach, describe, expect, it } from 'vitest';
import { ToolRegistry, toolRegistry } from '../registry.js';

// Mock tool for testing
class MockTool implements Tool {
  name: string;
  description = 'Mock tool for testing';
  inputSchema = {};
  validateCalled = false;

  constructor(name = 'mock') {
    this.name = name;
  }

  validate(_input: ToolInput): boolean {
    this.validateCalled = true;
    return true;
  }

  async execute(input: ToolInput): Promise<ToolOutput> {
    return {
      status: 'success',
      content: `Executed ${this.name} with ${JSON.stringify(input.content)}`,
    };
  }
}

describe('ToolRegistry', () => {
  let registry: ToolRegistry;

  beforeEach(() => {
    registry = new ToolRegistry();
  });

  describe('register', () => {
    it('should register a tool', () => {
      const tool = new MockTool('test');
      registry.register(tool);

      expect(registry.has('test')).toBe(true);
    });

    it('should throw error when registering duplicate tool', () => {
      const tool1 = new MockTool('test');
      const tool2 = new MockTool('test');

      registry.register(tool1);

      expect(() => registry.register(tool2)).toThrow('Tool "test" is already registered');
    });

    it('should allow override when option is set', () => {
      const tool1 = new MockTool('test');
      const tool2 = new MockTool('test');
      tool2.description = 'Updated description';

      registry.register(tool1);
      registry.register(tool2, { override: true });

      expect(registry.get('test').description).toBe('Updated description');
    });
  });

  describe('registerAll', () => {
    it('should register multiple tools', () => {
      const tools = [new MockTool('tool1'), new MockTool('tool2'), new MockTool('tool3')];

      registry.registerAll(tools);

      expect(registry.has('tool1')).toBe(true);
      expect(registry.has('tool2')).toBe(true);
      expect(registry.has('tool3')).toBe(true);
    });

    it('should throw error for duplicate in batch', () => {
      const tools = [new MockTool('tool1'), new MockTool('tool1')];

      expect(() => registry.registerAll(tools)).toThrow('Tool "tool1" is already registered');
    });
  });

  describe('get', () => {
    it('should get a registered tool', () => {
      const tool = new MockTool('test');
      registry.register(tool);

      expect(registry.get('test')).toBe(tool);
    });

    it('should throw error for unregistered tool', () => {
      expect(() => registry.get('unknown')).toThrow('Tool "unknown" is not registered');
    });
  });

  describe('getAll', () => {
    it('should get all registered tools', () => {
      const tool1 = new MockTool('tool1');
      const tool2 = new MockTool('tool2');

      registry.register(tool1);
      registry.register(tool2);

      const all = registry.getAll();
      expect(all).toHaveLength(2);
      expect(all).toContain(tool1);
      expect(all).toContain(tool2);
    });

    it('should return empty array when no tools registered', () => {
      expect(registry.getAll()).toEqual([]);
    });
  });

  describe('has', () => {
    it('should return true for registered tool', () => {
      registry.register(new MockTool('test'));
      expect(registry.has('test')).toBe(true);
    });

    it('should return false for unregistered tool', () => {
      expect(registry.has('unknown')).toBe(false);
    });
  });

  describe('list', () => {
    it('should list all registered tool names', () => {
      registry.register(new MockTool('alpha'));
      registry.register(new MockTool('beta'));
      registry.register(new MockTool('gamma'));

      const list = registry.list();
      expect(list).toHaveLength(3);
      expect(list).toContain('alpha');
      expect(list).toContain('beta');
      expect(list).toContain('gamma');
    });

    it('should return empty array when no tools registered', () => {
      expect(registry.list()).toEqual([]);
    });
  });

  describe('unregister', () => {
    it('should unregister a tool', () => {
      registry.register(new MockTool('test'));
      expect(registry.has('test')).toBe(true);

      registry.unregister('test');
      expect(registry.has('test')).toBe(false);
    });

    it('should not throw when unregistering non-existent tool', () => {
      expect(() => registry.unregister('unknown')).not.toThrow();
    });
  });

  describe('clear', () => {
    it('should clear all tools', () => {
      registry.register(new MockTool('tool1'));
      registry.register(new MockTool('tool2'));

      registry.clear();

      expect(registry.list()).toEqual([]);
      expect(registry.has('tool1')).toBe(false);
      expect(registry.has('tool2')).toBe(false);
    });
  });

  describe('execute', () => {
    it('should execute a tool by name', async () => {
      const tool = new MockTool('test');
      registry.register(tool);

      const result = await registry.execute('test', { content: 'hello' });

      expect(result.status).toBe('success');
      expect(result.content).toContain('Executed test');
    });

    it('should throw error for unregistered tool', async () => {
      await expect(registry.execute('unknown', { content: '' })).rejects.toThrow(
        'Tool "unknown" is not registered'
      );
    });
  });

  describe('validate', () => {
    it('should validate input for a tool', () => {
      const tool = new MockTool('test');
      registry.register(tool);

      const result = registry.validate('test', { content: 'test' });

      expect(result).toBe(true);
      expect(tool.validateCalled).toBe(true);
    });

    it('should return true when tool has no validate method', () => {
      const tool = new MockTool('test');
      // @ts-expect-error - testing without validate method
      tool.validate = undefined;

      registry.register(tool);

      expect(registry.validate('test', { content: '' })).toBe(true);
    });
  });

  describe('filter', () => {
    it('should filter tools by predicate', () => {
      registry.register(new MockTool('tool1'));
      registry.register(new MockTool('tool2'));
      registry.register(new MockTool('other'));

      const filtered = registry.filter((tool) => tool.name.startsWith('tool'));

      expect(filtered).toHaveLength(2);
      expect(filtered.map((t) => t.name)).toContain('tool1');
      expect(filtered.map((t) => t.name)).toContain('tool2');
    });

    it('should return empty array when no matches', () => {
      registry.register(new MockTool('test'));

      const filtered = registry.filter((tool) => tool.name === 'none');

      expect(filtered).toEqual([]);
    });
  });

  describe('find', () => {
    it('should find a tool by predicate', () => {
      registry.register(new MockTool('tool1'));
      registry.register(new MockTool('tool2'));

      const found = registry.find((tool) => tool.name === 'tool2');

      expect(found).toBeDefined();
      expect(found?.name).toBe('tool2');
    });

    it('should return undefined when not found', () => {
      registry.register(new MockTool('test'));

      const found = registry.find((tool) => tool.name === 'none');

      expect(found).toBeUndefined();
    });
  });

  describe('getMetadata', () => {
    it('should get tool metadata', () => {
      const tool = new MockTool('test');
      registry.register(tool);

      const metadata = registry.getMetadata('test');

      expect(metadata.name).toBe('test');
      expect(metadata.description).toBe('Mock tool for testing');
      expect(metadata.inputSchema).toEqual({});
    });

    it('should throw error for unregistered tool', () => {
      expect(() => registry.getMetadata('unknown')).toThrow('Tool "unknown" is not registered');
    });
  });

  describe('getAllMetadata', () => {
    it('should get metadata for all tools', () => {
      registry.register(new MockTool('tool1'));
      registry.register(new MockTool('tool2'));

      const metadata = registry.getAllMetadata();

      expect(metadata).toHaveLength(2);
      expect(metadata.find((m) => m.name === 'tool1')).toBeDefined();
      expect(metadata.find((m) => m.name === 'tool2')).toBeDefined();
    });

    it('should return empty array when no tools registered', () => {
      expect(registry.getAllMetadata()).toEqual([]);
    });
  });
});

describe('toolRegistry singleton', () => {
  it('should be an instance of ToolRegistry', () => {
    expect(toolRegistry).toBeInstanceOf(ToolRegistry);
  });
});
