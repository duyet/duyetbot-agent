'use client';

import { Bell, Calendar, Menu, Moon, Search, Sun, X } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

/**
 * Header Component - Grok/X Style
 *
 * Features:
 * - Sticky header with backdrop blur
 * - Theme toggle (Light/Dark/Dim)
 * - Search bar with X-style focus
 * - Mobile menu trigger
 * - Notification indicator
 */
export function Header() {
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark' | 'dim'>('dark');

  const applyTheme = useCallback((newTheme: 'light' | 'dark' | 'dim') => {
    const root = document.documentElement;
    root.classList.remove('light', 'dark', 'dim');
    root.classList.add(newTheme);
    localStorage.setItem('theme', newTheme);
  }, []);

  // Initialize theme from localStorage or system preference
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') as 'light' | 'dark' | 'dim' | null;
    if (savedTheme) {
      setTheme(savedTheme);
      applyTheme(savedTheme);
    } else if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
      setTheme('dark');
      applyTheme('dark');
    }
  }, [applyTheme]);

  const toggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'dim' : theme === 'dim' ? 'light' : 'dark';
    setTheme(nextTheme);
    applyTheme(nextTheme);
  };

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-md">
      <div className="flex h-16 items-center justify-between px-4 md:px-6">
        {/* Left section */}
        <div className="flex items-center gap-4">
          {/* Mobile menu button */}
          <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Toggle menu">
            <Menu className="h-5 w-5" />
          </Button>

          {/* Title - hidden on mobile when search is open */}
          <h1
            className={cn(
              'text-lg font-semibold transition-opacity duration-200',
              isSearchOpen && 'hidden md:block'
            )}
          >
            Dashboard
          </h1>
        </div>

        {/* Center section - Search */}
        <div className={cn('hidden items-center md:flex', isSearchOpen && 'flex flex-1 mx-4')}>
          <div className="relative w-full max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search messages, events..."
              className="w-full pl-10 pr-4"
              variant="ghost"
            />
          </div>
        </div>

        {/* Mobile search toggle */}
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden"
          onClick={() => setIsSearchOpen(!isSearchOpen)}
          aria-label={isSearchOpen ? 'Close search' : 'Open search'}
        >
          {isSearchOpen ? <X className="h-5 w-5" /> : <Search className="h-5 w-5" />}
        </Button>

        {/* Right section */}
        <div className="flex items-center gap-2">
          {/* Date picker */}
          <div className="hidden items-center gap-2 rounded-lg border border-border bg-secondary/50 px-3 py-2 md:flex">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">
              {new Date().toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })}
            </span>
          </div>

          {/* Theme toggle */}
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
            aria-label={`Switch to ${theme === 'dark' ? 'dim' : theme === 'dim' ? 'light' : 'dark'} theme`}
            title={`Current: ${theme} | Click to switch`}
          >
            {theme === 'light' ? (
              <Sun className="h-5 w-5" />
            ) : theme === 'dark' ? (
              <Moon className="h-5 w-5" />
            ) : (
              <Moon className="h-5 w-5 text-primary" />
            )}
          </Button>

          {/* Notifications */}
          <Button variant="ghost" size="icon" className="relative" aria-label="Notifications">
            <Bell className="h-5 w-5" />
            {/* Notification dot */}
            <span className="absolute right-2 top-2 flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
            </span>
          </Button>

          {/* User avatar placeholder */}
          <Button variant="ghost" size="icon" className="rounded-full" aria-label="User menu">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
              U
            </div>
          </Button>
        </div>
      </div>

      {/* Mobile search input - shown when search is open */}
      {isSearchOpen && (
        <div className="border-t border-border p-4 md:hidden">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search messages, events..."
              className="w-full pl-10 pr-4"
              variant="ghost"
              autoFocus
            />
          </div>
        </div>
      )}
    </header>
  );
}
