/**
 * Web Search Integration Tests for Telegram Bot
 *
 * This test suite validates web search functionality with real LLM APIs,
 * including both native provider search and standalone research tool integration.
 *
 * Tests validate search result accuracy, citation inclusion, and performance.
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  createMockTelegramBot,
  createMockUpdate,
  measureResponseTime,
  setupTelegramAPISpy,
  validateWebSearchResponse,
} from '../helpers/bot-test-utils';
import {
  createWebSearchConfig,
  getTestProvider,
  isRealAPITestingAvailable,
} from '../helpers/test-providers';

describe('Telegram Bot - Web Search Integration', () => {
  let bot: any;
  let apiSpy: any;
  let _provider: any;

  beforeAll(async () => {
    // Skip tests if real API environment not available
    if (!isRealAPITestingAvailable()) {
      console.warn('⚠️ Skipping web search tests - environment not configured');
      return;
    }

    try {
      bot = await createMockTelegramBot();
      apiSpy = setupTelegramAPISpy(bot);
      _provider = getTestProvider();

      console.log('🔍 Web search test environment setup complete');
    } catch (error) {
      console.error('❌ Failed to setup web search tests:', error);
      throw error;
    }
  });

  afterAll(() => {
    if (apiSpy) {
      apiSpy.clearMessages();
    }
  });

  describe('Native Web Search via OpenRouter Plugins', () => {
    it('should search for current information about AI', async () => {
      if (!isRealAPITestingAvailable()) {
        return;
      }

      const webSearchConfig = createWebSearchConfig();
      if (!webSearchConfig.enabled || !webSearchConfig.useNativeSearch) {
        console.warn('⚠️ Native web search not available, skipping test');
        return;
      }

      const update = createMockUpdate('What are the latest developments in AI?');
      const { result, responseTime } = await measureResponseTime(() => bot.handleUpdate(update));

      const sentMessages = apiSpy.getSentMessages();
      expect(sentMessages.length).toBeGreaterThan(0);

      const lastResponse = sentMessages[sentMessages.length - 1];
      const validation = validateWebSearchResponse(
        lastResponse.text,
        {
          requiresCitations: true,
          hasCurrentInfo: true,
          maxResponseTime: 30000, // 30s for web search
        },
        responseTime
      );

      expect(validation.isValid).toBe(true);

      // Should contain information about AI developments
      expect(lastResponse.text).toMatch(/AI|artificial|intelligence|machine learning|LLM/gi);

      // Check for citations or current info indicators
      if (validation.hasCitations) {
        expect(lastResponse.text).toMatch(/https?:\/\//);
      }
    });

    it('should search for trending topics', async () => {
      if (!isRealAPITestingAvailable()) {
        return;
      }

      const webSearchConfig = createWebSearchConfig();
      const update = createMockUpdate('What is trending on social media today?');
      const { result, responseTime } = await measureResponseTime(() => bot.handleUpdate(update));

      const sentMessages = apiSpy.getSentMessages();
      const lastResponse = sentMessages[sentMessages.length - 1];
      const validation = validateWebSearchResponse(
        lastResponse.text,
        {
          requiresCitations: webSearchConfig.useNativeSearch,
          hasCurrentInfo: true,
          maxResponseTime: 30000,
        },
        responseTime
      );

      expect(validation.isValid).toBe(true);

      // Response should be about social media trends
      expect(lastResponse.text).toMatch(/social|twitter|instagram|tiktok|trending/gi);
    });

    it('should handle search queries with proper context', async () => {
      if (!isRealAPITestingAvailable()) {
        return;
      }

      const webSearchConfig = createWebSearchConfig();
      const update = createMockUpdate('Find recent news about climate change solutions');
      const { result, responseTime } = await measureResponseTime(() => bot.handleUpdate(update));

      const sentMessages = apiSpy.getSentMessages();
      const lastResponse = sentMessages[sentMessages.length - 1];
      const validation = validateWebSearchResponse(
        lastResponse.text,
        {
          requiresCitations: webSearchConfig.useNativeSearch,
          hasCurrentInfo: true,
          maxResponseTime: 30000,
        },
        responseTime
      );

      expect(validation.isValid).toBe(true);

      // Should discuss climate change and solutions
      expect(lastResponse.text).toMatch(/climate|warming|carbon|renewable|solutions/gi);

      // Should be a substantive response
      expect(lastResponse.text.length).toBeGreaterThan(200);
    });
  });

  describe('Standalone Research Tool Integration', () => {
    it('should fetch and analyze specific URLs', async () => {
      if (!isRealAPITestingAvailable()) {
        return;
      }

      const testUrl = 'https://example.com';
      const update = createMockUpdate(`Summarize the content from ${testUrl}`);
      const { result, responseTime } = await measureResponseTime(() => bot.handleUpdate(update));

      const sentMessages = apiSpy.getSentMessages();
      const lastResponse = sentMessages[sentMessages.length - 1];
      const validation = validateWebSearchResponse(
        lastResponse.text,
        {
          requiresCitations: false, // Direct URL fetch might not need citations
          maxResponseTime: 25000, // 25s for URL analysis
        },
        responseTime
      );

      expect(validation.isValid).toBe(true);

      // Response should indicate it analyzed the URL
      expect(lastResponse.text).toMatch(/analyze|summary|content|example\.com/gi);

      // Should be a meaningful summary
      expect(lastResponse.text.length).toBeGreaterThan(100);
    });

    it('should handle multiple URL requests', async () => {
      if (!isRealAPITestingAvailable()) {
        return;
      }

      const urls = ['https://example.com/page1', 'https://example.com/page2'];
      const update = createMockUpdate(`Compare these URLs: ${urls.join(', ')}`);
      const { result, responseTime } = await measureResponseTime(() => bot.handleUpdate(update));

      const sentMessages = apiSpy.getSentMessages();
      const lastResponse = sentMessages[sentMessages.length - 1];
      const validation = validateWebSearchResponse(
        lastResponse.text,
        {
          requiresCitations: false,
          maxResponseTime: 30000, // Longer for multiple URLs
        },
        responseTime
      );

      expect(validation.isValid).toBe(true);

      // Should mention comparison or analysis
      expect(lastResponse.text).toMatch(/compare|differences|similarities|analysis/gi);

      // Should reference multiple sources
      const urlMatches = lastResponse.text.match(/https?:\/\/[^\s,]+/gi);
      expect(urlMatches?.length).toBeGreaterThan(0);
    });
  });

  describe('Search Quality and Accuracy', () => {
    it('should provide relevant and accurate information', async () => {
      if (!isRealAPITestingAvailable()) {
        return;
      }

      const webSearchConfig = createWebSearchConfig();
      const update = createMockUpdate('What is the capital of France?');
      const { result, responseTime } = await measureResponseTime(() => bot.handleUpdate(update));

      const sentMessages = apiSpy.getSentMessages();
      const lastResponse = sentMessages[sentMessages.length - 1];
      const validation = validateWebSearchResponse(
        lastResponse.text,
        {
          requiresCitations: webSearchConfig.useNativeSearch,
          maxResponseTime: 15000, // Should be fast for factual queries
        },
        responseTime
      );

      expect(validation.isValid).toBe(true);

      // Should correctly identify Paris as the capital
      expect(lastResponse.text).toMatch(/Paris/gi);

      // Should be a direct, factual response
      expect(lastResponse.text.length).toBeLessThan(500);
    });

    it('should handle ambiguous queries gracefully', async () => {
      if (!isRealAPITestingAvailable()) {
        return;
      }

      const webSearchConfig = createWebSearchConfig();
      const update = createMockUpdate('Tell me about Python');
      const { result, responseTime } = await measureResponseTime(() => bot.handleUpdate(update));

      const sentMessages = apiSpy.getSentMessages();
      const lastResponse = sentMessages[sentMessages.length - 1];
      const validation = validateWebSearchResponse(
        lastResponse.text,
        {
          requiresCitations: webSearchConfig.useNativeSearch,
          maxResponseTime: 25000, // Might take longer for disambiguation
        },
        responseTime
      );

      expect(validation.isValid).toBe(true);

      // Should address the ambiguity (programming language vs. snake)
      expect(lastResponse.text).toMatch(/programming|language|snake|animal|ambiguous/gi);

      // Should ask for clarification or provide both contexts
      expect(lastResponse.text.length).toBeGreaterThan(150);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle invalid URLs gracefully', async () => {
      if (!isRealAPITestingAvailable()) {
        return;
      }

      const invalidUrl = 'https://nonexistent-domain-12345.com';
      const update = createMockUpdate(`What can you tell me about ${invalidUrl}?`);
      const { result, responseTime } = await measureResponseTime(() => bot.handleUpdate(update));

      const sentMessages = apiSpy.getSentMessages();
      const lastResponse = sentMessages[sentMessages.length - 1];

      // Should handle the error gracefully
      expect(lastResponse.text).toMatch(/error|cannot|access|unavailable|problem/gi);
      expect(responseTime).toBeLessThan(20000); // Should fail fast
    });

    it('should handle search timeouts appropriately', async () => {
      if (!isRealAPITestingAvailable()) {
        return;
      }

      // Create a complex query that might timeout
      const update = createMockUpdate(
        'Provide a comprehensive analysis of the latest developments in quantum computing, artificial intelligence, and renewable energy technologies'
      );
      const { result, responseTime } = await measureResponseTime(() => bot.handleUpdate(update));

      const sentMessages = apiSpy.getSentMessages();
      const lastResponse = sentMessages[sentMessages.length - 1];

      // Should provide some response even if partial
      expect(sentMessages.length).toBeGreaterThan(0);
      expect(lastResponse.text.length).toBeGreaterThan(50);

      // Response time should be reasonable
      expect(responseTime).toBeLessThan(45000); // 45s max timeout
    });

    it('should handle empty or nonsensical search queries', async () => {
      if (!isRealAPITestingAvailable()) {
        return;
      }

      const update = createMockUpdate('asdfghjkl qwerty');
      const { result, responseTime } = await measureResponseTime(() => bot.handleUpdate(update));

      const sentMessages = apiSpy.getSentMessages();
      const lastResponse = sentMessages[sentMessages.length - 1];

      // Should provide a helpful response rather than failing
      expect(lastResponse.text).toMatch(/understand|clarify|meaning|help|query|search/gi);
      expect(lastResponse.text.length).toBeGreaterThan(20);
    });
  });

  describe('Performance and Efficiency', () => {
    it('should maintain reasonable response times', async () => {
      if (!isRealAPITestingAvailable()) {
        return;
      }

      const searchQueries = [
        'What is machine learning?',
        'Latest news about electric vehicles',
        'How does photosynthesis work?',
      ];

      const responseTimes: number[] = [];

      for (const query of searchQueries) {
        apiSpy.clearMessages();

        const update = createMockUpdate(query);
        const { responseTime } = await measureResponseTime(() => bot.handleUpdate(update));

        responseTimes.push(responseTime);

        // Small delay between requests
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }

      // Calculate performance metrics
      const avgResponseTime =
        responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length;
      const maxResponseTime = Math.max(...responseTimes);
      const fastResponses = responseTimes.filter((time) => time <= 30000).length;
      const responseRate = fastResponses / responseTimes.length;

      // Most responses should be within 30 seconds
      expect(responseRate).toBeGreaterThanOrEqual(0.8); // 80% within 30s
      expect(avgResponseTime).toBeLessThan(35000); // Average under 35s
      expect(maxResponseTime).toBeLessThan(60000); // Max under 60s

      console.log(
        `📊 Search Performance: avg=${avgResponseTime}ms, max=${maxResponseTime}ms, success_rate=${responseRate * 100}%`
      );
    });

    it('should handle concurrent search requests efficiently', async () => {
      if (!isRealAPITestingAvailable()) {
        return;
      }

      const webSearchConfig = createWebSearchConfig();
      const concurrentQueries = [
        'What is cloud computing?',
        'Benefits of renewable energy',
        'History of artificial intelligence',
      ];

      // Send concurrent requests
      const updatePromises = concurrentQueries.map((query, index) => {
        const update = createMockUpdate(query, { messageId: 100 + index });
        return bot.handleUpdate(update);
      });

      const _results = await Promise.all(updatePromises);
      const sentMessages = apiSpy.getSentMessages();

      // Should respond to all concurrent requests
      expect(sentMessages.length).toBe(concurrentQueries.length);

      // All responses should be meaningful
      sentMessages.forEach((response, _index) => {
        const validation = validateWebSearchResponse(response.text, {
          requiresCitations: webSearchConfig.useNativeSearch,
          maxResponseTime: 45000, // Allow longer for concurrency
        });

        expect(validation.isValid).toBe(true);
      });
    });
  });

  describe('Citations and Source Attribution', () => {
    it('should include citations when using web search', async () => {
      if (!isRealAPITestingAvailable()) {
        return;
      }

      const webSearchConfig = createWebSearchConfig();
      const update = createMockUpdate('What are the environmental impacts of cryptocurrency?');
      const { result, responseTime } = await measureResponseTime(() => bot.handleUpdate(update));

      const sentMessages = apiSpy.getSentMessages();
      const lastResponse = sentMessages[sentMessages.length - 1];
      const validation = validateWebSearchResponse(
        lastResponse.text,
        {
          requiresCitations: webSearchConfig.useNativeSearch,
          maxResponseTime: 30000,
        },
        responseTime
      );

      expect(validation.isValid).toBe(true);

      // Should mention cryptocurrency and environmental impact
      expect(lastResponse.text).toMatch(/cryptocurrency|bitcoin|mining|energy|environment/gi);

      if (validation.hasCitations) {
        // Should have proper citation format
        const urlPattern = /https?:\/\/[^\s)]+/gi;
        const urls = lastResponse.text.match(urlPattern);
        expect(urls?.length).toBeGreaterThan(0);
      }
    });

    it('should properly attribute sources when available', async () => {
      if (!isRealAPITestingAvailable()) {
        return;
      }

      const update = createMockUpdate(
        'What recent discoveries has the James Webb Space Telescope made?'
      );
      const { result, responseTime } = await measureResponseTime(() => bot.handleUpdate(update));

      const sentMessages = apiSpy.getSentMessages();
      const lastResponse = sentMessages[sentMessages.length - 1];

      // Should mention James Webb and recent discoveries
      expect(lastResponse.text).toMatch(/James Webb|JWST|telescope|discoveries/gi);

      // For current events topics, should have up-to-date information
      expect(lastResponse.text).toMatch(/202[3-9]|recent|latest|discovery/gi);
    });
  });
});
