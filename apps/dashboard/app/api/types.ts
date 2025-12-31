import { NextResponse } from 'next/server';

/**
 * Standard API Response wrapper types
 */

export interface ListMetadata {
  total: number;
  page: number;
  pageSize: number;
  hasMore?: boolean;
}

export interface ListResponse<T> {
  data: T[];
  meta: ListMetadata;
}

export interface SingleResponse<T> {
  data: T;
}

export interface ErrorResponse {
  error: string;
  code?: string;
  details?: Record<string, unknown>;
}

/**
 * Domain models for analytics
 */

export interface Message {
  id: string;
  sessionId: string;
  userId: string;
  platform: string;
  content: string;
  role: 'user' | 'assistant';
  timestamp: string;
  model?: string;
  tokens?: {
    input: number;
    output: number;
  };
  visibility?: 'public' | 'private' | 'archived';
  isPinned?: boolean;
  isArchived?: boolean;
}

export interface Session {
  id: string;
  userId: string;
  platform: string;
  startTime: string;
  endTime?: string;
  messageCount: number;
  tokensUsed?: {
    input: number;
    output: number;
  };
  status: 'active' | 'completed';
}

export interface Event {
  id: string;
  sessionId: string;
  type: 'agent_start' | 'agent_end' | 'tool_use' | 'error';
  agentName: string;
  timestamp: string;
  duration?: number;
  status: 'pending' | 'success' | 'error';
  metadata?: Record<string, unknown>;
}

export interface AgentStep {
  id: string;
  eventId: string;
  stepType: 'agent' | 'worker';
  name: string;
  parentId?: string;
  children?: AgentStep[];
  status: 'pending' | 'running' | 'completed' | 'failed';
  startTime: string;
  endTime?: string;
  duration?: number;
  result?: unknown;
  error?: string;
}

export interface DailyAggregate {
  date: string;
  type: 'user' | 'platform' | 'model' | 'agent';
  key: string;
  messages: number;
  tokens: {
    input: number;
    output: number;
  };
  sessions: number;
  errors: number;
}

export interface TokenTimeline {
  timestamp: string;
  input: number;
  output: number;
  total: number;
  model?: string;
}

export interface CostSummary {
  period: string;
  totalCost: number;
  costByModel: Record<string, number>;
  costByPlatform: Record<string, number>;
  inputTokens: number;
  outputTokens: number;
}

export interface PricingConfig {
  model: string;
  inputPrice: number;
  outputPrice: number;
  currency: string;
}

/**
 * API Response helpers
 */

export function successResponse<T>(data: T): SingleResponse<T> {
  return { data };
}

export function listResponse<T>(
  data: T[],
  total: number,
  page: number = 1,
  pageSize: number = 50
): ListResponse<T> {
  return {
    data,
    meta: {
      total,
      page,
      pageSize,
      hasMore: page * pageSize < total,
    },
  };
}

export function errorResponse(
  error: string,
  code?: string,
  details?: Record<string, unknown>
): ErrorResponse {
  return { error, code, details };
}

/**
 * Error handling helper
 */

export function handleRouteError(error: unknown, status: number = 500) {
  const message = error instanceof Error ? error.message : 'Internal server error';

  return NextResponse.json(errorResponse(message), { status });
}

/**
 * Query parameter parsing helpers
 */

export function getPaginationParams(searchParams: URLSearchParams) {
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50', 10)));
  const offset = (page - 1) * limit;

  return { page, limit, offset };
}

export function getDateRangeParams(searchParams: URLSearchParams): { from?: string; to?: string } {
  const from = searchParams.get('from');
  const to = searchParams.get('to');

  return {
    from: from || undefined,
    to: to || undefined,
  };
}

export function getFilterParams(searchParams: URLSearchParams): Record<string, string> {
  const filters: Record<string, string> = {};

  for (const [key, value] of searchParams) {
    if (!['page', 'limit', 'offset', 'from', 'to', 'query'].includes(key)) {
      filters[key] = value;
    }
  }

  return filters;
}
