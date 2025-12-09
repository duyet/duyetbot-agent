'use client';

import {
  Activity,
  ChevronLeft,
  ChevronRight,
  Clock,
  DollarSign,
  LayoutDashboard,
  MessageSquare,
  Radio,
  Zap,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/**
 * Navigation items for the sidebar
 * Icons from lucide-react
 */
const navItems = [
  {
    label: 'Overview',
    href: '/',
    icon: LayoutDashboard,
    description: 'Dashboard overview',
  },
  {
    label: 'Messages',
    href: '/messages',
    icon: MessageSquare,
    description: 'Message explorer',
  },
  {
    label: 'Sessions',
    href: '/sessions',
    icon: Clock,
    description: 'Session browser',
  },
  {
    label: 'Events',
    href: '/events',
    icon: Zap,
    description: 'Event timeline',
  },
  {
    label: 'Tokens',
    href: '/tokens',
    icon: Activity,
    description: 'Token analytics',
  },
  {
    label: 'Cost',
    href: '/tokens/cost',
    icon: DollarSign,
    description: 'Cost analysis',
  },
  {
    label: 'Real-time',
    href: '/realtime',
    icon: Radio,
    description: 'Live monitor',
    hasLiveIndicator: true,
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={cn(
        'hidden border-r border-border bg-background transition-all duration-300 lg:flex lg:flex-col',
        collapsed ? 'w-16' : 'w-64'
      )}
    >
      {/* Logo / Brand */}
      <div className="flex h-16 items-center justify-between border-b border-border px-4">
        {!collapsed && (
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
              <span className="text-sm font-bold text-primary-foreground">D</span>
            </div>
            <span className="font-semibold text-foreground">duyetbot</span>
          </Link>
        )}
        {collapsed && (
          <Link href="/" className="mx-auto">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
              <span className="text-sm font-bold text-primary-foreground">D</span>
            </div>
          </Link>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 p-3">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive =
            pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));

          return (
            <Link
              key={item.href}
              href={item.href}
              title={collapsed ? item.label : undefined}
              className={cn(
                'group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200',
                isActive
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
              )}
            >
              {/* Active indicator bar */}
              {isActive && (
                <span className="absolute left-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r-full bg-primary" />
              )}

              <Icon className={cn('h-5 w-5 shrink-0', isActive && 'text-primary')} />

              {!collapsed && (
                <>
                  <span className="flex-1">{item.label}</span>

                  {/* Live indicator for Real-time */}
                  {item.hasLiveIndicator && (
                    <span className="relative flex h-2 w-2">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-75" />
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
                    </span>
                  )}

                  {/* Hover arrow */}
                  <ChevronRight
                    className={cn(
                      'h-4 w-4 opacity-0 transition-opacity duration-200',
                      'group-hover:opacity-100',
                      isActive && 'opacity-100'
                    )}
                  />
                </>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="border-t border-border p-3">
        {/* Collapse toggle */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setCollapsed(!collapsed)}
          className="w-full justify-center"
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          {!collapsed && <span className="ml-2">Collapse</span>}
        </Button>

        {/* Version info */}
        {!collapsed && (
          <div className="mt-3 rounded-lg bg-secondary/50 p-3">
            <p className="text-xs font-medium text-muted-foreground">Version</p>
            <p className="text-sm font-semibold text-foreground">0.1.0</p>
          </div>
        )}
      </div>
    </aside>
  );
}
