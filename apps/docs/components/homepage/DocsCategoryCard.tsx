'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';

interface DocsCategoryCardProps {
  icon: ReactNode;
  title: string;
  description: string;
  href: string;
}

export function DocsCategoryCard({ icon, title, description, href }: DocsCategoryCardProps) {
  return (
    <Link
      href={href}
      className="group flex items-start gap-4 rounded-lg border border-fd-border bg-fd-card p-4 transition-all hover:border-[#f38020]/50 hover:bg-fd-muted/50"
    >
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-fd-muted text-fd-muted-foreground group-hover:bg-[#f38020]/10 group-hover:text-[#f38020] transition-colors">
        {icon}
      </div>
      <div className="flex flex-col gap-1">
        <h3 className="text-sm font-medium text-fd-foreground group-hover:text-[#f38020] transition-colors">
          {title}
        </h3>
        <p className="text-xs text-fd-muted-foreground leading-relaxed">
          {description}
        </p>
      </div>
    </Link>
  );
}
