'use client';

import { useCallback, useEffect, useState } from 'react';

export type ThinkingMode = 'quick' | 'normal' | 'extended';

export interface LandingStateValues {
  // Chat Mode toggles
  webSearchEnabled: boolean;
  deepThinkEnabled: boolean;

  // Agent Mode state
  thinkingMode: ThinkingMode;
  selectedMcpServers: string[];
}

export interface LandingStateActions {
  setWebSearchEnabled: (enabled: boolean) => void;
  toggleWebSearch: () => void;
  setDeepThinkEnabled: (enabled: boolean) => void;
  toggleDeepThink: () => void;
  setThinkingMode: (mode: ThinkingMode) => void;
  setSelectedMcpServers: (servers: string[]) => void;
  toggleMcpServer: (serverId: string) => void;
  reset: () => void;
}

export type UseLandingStateReturn = LandingStateValues & LandingStateActions;

const STORAGE_KEYS = {
  WEB_SEARCH: 'duyetbot-web-search-enabled',
  DEEP_THINK: 'duyetbot-deep-think-enabled',
  THINKING_MODE: 'duyetbot-thinking-mode',
  MCP_SERVERS: 'duyetbot-mcp-servers',
} as const;

const DEFAULT_VALUES: LandingStateValues = {
  webSearchEnabled: false,
  deepThinkEnabled: false,
  thinkingMode: 'normal',
  selectedMcpServers: [],
};

function loadFromStorage<T>(key: string, defaultValue: T): T {
  if (typeof window === 'undefined') return defaultValue;
  try {
    const stored = localStorage.getItem(key);
    if (stored === null) return defaultValue;
    return JSON.parse(stored) as T;
  } catch {
    return defaultValue;
  }
}

function saveToStorage<T>(key: string, value: T): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Silently fail if localStorage is unavailable
  }
}

export function useLandingState(): UseLandingStateReturn {
  // Initialize state from localStorage
  const [webSearchEnabled, setWebSearchEnabledState] = useState(() =>
    loadFromStorage(STORAGE_KEYS.WEB_SEARCH, DEFAULT_VALUES.webSearchEnabled)
  );

  const [deepThinkEnabled, setDeepThinkEnabledState] = useState(() =>
    loadFromStorage(STORAGE_KEYS.DEEP_THINK, DEFAULT_VALUES.deepThinkEnabled)
  );

  const [thinkingMode, setThinkingModeState] = useState<ThinkingMode>(() =>
    loadFromStorage(STORAGE_KEYS.THINKING_MODE, DEFAULT_VALUES.thinkingMode)
  );

  const [selectedMcpServers, setSelectedMcpServersState] = useState<string[]>(() =>
    loadFromStorage(STORAGE_KEYS.MCP_SERVERS, DEFAULT_VALUES.selectedMcpServers)
  );

  // Persist to localStorage on changes
  useEffect(() => {
    saveToStorage(STORAGE_KEYS.WEB_SEARCH, webSearchEnabled);
  }, [webSearchEnabled]);

  useEffect(() => {
    saveToStorage(STORAGE_KEYS.DEEP_THINK, deepThinkEnabled);
  }, [deepThinkEnabled]);

  useEffect(() => {
    saveToStorage(STORAGE_KEYS.THINKING_MODE, thinkingMode);
  }, [thinkingMode]);

  useEffect(() => {
    saveToStorage(STORAGE_KEYS.MCP_SERVERS, selectedMcpServers);
  }, [selectedMcpServers]);

  // Actions
  const setWebSearchEnabled = useCallback((enabled: boolean) => {
    setWebSearchEnabledState(enabled);
  }, []);

  const toggleWebSearch = useCallback(() => {
    setWebSearchEnabledState((prev) => !prev);
  }, []);

  const setDeepThinkEnabled = useCallback((enabled: boolean) => {
    setDeepThinkEnabledState(enabled);
  }, []);

  const toggleDeepThink = useCallback(() => {
    setDeepThinkEnabledState((prev) => !prev);
  }, []);

  const setThinkingMode = useCallback((mode: ThinkingMode) => {
    setThinkingModeState(mode);
  }, []);

  const setSelectedMcpServers = useCallback((servers: string[]) => {
    setSelectedMcpServersState(servers);
  }, []);

  const toggleMcpServer = useCallback((serverId: string) => {
    setSelectedMcpServersState((prev) =>
      prev.includes(serverId) ? prev.filter((id) => id !== serverId) : [...prev, serverId]
    );
  }, []);

  const reset = useCallback(() => {
    setWebSearchEnabledState(DEFAULT_VALUES.webSearchEnabled);
    setDeepThinkEnabledState(DEFAULT_VALUES.deepThinkEnabled);
    setThinkingModeState(DEFAULT_VALUES.thinkingMode);
    setSelectedMcpServersState(DEFAULT_VALUES.selectedMcpServers);
  }, []);

  return {
    // State values
    webSearchEnabled,
    deepThinkEnabled,
    thinkingMode,
    selectedMcpServers,

    // Actions
    setWebSearchEnabled,
    toggleWebSearch,
    setDeepThinkEnabled,
    toggleDeepThink,
    setThinkingMode,
    setSelectedMcpServers,
    toggleMcpServer,
    reset,
  };
}
