import { PlanTool } from '@/tools/plan';
import type { ToolInput } from '@/tools/types';
import { beforeEach, describe, expect, it } from 'vitest';

describe('PlanTool', () => {
  let planTool: PlanTool;

  beforeEach(() => {
    planTool = new PlanTool();
  });

  describe('tool definition', () => {
    it('should have correct name', () => {
      expect(planTool.name).toBe('plan');
    });

    it('should have description', () => {
      expect(planTool.description).toBeDefined();
      expect(planTool.description.length).toBeGreaterThan(0);
    });

    it('should have input schema', () => {
      expect(planTool.inputSchema).toBeDefined();
    });
  });

  describe('validation', () => {
    it('should validate correct input with task description', () => {
      const input: ToolInput = {
        content: { task: 'Build a REST API for user management' },
      };

      const result = planTool.validate?.(input);
      expect(result).toBe(true);
    });

    it('should validate input with string task', () => {
      const input: ToolInput = {
        content: 'Create a web scraper for news articles',
      };

      const result = planTool.validate?.(input);
      expect(result).toBe(true);
    });

    it('should validate input with context', () => {
      const input: ToolInput = {
        content: {
          task: 'Implement authentication',
          context: 'Using JWT tokens with refresh mechanism',
        },
      };

      const result = planTool.validate?.(input);
      expect(result).toBe(true);
    });

    it('should reject empty task', () => {
      const input: ToolInput = {
        content: { task: '' },
      };

      const result = planTool.validate?.(input);
      expect(result).toBe(false);
    });

    it('should reject invalid input type', () => {
      const input: ToolInput = {
        content: 123 as unknown as string,
      };

      const result = planTool.validate?.(input);
      expect(result).toBe(false);
    });
  });

  describe('execution', () => {
    it('should create plan from simple task', async () => {
      const result = await planTool.execute({
        content: { task: 'Build a todo app' },
      });

      expect(result.status).toBe('success');
      expect(result.metadata?.steps).toBeDefined();
      expect(Array.isArray(result.metadata?.steps)).toBe(true);
      expect((result.metadata?.steps as unknown[]).length).toBeGreaterThan(0);
    });

    it('should create plan from string task', async () => {
      const result = await planTool.execute({
        content: 'Deploy app to production',
      });

      expect(result.status).toBe('success');
      expect(result.metadata?.steps).toBeDefined();
    });

    it('should include task context in plan', async () => {
      const result = await planTool.execute({
        content: {
          task: 'Setup CI/CD pipeline',
          context: 'Using GitHub Actions for Node.js project',
        },
      });

      expect(result.status).toBe('success');
      expect(result.metadata?.steps).toBeDefined();
      expect(result.metadata?.context).toBe('Using GitHub Actions for Node.js project');
    });

    it('should return steps with titles and descriptions', async () => {
      const result = await planTool.execute({
        content: { task: 'Create a blog platform' },
      });

      expect(result.status).toBe('success');
      const steps = result.metadata?.steps as Array<{ title: string; description: string }>;
      expect(steps).toBeDefined();
      expect(steps.length).toBeGreaterThan(0);

      for (const step of steps) {
        expect(step.title).toBeDefined();
        expect(typeof step.title).toBe('string');
        expect(step.title.length).toBeGreaterThan(0);
      }
    });

    it('should support optional constraints', async () => {
      const result = await planTool.execute({
        content: {
          task: 'Migrate database',
          context: 'PostgreSQL to MongoDB',
          constraints: ['Zero downtime', 'Data integrity', 'Rollback capability'],
        },
      });

      expect(result.status).toBe('success');
      expect(result.metadata?.constraints).toEqual([
        'Zero downtime',
        'Data integrity',
        'Rollback capability',
      ]);
    });

    it('should include estimated complexity', async () => {
      const result = await planTool.execute({
        content: { task: 'Implement OAuth2 flow' },
      });

      expect(result.status).toBe('success');
      expect(result.metadata?.complexity).toBeDefined();
      expect(['low', 'medium', 'high']).toContain(result.metadata?.complexity);
    });

    it('should return success status with formatted plan', async () => {
      const result = await planTool.execute({
        content: { task: 'Setup monitoring' },
      });

      expect(result.status).toBe('success');
      expect(result.content).toBeDefined();
      expect(typeof result.content).toBe('string');
      expect(result.content.length).toBeGreaterThan(0);
    });
  });

  describe('error handling', () => {
    it('should return error for missing task', async () => {
      const result = await planTool.execute({
        content: {},
      });

      expect(result.status).toBe('error');
      expect(result.error?.message).toContain('task');
    });

    it('should return error for empty task string', async () => {
      const result = await planTool.execute({
        content: '',
      });

      expect(result.status).toBe('error');
      expect(result.error?.code).toBe('INVALID_INPUT');
    });

    it('should return error for invalid input type', async () => {
      const result = await planTool.execute({
        content: null as unknown as string,
      });

      expect(result.status).toBe('error');
    });

    it('should handle very long task descriptions', async () => {
      const longTask = 'A'.repeat(10000);
      const result = await planTool.execute({
        content: { task: longTask },
      });

      expect(result.status).toBe('error');
      expect(result.error?.code).toBe('TASK_TOO_LONG');
    });
  });

  describe('plan formatting', () => {
    it('should format plan as markdown', async () => {
      const result = await planTool.execute({
        content: { task: 'Build API' },
      });

      expect(result.status).toBe('success');
      expect(result.content).toContain('#');
      expect(result.content).toContain('Step');
    });

    it('should number steps sequentially', async () => {
      const result = await planTool.execute({
        content: { task: 'Setup project' },
      });

      expect(result.status).toBe('success');
      const steps = result.metadata?.steps as Array<{ title: string }>;
      expect(steps.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('integration', () => {
    it('should support reason in metadata', async () => {
      const result = await planTool.execute({
        content: { task: 'Refactor codebase' },
        metadata: { reason: 'Technical debt reduction' },
      });

      expect(result.status).toBe('success');
      expect(result.metadata?.reason).toBe('Technical debt reduction');
    });

    it('should handle concurrent executions', async () => {
      const tasks = [
        planTool.execute({ content: { task: 'Task 1' } }),
        planTool.execute({ content: { task: 'Task 2' } }),
        planTool.execute({ content: { task: 'Task 3' } }),
      ];

      const results = await Promise.all(tasks);

      for (const result of results) {
        expect(result.status).toBe('success');
      }
    });
  });
});
