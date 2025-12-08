'use client';

import { Calendar, Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export function Header() {
  return (
    <header className="border-b border-border bg-card px-6 py-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button className="rounded-md p-2 hover:bg-secondary lg:hidden" aria-label="Toggle menu">
            <Menu className="h-5 w-5" />
          </button>
          <h1 className="text-lg font-semibold">duyetbot Dashboard</h1>
        </div>

        <div className="flex items-center gap-4">
          <div className="hidden items-center gap-2 rounded-md border border-input bg-background px-3 py-2 md:flex">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <Input
              type="date"
              className="border-0 bg-transparent p-0 text-sm focus:ring-0"
              defaultValue={new Date().toISOString().split('T')[0]}
            />
          </div>
        </div>
      </div>
    </header>
  );
}
