'use client';

import { useEffect } from 'react';

type Theme = 'light' | 'dark' | 'system';

const THEME_KEY = 'duyetbot-theme';

/**
 * Get the current theme from localStorage or system preference
 * Returns 'system' during SSR (localStorage not available)
 */
function getTheme(): Theme {
  if (typeof window === 'undefined') {
    return 'system';
  }
  const stored = localStorage.getItem(THEME_KEY);
  if (stored === 'light' || stored === 'dark' || stored === 'system') {
    return stored;
  }
  return 'system';
}

/**
 * Apply theme class to document element
 */
function applyTheme(theme: Theme) {
  const root = document.documentElement;
  const isDark =
    theme === 'dark' ||
    (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);

  root.classList.remove('light', 'dark');
  if (isDark) {
    root.classList.add('dark');
  } else {
    root.classList.add('light');
  }
}

/**
 * Initialize theme on mount
 */
export function initTheme() {
  const theme = getTheme();
  applyTheme(theme);
}

/**
 * Set theme and persist to localStorage
 */
export function setTheme(theme: Theme) {
  localStorage.setItem(THEME_KEY, theme);
  applyTheme(theme);
}

/**
 * Get current theme without side effects
 */
export function getThemeSync(): Theme {
  return getTheme();
}

/**
 * ThemeProvider Props
 */
interface ThemeProviderProps {
  children: React.ReactNode;
  defaultTheme?: Theme;
  storageKey?: string;
  attribute?: 'class' | 'data-theme';
  enableSystem?: boolean;
  disableTransitionOnChange?: boolean;
  // Allow underscore-prefixed variants for unused parameter suppression
  _attribute?: 'class' | 'data-theme';
  _disableTransitionOnChange?: boolean;
}

/**
 * ThemeProvider Component
 *
 * Manages theme application to the document root.
 * Theme state should be managed separately (e.g., via useSettings hook).
 *
 * Supports next-themes compatible API for theme switching with system preference detection.
 *
 * @example
 * ```tsx
 * <ThemeProvider
 *   attribute="class"
 *   defaultTheme="system"
 *   enableSystem
 *   disableTransitionOnChange
 * >
 *   <App />
 * </ThemeProvider>
 * ```
 */
export function ThemeProvider({
  children,
  defaultTheme = 'system',
  _attribute = 'class',
  enableSystem = true,
  _disableTransitionOnChange = false,
}: ThemeProviderProps) {
  // Initialize theme from localStorage or default
  useEffect(() => {
    const stored = localStorage.getItem(THEME_KEY);
    const theme = (stored as Theme) || defaultTheme;
    applyTheme(theme);
  }, [defaultTheme]);

  // Listen for system theme changes when using 'system' theme
  useEffect(() => {
    if (!enableSystem) {
      return;
    }

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const handleChange = () => {
      const theme = getTheme();
      if (theme === 'system') {
        applyTheme('system');
      }
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [enableSystem]);

  return <>{children}</>;
}
