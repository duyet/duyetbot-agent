/**
 * Proactive Researcher
 *
 * Background research worker that scans configured sources for content
 * relevant to @duyet's interests. Runs during quiet hours when the bot
 * has excess energy budget.
 *
 * Sources:
 * - HackerNews top/best stories
 * - ArXiv ML/Data papers (future)
 * - Configured blogs/feeds (future)
 *
 * The researcher schedules itself via SchedulerDO and uses the taste filter
 * to determine what content is worth reporting.
 */
import { logger } from '@duyetbot/hono-middleware';
import { scheduleTask } from './client.js';
/**
 * Default taste filter for @duyet (Data Engineer)
 */
export const DEFAULT_TASTE_FILTER = {
  interests: [
    'data engineering',
    'machine learning',
    'rust',
    'typescript',
    'cloudflare workers',
    'durable objects',
    'distributed systems',
    'database',
    'sql',
    'apache spark',
    'apache kafka',
    'data pipelines',
    'etl',
    'data warehouse',
    'llm',
    'rag',
    'ai agents',
    'mcp',
    'model context protocol',
  ],
  boostKeywords: [
    'tutorial',
    'guide',
    'deep dive',
    'architecture',
    'production',
    'performance',
    'optimization',
    'best practices',
    'announcement',
    'release',
  ],
  penaltyKeywords: ['hiring', 'job posting', 'advertisement', 'sponsored', 'giveaway'],
  minRelevanceScore: 60,
};
/**
 * Default research sources
 */
export const DEFAULT_RESEARCH_SOURCES = [
  {
    id: 'hn-top',
    name: 'HackerNews Top',
    type: 'hackernews',
    url: 'https://hacker-news.firebaseio.com/v0/topstories.json',
    checkIntervalMs: 4 * 60 * 60 * 1000, // Every 4 hours
    enabled: true,
  },
  {
    id: 'hn-best',
    name: 'HackerNews Best',
    type: 'hackernews',
    url: 'https://hacker-news.firebaseio.com/v0/beststories.json',
    checkIntervalMs: 8 * 60 * 60 * 1000, // Every 8 hours
    enabled: true,
  },
];
/**
 * Calculate relevance score for an item based on taste filter
 *
 * @param title - Item title
 * @param tasteFilter - Taste filter configuration
 * @returns Relevance score 0-100
 */
export function calculateRelevance(title, tasteFilter = DEFAULT_TASTE_FILTER) {
  const lowerTitle = title.toLowerCase();
  let score = 30; // Base score
  const reasons = [];
  // Check interests (high boost)
  for (const interest of tasteFilter.interests) {
    if (lowerTitle.includes(interest.toLowerCase())) {
      score += 25;
      reasons.push(`matches interest: ${interest}`);
      break; // Only count first match
    }
  }
  // Check boost keywords (medium boost)
  for (const keyword of tasteFilter.boostKeywords) {
    if (lowerTitle.includes(keyword.toLowerCase())) {
      score += 10;
      reasons.push(`contains: ${keyword}`);
    }
  }
  // Check penalty keywords (reduce score)
  for (const keyword of tasteFilter.penaltyKeywords) {
    if (lowerTitle.includes(keyword.toLowerCase())) {
      score -= 20;
      reasons.push(`penalty: ${keyword}`);
    }
  }
  // Clamp score
  score = Math.max(0, Math.min(100, score));
  return {
    score,
    reason: reasons.length > 0 ? reasons.join(', ') : 'base relevance',
  };
}
/**
 * Fetch HackerNews stories
 *
 * @param url - HN API URL for story list
 * @param limit - Max stories to fetch
 * @returns Array of HN items
 */
export async function fetchHackerNewsStories(url, limit = 30) {
  try {
    // Get story IDs
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HN API error: ${response.status}`);
    }
    const storyIds = await response.json();
    const limitedIds = storyIds.slice(0, limit);
    // Fetch each story (in parallel with limit)
    const stories = [];
    const batchSize = 10;
    for (let i = 0; i < limitedIds.length; i += batchSize) {
      const batch = limitedIds.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map(async (id) => {
          const itemResponse = await fetch(`https://hacker-news.firebaseio.com/v0/item/${id}.json`);
          if (!itemResponse.ok) {
            return null;
          }
          return await itemResponse.json();
        })
      );
      stories.push(...batchResults.filter((s) => s !== null));
    }
    return stories;
  } catch (error) {
    logger.error('[ProactiveResearch] Failed to fetch HN stories', {
      error: error instanceof Error ? error.message : String(error),
    });
    return [];
  }
}
/**
 * Process HackerNews stories and filter by relevance
 *
 * @param stories - HN items to process
 * @param tasteFilter - Taste filter configuration
 * @param seenIds - Set of already seen story IDs
 * @returns Filtered findings
 */
