'use client';

import { BookOpen, Command, Moon, Search, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export function Header() {
  const { setTheme, theme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background">
      <div className="flex h-14 items-center justify-between px-4">
        {/* Left: Branding / Breadcrumbs (if needed, otherwise empty to push Search right) */}
        <div className="flex items-center gap-2">{/* Can put breadcrumbs here */}</div>

        {/* Right: Search + Actions */}
        <div className="flex items-center gap-2">
          {/* Search Pill */}
          <div className="relative w-64 hidden md:block">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search"
              className="h-9 w-full rounded-md bg-secondary border-none pl-8 pr-12 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:ring-1 focus-visible:ring-ring"
            />
            <div className="absolute right-2 top-2.5 flex items-center gap-0.5 rounded bg-background/50 px-1.5 py-0.5 text-[0.6rem] font-medium text-muted-foreground border border-border">
              <Command className="h-2 w-2" />
              <span>K</span>
            </div>
          </div>

          {/* Docs Link */}
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 text-muted-foreground"
            title="Documentation"
          >
            <BookOpen className="h-4 w-4" />
          </Button>

          {/* Theme Toggle */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="h-9 w-9 text-muted-foreground"
          >
            {mounted &&
              (theme === 'dark' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />)}
          </Button>

          {/* User Profile */}
          <Button variant="ghost" className="h-9 w-9 rounded-full p-0 ml-1">
            <Avatar className="h-8 w-8">
              {/* <AvatarImage src="/placeholder-user.jpg" alt="@duyet" /> */}
              <AvatarFallback className="bg-orange-500 text-white font-medium text-xs">
                D
              </AvatarFallback>
            </Avatar>
          </Button>
        </div>
      </div>
    </header>
  );
}
