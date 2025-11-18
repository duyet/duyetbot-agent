import { describe, expect, it } from 'vitest';
import {
  DUYETBOT_SYSTEM_PROMPT,
  RESEARCH_AGENT_PROMPT,
  CODE_REVIEWER_PROMPT,
  TASK_PLANNER_PROMPT,
  getSystemPrompt,
  buildSystemPrompt,
  type AgentType,
} from '@/prompts/system';

describe('System Prompts', () => {
  describe('DUYETBOT_SYSTEM_PROMPT', () => {
    it('should define the agent role', () => {
      expect(DUYETBOT_SYSTEM_PROMPT).toContain('duyetbot');
      expect(DUYETBOT_SYSTEM_PROMPT).toContain('software development agent');
    });

    it('should list available tools', () => {
      expect(DUYETBOT_SYSTEM_PROMPT).toContain('bash');
      expect(DUYETBOT_SYSTEM_PROMPT).toContain('git');
      expect(DUYETBOT_SYSTEM_PROMPT).toContain('plan');
      expect(DUYETBOT_SYSTEM_PROMPT).toContain('sleep');
    });

    it('should include XML tag structure guidance', () => {
      expect(DUYETBOT_SYSTEM_PROMPT).toContain('<thinking>');
      expect(DUYETBOT_SYSTEM_PROMPT).toContain('<plan>');
      expect(DUYETBOT_SYSTEM_PROMPT).toContain('<execution>');
      expect(DUYETBOT_SYSTEM_PROMPT).toContain('<result>');
    });

    it('should include behavior guidelines', () => {
      expect(DUYETBOT_SYSTEM_PROMPT).toContain('Task Approach');
      expect(DUYETBOT_SYSTEM_PROMPT).toContain('Code Quality');
      expect(DUYETBOT_SYSTEM_PROMPT).toContain('Git Workflow');
      expect(DUYETBOT_SYSTEM_PROMPT).toContain('Safety');
    });

    it('should include error handling guidance', () => {
      expect(DUYETBOT_SYSTEM_PROMPT).toContain('Error Handling');
      expect(DUYETBOT_SYSTEM_PROMPT).toContain('Diagnose');
    });

    it('should define restrictions', () => {
      expect(DUYETBOT_SYSTEM_PROMPT).toContain('Restrictions');
      expect(DUYETBOT_SYSTEM_PROMPT).toContain('Cannot');
      expect(DUYETBOT_SYSTEM_PROMPT).toContain('Confirm before');
    });
  });

  describe('RESEARCH_AGENT_PROMPT', () => {
    it('should define research specialist role', () => {
      expect(RESEARCH_AGENT_PROMPT).toContain('research specialist');
      expect(RESEARCH_AGENT_PROMPT).toContain('information gathering');
    });

    it('should include research methodology', () => {
      expect(RESEARCH_AGENT_PROMPT).toContain('Research Methodology');
      expect(RESEARCH_AGENT_PROMPT).toContain('Clarify');
      expect(RESEARCH_AGENT_PROMPT).toContain('Search');
      expect(RESEARCH_AGENT_PROMPT).toContain('Validate');
      expect(RESEARCH_AGENT_PROMPT).toContain('Synthesize');
    });

    it('should use XML structure for research outputs', () => {
      expect(RESEARCH_AGENT_PROMPT).toContain('<query>');
      expect(RESEARCH_AGENT_PROMPT).toContain('<sources>');
      expect(RESEARCH_AGENT_PROMPT).toContain('<findings>');
      expect(RESEARCH_AGENT_PROMPT).toContain('<synthesis>');
    });
  });

  describe('CODE_REVIEWER_PROMPT', () => {
    it('should define senior engineer role', () => {
      expect(CODE_REVIEWER_PROMPT).toContain('senior software engineer');
      expect(CODE_REVIEWER_PROMPT).toContain('code review');
    });

    it('should list review focus areas', () => {
      expect(CODE_REVIEWER_PROMPT).toContain('Correctness');
      expect(CODE_REVIEWER_PROMPT).toContain('Security');
      expect(CODE_REVIEWER_PROMPT).toContain('Performance');
      expect(CODE_REVIEWER_PROMPT).toContain('Maintainability');
    });

    it('should use structured review format', () => {
      expect(CODE_REVIEWER_PROMPT).toContain('<summary>');
      expect(CODE_REVIEWER_PROMPT).toContain('<critical>');
      expect(CODE_REVIEWER_PROMPT).toContain('<suggestions>');
      expect(CODE_REVIEWER_PROMPT).toContain('<praise>');
    });

    it('should include review principles', () => {
      expect(CODE_REVIEWER_PROMPT).toContain('Review Principles');
      expect(CODE_REVIEWER_PROMPT).toContain('specific');
      expect(CODE_REVIEWER_PROMPT).toContain('concrete examples');
    });
  });

  describe('TASK_PLANNER_PROMPT', () => {
    it('should define task planning specialist role', () => {
      expect(TASK_PLANNER_PROMPT).toContain('task planning specialist');
      expect(TASK_PLANNER_PROMPT).toContain('decomposition');
    });

    it('should include planning approach', () => {
      expect(TASK_PLANNER_PROMPT).toContain('Planning Approach');
      expect(TASK_PLANNER_PROMPT).toContain('Understand');
      expect(TASK_PLANNER_PROMPT).toContain('Decompose');
      expect(TASK_PLANNER_PROMPT).toContain('Sequence');
    });

    it('should use structured task format', () => {
      expect(TASK_PLANNER_PROMPT).toContain('<goal>');
      expect(TASK_PLANNER_PROMPT).toContain('<tasks>');
      expect(TASK_PLANNER_PROMPT).toContain('<dependencies>');
      expect(TASK_PLANNER_PROMPT).toContain('<risks>');
    });
  });

  describe('getSystemPrompt', () => {
    it('should return default prompt for "default" type', () => {
      const prompt = getSystemPrompt('default');
      expect(prompt).toBe(DUYETBOT_SYSTEM_PROMPT);
    });

    it('should return research prompt for "research" type', () => {
      const prompt = getSystemPrompt('research');
      expect(prompt).toBe(RESEARCH_AGENT_PROMPT);
    });

    it('should return reviewer prompt for "reviewer" type', () => {
      const prompt = getSystemPrompt('reviewer');
      expect(prompt).toBe(CODE_REVIEWER_PROMPT);
    });

    it('should return planner prompt for "planner" type', () => {
      const prompt = getSystemPrompt('planner');
      expect(prompt).toBe(TASK_PLANNER_PROMPT);
    });

    it('should return default prompt for unknown type', () => {
      const prompt = getSystemPrompt('unknown' as AgentType);
      expect(prompt).toBe(DUYETBOT_SYSTEM_PROMPT);
    });
  });

  describe('buildSystemPrompt', () => {
    it('should return base prompt without customization', () => {
      const prompt = buildSystemPrompt({ type: 'default' });
      expect(prompt).toBe(DUYETBOT_SYSTEM_PROMPT);
    });

    it('should use custom prompt when provided', () => {
      const customPrompt = 'You are a custom agent.';
      const prompt = buildSystemPrompt({
        type: 'default',
        customPrompt,
      });
      expect(prompt).toContain(customPrompt);
      expect(prompt).not.toContain('duyetbot');
    });

    it('should append additional context when provided', () => {
      const additionalContext = 'This is additional context.';
      const prompt = buildSystemPrompt({
        type: 'default',
        additionalContext,
      });
      expect(prompt).toContain(DUYETBOT_SYSTEM_PROMPT);
      expect(prompt).toContain('Additional Context');
      expect(prompt).toContain(additionalContext);
    });

    it('should combine custom prompt with additional context', () => {
      const customPrompt = 'Custom agent.';
      const additionalContext = 'Extra info.';
      const prompt = buildSystemPrompt({
        type: 'default',
        customPrompt,
        additionalContext,
      });
      expect(prompt).toContain(customPrompt);
      expect(prompt).toContain('Additional Context');
      expect(prompt).toContain(additionalContext);
    });

    it('should work with different agent types', () => {
      const researchPrompt = buildSystemPrompt({
        type: 'research',
        additionalContext: 'Focus on academic sources.',
      });
      expect(researchPrompt).toContain('research specialist');
      expect(researchPrompt).toContain('Focus on academic sources');

      const reviewerPrompt = buildSystemPrompt({
        type: 'reviewer',
        additionalContext: 'Emphasize security issues.',
      });
      expect(reviewerPrompt).toContain('senior software engineer');
      expect(reviewerPrompt).toContain('Emphasize security issues');
    });
  });

  describe('Prompt Quality', () => {
    it('should have prompts with minimum length', () => {
      expect(DUYETBOT_SYSTEM_PROMPT.length).toBeGreaterThan(500);
      expect(RESEARCH_AGENT_PROMPT.length).toBeGreaterThan(300);
      expect(CODE_REVIEWER_PROMPT.length).toBeGreaterThan(300);
      expect(TASK_PLANNER_PROMPT.length).toBeGreaterThan(300);
    });

    it('should not have trailing whitespace in prompts', () => {
      expect(DUYETBOT_SYSTEM_PROMPT).not.toMatch(/\s$/);
      expect(RESEARCH_AGENT_PROMPT).not.toMatch(/\s$/);
      expect(CODE_REVIEWER_PROMPT).not.toMatch(/\s$/);
      expect(TASK_PLANNER_PROMPT).not.toMatch(/\s$/);
    });

    it('should use consistent XML tag formatting', () => {
      const prompts = [
        DUYETBOT_SYSTEM_PROMPT,
        RESEARCH_AGENT_PROMPT,
        CODE_REVIEWER_PROMPT,
        TASK_PLANNER_PROMPT,
      ];

      for (const prompt of prompts) {
        // Check for proper XML tag opening/closing
        const openTags = prompt.match(/<[a-z-]+>/g) || [];
        const closeTags = prompt.match(/<\/[a-z-]+>/g) || [];

        // Every opening tag should have examples of closing tags (not necessarily matching count due to examples)
        expect(openTags.length).toBeGreaterThan(0);
        expect(closeTags.length).toBeGreaterThan(0);
      }
    });
  });
});