export function processHackerNewsStories(
  stories,
  tasteFilter = DEFAULT_TASTE_FILTER,
  seenIds = new Set()
) {
  const findings = [];
  const now = Date.now();
  for (const story of stories) {
    // Skip already seen
    if (seenIds.has(story.id)) {
      continue;
    }
    // Skip non-stories or items without URLs
    if (story.type !== 'story' || !story.url) {
      continue;
    }
    // Calculate relevance
    const { score, reason } = calculateRelevance(story.title, tasteFilter);
    // Only include if above threshold
    if (score >= tasteFilter.minRelevanceScore) {
      findings.push({
        id: `hn-${story.id}`,
        sourceId: 'hackernews',
        title: story.title,
        url: story.url,
        summary: `Score: ${story.score}, Comments: ${story.descendants ?? 0}`,
        relevanceScore: score,
        relevanceReason: reason,
        foundAt: now,
        metadata: {
          hnId: story.id,
          hnScore: story.score,
          hnComments: story.descendants ?? 0,
          hnAuthor: story.by,
          hnTime: story.time,
        },
      });
    }
  }
  // Sort by relevance (highest first)
  findings.sort((a, b) => b.relevanceScore - a.relevanceScore);
  return findings;
}
/**
 * Execute proactive research task
 *
 * This is the main entry point called by SchedulerDO when a research task
 * is ready to execute.
 *
 * @param payload - Research task configuration
 * @returns Research results
 */
export async function executeResearchTask(payload) {
  const startTime = Date.now();
  logger.info('[ProactiveResearch] Starting research task', {
    sources: payload.sources,
  });
  const tasteFilter = payload.tasteFilter ?? DEFAULT_TASTE_FILTER;
  const bySource = {};
  let totalFindings = 0;
  // Process each source
  for (const sourceId of payload.sources) {
    const source = DEFAULT_RESEARCH_SOURCES.find((s) => s.id === sourceId);
    if (!source || !source.enabled) {
      continue;
    }
    if (source.type === 'hackernews') {
      const stories = await fetchHackerNewsStories(source.url);
      const findings = processHackerNewsStories(stories, tasteFilter);
      bySource[sourceId] = findings;
      totalFindings += findings.length;
      logger.info('[ProactiveResearch] Processed source', {
        sourceId,
        storiesChecked: stories.length,
        findingsFound: findings.length,
      });
    }
  }
  const result = {
    totalFindings,
    bySource,
    completedAt: Date.now(),
    notificationsSent: false,
  };
  logger.info('[ProactiveResearch] Research complete', {
    totalFindings,
    durationMs: Date.now() - startTime,
  });
  return result;
}
/**
 * Schedule a research task via SchedulerDO
 *
 * @param scheduler - SchedulerObject namespace
 * @param sources - Sources to check (default: all enabled)
 * @param priority - Task priority (default: 50)
 * @param scheduledFor - When to run (default: now)
 * @returns Task ID
 */
export async function scheduleResearchTask(
  scheduler,
  sources = DEFAULT_RESEARCH_SOURCES.filter((s) => s.enabled).map((s) => s.id),
  priority = 50,
  scheduledFor
) {
  const payload = {
    sources,
    digestMode: true,
  };
  return scheduleTask(scheduler, {
    type: 'research',
    priority,
    payload,
    ...(scheduledFor !== undefined && { scheduledFor }),
    description: `Research: ${sources.join(', ')}`,
  });
}
/**
 * Format research findings for Telegram notification
 *
 * @param findings - Research findings to format
 * @param limit - Max items to include
 * @returns Formatted message
 */
export function formatResearchDigest(findings, limit = 5) {
  if (findings.length === 0) {
    return '📭 No relevant findings this time.';
  }
  const topFindings = findings.slice(0, limit);
  const lines = ['🔬 *Research Digest*', '', `Found ${findings.length} relevant items:`, ''];
  for (const finding of topFindings) {
    const emoji = finding.relevanceScore >= 80 ? '🔥' : finding.relevanceScore >= 60 ? '⭐' : '📌';
    lines.push(`${emoji} [${finding.title}](${finding.url})`);
    if (finding.summary) {
      lines.push(`   _${finding.summary}_`);
    }
    lines.push('');
  }
  if (findings.length > limit) {
    lines.push(`_...and ${findings.length - limit} more_`);
  }
  return lines.join('\n');
}
