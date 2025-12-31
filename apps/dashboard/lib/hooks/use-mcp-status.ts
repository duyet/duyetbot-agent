'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { MCPStatusResponse } from '../mcp/types';

interface ApiResponse<T> {
  success: boolean;
  data: T;
}

async function fetchMCPStatus(): Promise<MCPStatusResponse> {
  const res = await fetch('/api/mcp/status');
  if (!res.ok) {
    throw new Error(`API error: ${res.status}`);
  }
  const json = (await res.json()) as ApiResponse<MCPStatusResponse>;
  return json.data;
}

/**
 * Hook for fetching MCP server status
 * - 5 minute stale time
 * - 10 minute cache time
 * - No refetch on window focus
 */
export function useMCPStatus() {
  return useQuery({
    queryKey: ['mcp', 'status'],
    queryFn: () => fetchMCPStatus(),
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes (formerly cacheTime)
    refetchOnWindowFocus: false,
  });
}

/**
 * Hook for fetching MCP server status with manual refresh capability
 * Returns the query result plus a refresh function for manual updates
 */
export function useMCPStatusWithRefresh() {
  const queryClient = useQueryClient();
  const query = useMCPStatus();

  const refresh = async () => {
    await queryClient.invalidateQueries({
      queryKey: ['mcp', 'status'],
    });
  };

  return {
    ...query,
    refresh,
  };
}
