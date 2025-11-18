import { BashTool } from '@/tools/bash';
import { PlanTool } from '@/tools/plan';
import { ToolRegistry } from '@/tools/registry';
import { SleepTool } from '@/tools/sleep';
import type { Tool } from '@/tools/types';
import { beforeEach, describe, expect, it } from 'vitest';

describe('ToolRegistry', () => {
  let registry: ToolRegistry;

  beforeEach(() => {
    registry = new ToolRegistry();
  });

  describe('registration', () => {
    it('should register a tool', () => {
      const tool = new SleepTool();
      registry.register(tool);

      expect(registry.has('sleep')).toBe(true);
    });

    it('should register multiple tools', () => {
      registry.register(new SleepTool());
      registry.register(new PlanTool());
      registry.register(new BashTool());

      expect(registry.has('sleep')).toBe(true);
      expect(registry.has('plan')).toBe(true);
      expect(registry.has('bash')).toBe(true);
    });

    it('should throw error when registering duplicate tool', () => {
      const tool = new SleepTool();
      registry.register(tool);

      expect(() => registry.register(tool)).toThrow('Tool "sleep" is already registered');
    });

    it('should allow overriding existing tool', () => {
      const tool1 = new SleepTool();
      const tool2 = new SleepTool();

      registry.register(tool1);
      registry.register(tool2, { override: true });

      expect(registry.get('sleep')).toBe(tool2);
    });
  });

  describe('retrieval', () => {
    it('should get registered tool', () => {
      const tool = new SleepTool();
      registry.register(tool);

      const retrieved = registry.get('sleep');
      expect(retrieved).toBe(tool);
      expect(retrieved.name).toBe('sleep');
    });

    it('should throw error for unregistered tool', () => {
      expect(() => registry.get('unknown')).toThrow('Tool "unknown" is not registered');
    });

    it('should check tool existence', () => {
      registry.register(new SleepTool());

      expect(registry.has('sleep')).toBe(true);
      expect(registry.has('unknown')).toBe(false);
    });
  });

  describe('listing', () => {
    it('should list all registered tool names', () => {
      registry.register(new SleepTool());
      registry.register(new PlanTool());
      registry.register(new BashTool());

      const names = registry.list();
      expect(names).toEqual(['sleep', 'plan', 'bash']);
    });

    it('should return empty array when no tools registered', () => {
      expect(registry.list()).toEqual([]);
    });

    it('should get all tool instances', () => {
      const sleep = new SleepTool();
      const plan = new PlanTool();

      registry.register(sleep);
      registry.register(plan);

      const tools = registry.getAll();
      expect(tools).toHaveLength(2);
      expect(tools).toContain(sleep);
      expect(tools).toContain(plan);
    });
  });

  describe('unregistration', () => {
    it('should unregister a tool', () => {
      registry.register(new SleepTool());
      expect(registry.has('sleep')).toBe(true);

      registry.unregister('sleep');
      expect(registry.has('sleep')).toBe(false);
    });

    it('should not throw when unregistering non-existent tool', () => {
      expect(() => registry.unregister('unknown')).not.toThrow();
    });

    it('should clear all tools', () => {
      registry.register(new SleepTool());
      registry.register(new PlanTool());
      registry.register(new BashTool());

      registry.clear();

      expect(registry.list()).toEqual([]);
      expect(registry.has('sleep')).toBe(false);
      expect(registry.has('plan')).toBe(false);
      expect(registry.has('bash')).toBe(false);
    });
  });

  describe('execution', () => {
    it('should execute tool by name', async () => {
      registry.register(new SleepTool());

      const result = await registry.execute('sleep', { content: { duration: 10 } });

      expect(result.status).toBe('success');
      expect(result.metadata?.duration).toBe(10);
    });

    it('should throw error when executing unregistered tool', async () => {
      await expect(registry.execute('unknown', { content: {} })).rejects.toThrow(
        'Tool "unknown" is not registered'
      );
    });

    it('should execute tool with proper input', async () => {
      registry.register(new PlanTool());

      const result = await registry.execute('plan', {
        content: { task: 'Build API' },
      });

      expect(result.status).toBe('success');
      expect(result.metadata?.steps).toBeDefined();
    });
  });

  describe('validation', () => {
    it('should validate input for tool', () => {
      registry.register(new SleepTool());

      const valid = registry.validate('sleep', { content: { duration: 1000 } });
      expect(valid).toBe(true);
    });

    it('should return false for invalid input', () => {
      registry.register(new SleepTool());

      const valid = registry.validate('sleep', { content: { duration: -1000 } });
      expect(valid).toBe(false);
    });

    it('should throw error when validating unregistered tool', () => {
      expect(() => registry.validate('unknown', { content: {} })).toThrow(
        'Tool "unknown" is not registered'
      );
    });

    it('should handle tools without validate method', () => {
      const toolWithoutValidate: Tool = {
        name: 'no-validate',
        description: 'Tool without validate',
        inputSchema: {} as any,
        execute: async () => ({ status: 'success', content: 'ok' }),
      };

      registry.register(toolWithoutValidate);
      expect(registry.validate('no-validate', { content: {} })).toBe(true);
    });
  });

  describe('filtering', () => {
    it('should filter tools by predicate', () => {
      registry.register(new SleepTool());
      registry.register(new PlanTool());
      registry.register(new BashTool());

      const filtered = registry.filter((tool) => tool.name.startsWith('s'));
      expect(filtered).toHaveLength(1);
      expect(filtered[0]?.name).toBe('sleep');
    });

    it('should find tool by predicate', () => {
      registry.register(new SleepTool());
      registry.register(new PlanTool());

      const found = registry.find((tool) => tool.name === 'plan');
      expect(found?.name).toBe('plan');
    });

    it('should return undefined when find has no match', () => {
      registry.register(new SleepTool());

      const found = registry.find((tool) => tool.name === 'unknown');
      expect(found).toBeUndefined();
    });
  });

  describe('bulk operations', () => {
    it('should register multiple tools at once', () => {
      const tools = [new SleepTool(), new PlanTool(), new BashTool()];

      registry.registerAll(tools);

      expect(registry.list()).toEqual(['sleep', 'plan', 'bash']);
    });

    it('should throw on duplicate when bulk registering', () => {
      const tools = [new SleepTool(), new SleepTool()];

      expect(() => registry.registerAll(tools)).toThrow();
    });

    it('should allow override when bulk registering', () => {
      registry.register(new SleepTool());

      const tools = [new SleepTool(), new PlanTool()];
      registry.registerAll(tools, { override: true });

      expect(registry.list()).toEqual(['sleep', 'plan']);
    });
  });

  describe('metadata', () => {
    it('should get tool metadata', () => {
      registry.register(new SleepTool());

      const metadata = registry.getMetadata('sleep');
      expect(metadata.name).toBe('sleep');
      expect(metadata.description).toBeDefined();
      expect(metadata.inputSchema).toBeDefined();
    });

    it('should throw when getting metadata for unregistered tool', () => {
      expect(() => registry.getMetadata('unknown')).toThrow('Tool "unknown" is not registered');
    });

    it('should get metadata for all tools', () => {
      registry.register(new SleepTool());
      registry.register(new PlanTool());

      const allMetadata = registry.getAllMetadata();
      expect(allMetadata).toHaveLength(2);
      expect(allMetadata[0]?.name).toBeDefined();
      expect(allMetadata[1]?.name).toBeDefined();
    });
  });

  describe('singleton instance', () => {
    it('should export default registry instance', async () => {
      const module = await import('@/tools/registry');
      expect(module.toolRegistry).toBeInstanceOf(ToolRegistry);
    });
  });
});
