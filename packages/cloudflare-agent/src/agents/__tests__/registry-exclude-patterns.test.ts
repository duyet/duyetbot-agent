/**
 * Tests for excludePatterns functionality in AgentRegistry
 *
 * Verifies that:
 * 1. excludePatterns can be defined on agents
 * 2. Exclude patterns take precedence over inclusion patterns/keywords
 * 3. URL-containing queries don't match lead-researcher-agent
 */

import { describe, expect, it, vi } from 'vitest';
import { agentRegistry } from '../registry.js';

// Mock agents SDK to avoid cloudflare: protocol issues in tests
vi.mock('agents', () => ({
  Agent: class MockAgent {},
}));

// Import agents to trigger registration (after mocking)
import '../research/lead-researcher-agent.js';

describe('AgentRegistry - excludePatterns', () => {

  describe('excludePatterns structure', () => {
    it('should have excludePatterns in AgentDefinition triggers', () => {
      const leadResearcher = agentRegistry.get('lead-researcher-agent');
      expect(leadResearcher).toBeDefined();
      expect(leadResearcher?.triggers?.excludePatterns).toBeDefined();
    });

    it('lead-researcher-agent should have URL exclude pattern', () => {
      const leadResearcher = agentRegistry.get('lead-researcher-agent');
      const hasUrlPattern = leadResearcher?.triggers?.excludePatterns?.some((p) =>
        p.test('https://example.com')
      );
      expect(hasUrlPattern).toBe(true);
    });
  });

  describe('URL exclusion behavior', () => {
    it('should not match lead-researcher-agent for URLs with HN links', () => {
      const result = agentRegistry.quickClassify('https://news.ycombinator.com/item?id=123');
      expect(result).not.toBe('lead-researcher-agent');
    });

    it('should not match lead-researcher-agent for messages containing URLs', () => {
      const result = agentRegistry.quickClassify('Check this out: https://example.com/article');
      expect(result).not.toBe('lead-researcher-agent');
    });

    it('should not match lead-researcher-agent for http:// URLs', () => {
      const result = agentRegistry.quickClassify('http://example.com');
      expect(result).not.toBe('lead-researcher-agent');
    });

    it('should match lead-researcher-agent for news queries without URLs', () => {
      const result = agentRegistry.quickClassify('latest news about AI');
      expect(result).toBe('lead-researcher-agent');
    });

    it('should match lead-researcher-agent for current events queries', () => {
      const result = agentRegistry.quickClassify('what is happening today in tech');
      expect(result).toBe('lead-researcher-agent');
    });

    it('should match lead-researcher-agent for comparison queries', () => {
      const result = agentRegistry.quickClassify('compare React vs Vue');
      expect(result).toBe('lead-researcher-agent');
    });
  });

  describe('keyword specificity', () => {
    it('should not match on generic "news" keyword alone (removed from keywords)', () => {
      // This tests that we removed 'news' from the generic keywords list
      // to prevent false matches on "readhacker.news" URLs
      const result = agentRegistry.quickClassify('news');
      // Could match via pattern if it matches any pattern, but not via generic keyword
      // The important thing is "readhacker.news" won't match
      expect(result).not.toBe('lead-researcher-agent'); // "news" alone shouldn't match
    });

    it('should not match on "today" keyword alone (removed from keywords)', () => {
      const result = agentRegistry.quickClassify('today');
      // Should not match on generic keyword
      expect(result).not.toBe('lead-researcher-agent');
    });

    it('should match on specific keyword phrases', () => {
      const result = agentRegistry.quickClassify('latest news');
      expect(result).toBe('lead-researcher-agent');
    });

    it('should match on "current events" keyword', () => {
      const result = agentRegistry.quickClassify('current events');
      expect(result).toBe('lead-researcher-agent');
    });
  });

  describe('exclusion precedence', () => {
    it('should respect excludePatterns even when patterns would match', () => {
      // Even if a pattern matches, exclusion should take precedence
      const queryWithUrl = 'https://example.com/latest-news-about-technology';
      const result = agentRegistry.quickClassify(queryWithUrl);
      expect(result).not.toBe('lead-researcher-agent');
    });

    it('should respect excludePatterns even when keywords would match', () => {
      const queryWithUrl = 'https://example.com/current-events';
      const result = agentRegistry.quickClassify(queryWithUrl);
      expect(result).not.toBe('lead-researcher-agent');
    });
  });
});
