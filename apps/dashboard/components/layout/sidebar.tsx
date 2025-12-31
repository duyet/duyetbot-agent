'use client';

import {
  Activity,
  ChevronLeft,
  ChevronRight,
  ChevronsUpDown,
  Clock,
  CreditCard,
  Database,
  Home,
  MessageSquare,
  Settings,
  Zap,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

/**
 * X.AI Style Sidebar
 *
 * Structure:
 * - Team Selector (Top)
 * - Main Navigation (Middle)
 * - Footer Navigation (Bottom: Billing, Users, Settings)
 */

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  hasLiveIndicator?: boolean;
}

const mainNavItems: NavItem[] = [
  { label: 'Overview', href: '/', icon: Home },
  { label: 'Messages', href: '/messages', icon: MessageSquare },
  { label: 'Sessions', href: '/sessions', icon: Clock },
  { label: 'Events', href: '/events', icon: Zap },
  { label: 'MCP Servers', href: '/mcp', icon: Database },
  { label: 'Tokens', href: '/tokens', icon: Activity },
  { label: 'Cost', href: '/tokens/cost', icon: CreditCard },
];

const bottomNavItems: NavItem[] = [{ label: 'Settings', href: '/settings', icon: Settings }];

export function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  // Helper to render nav link
  const renderNavLink = (item: NavItem) => {
    const Icon = item.icon;
    const isActive =
      pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));

    return (
      <Link
        key={item.href}
        href={item.href}
        title={collapsed ? item.label : undefined}
        className={cn(
          'flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors',
          isActive
            ? 'bg-secondary text-foreground font-medium'
            : 'text-muted-foreground hover:bg-secondary/50 hover:text-foreground'
        )}
      >
        <Icon
          className={cn('h-4 w-4 shrink-0', isActive ? 'text-foreground' : 'text-muted-foreground')}
        />

        {!collapsed && (
          <>
            <span className="flex-1">{item.label}</span>
            {item.hasLiveIndicator && (
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
              </span>
            )}
          </>
        )}
      </Link>
    );
  };

  return (
    <aside
      className={cn(
        'hidden border-r bg-background transition-all duration-300 lg:flex lg:flex-col',
        collapsed ? 'w-16' : 'w-64'
      )}
    >
      {/* Team Selector / Header */}
      <div className="flex h-14 items-center px-2 pt-2">
        <Button
          variant="ghost"
          className={cn(
            'w-full justify-between px-2 font-normal hover:bg-secondary/50',
            collapsed && 'justify-center px-0'
          )}
        >
          {collapsed ? (
            <div className="h-8 w-8 rounded-full bg-secondary flex items-center justify-center">
              <span className="text-xs font-bold">P</span>
            </div>
          ) : (
            <>
              <div className="flex flex-col items-start text-left">
                <span className="text-xs font-medium text-muted-foreground">CLUSTER</span>
                <span className="text-sm font-semibold">Duyetbot Agent</span>
              </div>
              <ChevronsUpDown className="h-4 w-4 text-muted-foreground opacity-50" />
            </>
          )}
        </Button>
      </div>

      {/* Main Navigation */}
      <nav className="flex-1 space-y-0.5 px-2 mt-4 overflow-y-auto">
        {mainNavItems.map(renderNavLink)}
      </nav>

      {/* Bottom Navigation */}
      <div className="mt-auto px-2 pb-2 space-y-0.5">
        {bottomNavItems.map(renderNavLink)}

        {/* Collapse toggle (optional, X doesn't really show one but good for utility) */}
        {!collapsed && <Separator className="my-2" />}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setCollapsed(!collapsed)}
          className={cn(
            'w-full justify-start gap-3 px-3 text-muted-foreground hover:text-foreground',
            collapsed && 'justify-center'
          )}
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          {!collapsed && <span>Collapse</span>}
        </Button>
      </div>
    </aside>
  );
}
