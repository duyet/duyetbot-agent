'use client';

import {
  Activity,
  ChevronRight,
  Clock,
  LayoutDashboard,
  MessageSquare,
  Settings,
  Zap,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

const navItems = [
  {
    label: 'Overview',
    href: '/',
    icon: LayoutDashboard,
  },
  {
    label: 'Messages',
    href: '/messages',
    icon: MessageSquare,
  },
  {
    label: 'Sessions',
    href: '/sessions',
    icon: Clock,
  },
  {
    label: 'Events',
    href: '/events',
    icon: Zap,
  },
  {
    label: 'Tokens',
    href: '/tokens',
    icon: Activity,
  },
  {
    label: 'Real-time',
    href: '/realtime',
    icon: Activity,
  },
  {
    label: 'Settings',
    href: '/settings',
    icon: Settings,
  },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden w-60 border-r border-border bg-card lg:flex lg:flex-col">
      <nav className="flex-1 space-y-2 p-4">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'text-foreground hover:bg-secondary'
              )}
            >
              <Icon className="h-4 w-4" />
              <span className="flex-1">{item.label}</span>
              {isActive && <ChevronRight className="h-4 w-4" />}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-border p-4">
        <div className="rounded-md bg-secondary p-4">
          <p className="text-xs font-semibold text-muted-foreground">Version</p>
          <p className="text-sm font-bold">0.1.0</p>
        </div>
      </div>
    </aside>
  );
}
