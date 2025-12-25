/**
 * useSettings Hook
 *
 * Manages user settings for the chat web application.
 * Handles settings persistence and API updates.
 */

import { useCallback, useEffect, useState } from 'react';

/**
 * User settings configuration (API response format - camelCase)
 */
export interface UserSettings {
  /** Default AI model for chat */
  defaultModel: string | null;
  /** List of enabled tool names */
  enabledTools: string[] | null;
  /** UI theme preference */
  theme: string | null;
  /** Accent color for UI */
  accentColor: string | null;
}

/**
 * Result from useSettings hook
 */
interface UseSettingsResult {
  /** Current settings (null if loading) */
  settings: UserSettings | null;
  /** Error message if request failed */
  error: string | null;
  /** Whether settings are being loaded */
  isLoading: boolean;
  /** Update settings via API */
  updateSettings: (updates: Partial<UserSettings>) => Promise<void>;
  /** Refresh settings from server */
  refresh: () => Promise<void>;
}

/**
 * Storage key for settings cache
 */
const SETTINGS_CACHE_KEY = 'chat_web_settings_cache';
const SETTINGS_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Manages user settings state and operations.
 *
 * @example
 * ```tsx
 * const { settings, isLoading, updateSettings } = useSettings();
 *
 * if (isLoading) {
 *   return <div>Loading settings...</div>;
 * }
 *
 * return <SettingsPanel settings={settings} onSave={updateSettings} />;
 * ```
 */
export function useSettings(): UseSettingsResult {
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  /**
   * Load settings from cache or API
   */
  const loadSettings = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Check cache first (skip during SSR)
      if (typeof window !== 'undefined') {
        const cached = localStorage.getItem(SETTINGS_CACHE_KEY);
        if (cached) {
          const { data, timestamp } = JSON.parse(cached) as {
            data: UserSettings;
            timestamp: number;
          };
          if (Date.now() - timestamp < SETTINGS_CACHE_TTL) {
            setSettings(data);
            setIsLoading(false);
            return;
          }
        }
      }

      // Fetch from API
      const response = await fetch('/api/v1/settings');
      if (!response.ok) {
        throw new Error(`Failed to fetch settings: ${response.statusText}`);
      }

      const data = (await response.json()) as UserSettings;

      // Cache the response (skip during SSR)
      if (typeof window !== 'undefined') {
        localStorage.setItem(SETTINGS_CACHE_KEY, JSON.stringify({ data, timestamp: Date.now() }));
      }

      setSettings(data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load settings';
      setError(errorMessage);
      console.error('[useSettings] Load error:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Update settings via API
   */
  const updateSettings = useCallback(async (updates: Partial<UserSettings>) => {
    setError(null);

    try {
      const response = await fetch('/api/v1/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });

      if (!response.ok) {
        throw new Error(`Failed to update settings: ${response.statusText}`);
      }

      const data = (await response.json()) as UserSettings;

      // Update cache (skip during SSR)
      if (typeof window !== 'undefined') {
        localStorage.setItem(SETTINGS_CACHE_KEY, JSON.stringify({ data, timestamp: Date.now() }));
      }

      setSettings(data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update settings';
      setError(errorMessage);
      console.error('[useSettings] Update error:', err);
      throw err;
    }
  }, []);

  /**
   * Refresh settings from server (bypass cache)
   */
  const refresh = useCallback(async () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(SETTINGS_CACHE_KEY);
    }
    await loadSettings();
  }, [loadSettings]);

  // Load settings on mount
  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  return {
    settings,
    error,
    isLoading,
    updateSettings,
    refresh,
  };
}
