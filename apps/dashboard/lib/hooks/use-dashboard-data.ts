'use client';

import type {
  AnalyticsAgentStep,
  AnalyticsConversation,
  AnalyticsMessage,
} from '@duyetbot/analytics';
import { useQuery } from '@tanstack/react-query';

interface GlobalStats {
  totalMessages: number;
  totalSessions: number;
  totalUsers: number;
  totalTokens: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  platformBreakdown: { platform: string; count: number }[];
}

interface ApiResponse<T> {
  success: boolean;
  data: T;
}

interface ListResponse<T> {
  success: boolean;
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    hasMore: boolean;
  };
}

async function fetchApi<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`API error: ${res.status}`);
  }
  const json = (await res.json()) as ApiResponse<T>;
  return json.data;
}

async function fetchListApi<T>(url: string): Promise<T[]> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`API error: ${res.status}`);
  }
  const json = (await res.json()) as ListResponse<T>;
  return json.data;
}

/**
 * Hook for fetching global dashboard stats
 */
export function useStats() {
  return useQuery({
    queryKey: ['stats'],
    queryFn: () => fetchApi<GlobalStats>('/api/stats'),
  });
}

/**
 * Hook for fetching recent messages
 */
export function useRecentMessages(limit = 20) {
  return useQuery({
    queryKey: ['messages', 'recent', limit],
    queryFn: () => fetchListApi<AnalyticsMessage>(`/api/messages?limit=${limit}`),
  });
}

/**
 * Hook for fetching recent sessions/conversations
 */
export function useRecentSessions(limit = 20) {
  return useQuery({
    queryKey: ['sessions', 'recent', limit],
    queryFn: () => fetchListApi<AnalyticsConversation>(`/api/sessions?limit=${limit}`),
  });
}

/**
 * Hook for fetching recent events/agent steps
 */
export function useRecentEvents(limit = 20) {
  return useQuery({
    queryKey: ['events', 'recent', limit],
    queryFn: () => fetchListApi<AnalyticsAgentStep>(`/api/events?limit=${limit}`),
  });
}

/**
 * Token summary response type
 */
interface TokenSummary {
  messageCount: number;
  sessionCount: number;
  userCount: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalTokens: number;
  platformBreakdown: { platform: string; count: number }[];
  estimatedCostUsd: number;
}

/**
 * Daily aggregate type
 */
interface DailyAggregate {
  id: number;
  aggregateType: string;
  aggregateKey: string;
  periodType: string;
  periodStart: number;
  periodEnd: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  cachedTokens: number;
  reasoningTokens: number;
  messageCount: number;
  userMessageCount: number;
  assistantMessageCount: number;
  eventCount: number;
  sessionCount: number;
  successCount: number;
  errorCount: number;
  totalDurationMs: number;
  avgDurationMs: number;
  estimatedCostUsd: number;
}

/**
 * Hook for fetching token summary
 */
export function useTokenSummary() {
  return useQuery({
    queryKey: ['tokens', 'summary'],
    queryFn: () => fetchApi<TokenSummary>('/api/tokens/summary'),
  });
}

/**
 * Hook for fetching daily aggregates
 */
interface AggregatesResponse {
  success: boolean;
  data: DailyAggregate[];
}

export function useDailyAggregates(from: string, to: string, type?: string) {
  return useQuery({
    queryKey: ['aggregates', 'daily', from, to, type],
    queryFn: async () => {
      const params = new URLSearchParams({ from, to });
      if (type) {
        params.set('type', type);
      }
      const res = await fetch(`/api/aggregates/daily?${params}`);
      if (!res.ok) {
        throw new Error(`API error: ${res.status}`);
      }
      const json = (await res.json()) as AggregatesResponse;
      return json.data;
    },
    enabled: Boolean(from && to),
  });
}
