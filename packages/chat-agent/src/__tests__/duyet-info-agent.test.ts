/**
 * Tests for DuyetInfoAgent
 *
 * Tests the tool filter, routing classification, and agent configuration.
 *
 * IMPORTANT: Registration data must be imported BEFORE routing functions
 * to populate the agent registry. We use the lightweight registrations.ts
 * file instead of actual agent modules to avoid Cloudflare runtime dependencies.
 */

import { describe, expect, it } from 'vitest';
// Import registrations to populate agent registry (no Cloudflare dependencies)
import '../agents/registrations.js';
// Now import routing functions
import { determineRouteTarget, quickClassify } from '../routing/classifier.js';

/**
 * Duplicated tool filter for testing (matches duyet-info-agent.ts)
 * This avoids importing from the agent which has cloudflare: dependencies
 */
function duyetToolFilter(toolName: string): boolean {
  const patterns = [
    // Blog tools
    /blog/i,
    /post/i,
    /article/i,
    /tag/i,
    /categor/i,
    /feed/i,
    /rss/i,
    /content/i,
    /search.*blog/i,
    /latest/i,
    /recent/i,
    // Info tools
    /about/i,
    /cv/i,
    /contact/i,
    /info/i,
    /bio/i,
    /profile/i,
    /experience/i,
    /skill/i,
    /education/i,
    /certificate/i,
  ];
  return patterns.some((pattern) => pattern.test(toolName));
}

describe('DuyetInfoAgent', () => {
  describe('duyetToolFilter', () => {
    describe('blog-related tools', () => {
      it('should match blog tools', () => {
        expect(duyetToolFilter('get_blog_posts')).toBe(true);
        expect(duyetToolFilter('search_blog')).toBe(true);
        expect(duyetToolFilter('list_posts')).toBe(true);
        expect(duyetToolFilter('get_post_by_id')).toBe(true);
      });

      it('should match article tools', () => {
        expect(duyetToolFilter('get_article')).toBe(true);
        expect(duyetToolFilter('list_articles')).toBe(true);
      });

      it('should match tag/category tools', () => {
        expect(duyetToolFilter('get_tags')).toBe(true);
        expect(duyetToolFilter('list_categories')).toBe(true);
        expect(duyetToolFilter('posts_by_category')).toBe(true);
      });

      it('should match feed/rss tools', () => {
        expect(duyetToolFilter('get_rss_feed')).toBe(true);
        expect(duyetToolFilter('feed_items')).toBe(true);
      });

      it('should match content tools', () => {
        expect(duyetToolFilter('get_content')).toBe(true);
        expect(duyetToolFilter('latest_posts')).toBe(true);
        expect(duyetToolFilter('recent_articles')).toBe(true);
      });
    });

    describe('info-related tools', () => {
      it('should match about tools', () => {
        expect(duyetToolFilter('get_about')).toBe(true);
        expect(duyetToolFilter('about_duyet')).toBe(true);
      });

      it('should match CV/resume tools', () => {
        expect(duyetToolFilter('get_cv')).toBe(true);
        expect(duyetToolFilter('cv_info')).toBe(true);
      });

      it('should match contact tools', () => {
        expect(duyetToolFilter('get_contact')).toBe(true);
        expect(duyetToolFilter('contact_info')).toBe(true);
      });

      it('should match profile/bio tools', () => {
        expect(duyetToolFilter('get_bio')).toBe(true);
        expect(duyetToolFilter('profile_info')).toBe(true);
      });

      it('should match experience/skill tools', () => {
        expect(duyetToolFilter('get_experience')).toBe(true);
        expect(duyetToolFilter('list_skills')).toBe(true);
      });

      it('should match education/certificate tools', () => {
        expect(duyetToolFilter('get_education')).toBe(true);
        expect(duyetToolFilter('certificates')).toBe(true);
      });
    });

    describe('non-matching tools', () => {
      it('should not match unrelated tools', () => {
        expect(duyetToolFilter('execute_code')).toBe(false);
        expect(duyetToolFilter('search_web')).toBe(false);
        expect(duyetToolFilter('create_pr')).toBe(false);
        expect(duyetToolFilter('send_message')).toBe(false);
        expect(duyetToolFilter('random_tool')).toBe(false);
      });
    });

    describe('case insensitivity', () => {
      it('should match regardless of case', () => {
        expect(duyetToolFilter('GET_BLOG_POSTS')).toBe(true);
        expect(duyetToolFilter('Get_CV')).toBe(true);
        expect(duyetToolFilter('LIST_SKILLS')).toBe(true);
      });
    });
  });

  describe('quickClassify for duyet queries', () => {
    it('should classify queries about Duyet', () => {
      const result = quickClassify('Who is Duyet?');
      expect(result).not.toBeNull();
      expect(result?.category).toBe('duyet');
      expect(result?.type).toBe('simple');
    });

    it('should classify CV/resume queries', () => {
      const result = quickClassify('Show me your CV');
      expect(result).not.toBeNull();
      expect(result?.category).toBe('duyet');
    });

    it('should classify about me queries', () => {
      // "about me" and "experience" patterns should match
      const result = quickClassify("What's your experience?");
      expect(result).not.toBeNull();
      expect(result?.category).toBe('duyet');
    });

    it('should classify skills queries', () => {
      const result = quickClassify('What are your skills?');
      expect(result).not.toBeNull();
      expect(result?.category).toBe('duyet');
    });

    it('should classify education queries', () => {
      const result = quickClassify('Tell me about your education');
      expect(result).not.toBeNull();
      expect(result?.category).toBe('duyet');
    });

    it('should classify blog queries', () => {
      const result = quickClassify("What's on blog.duyet.net?");
      expect(result).not.toBeNull();
      expect(result?.category).toBe('duyet');
    });

    it('should not classify unrelated queries', () => {
      const result = quickClassify('How does JavaScript work?');
      expect(result).toBeNull(); // Falls through to LLM classification
    });
  });

  describe('determineRouteTarget for duyet category', () => {
    it('should route duyet category to duyet-info-agent', () => {
      const target = determineRouteTarget({
        type: 'simple',
        category: 'duyet',
        complexity: 'low',
        requiresHumanApproval: false,
        reasoning: 'Duyet info query',
      });
      expect(target).toBe('duyet-info-agent');
    });

    it('should route high complexity duyet queries to duyet-info-agent', () => {
      // Duyet category has priority over complexity routing
      const target = determineRouteTarget({
        type: 'complex',
        category: 'duyet',
        complexity: 'high',
        requiresHumanApproval: false,
        reasoning: 'Complex duyet query',
      });
      expect(target).toBe('duyet-info-agent');
    });
  });
});
