'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';

interface DocsCategoryCardProps {
  icon: ReactNode;
  title: string;
  description: string;
  href: string;
  recommended?: boolean;
  timeEstimate?: string;
  audience?: 'all' | 'beginner' | 'intermediate' | 'advanced';
}

const audienceLabels: Record<string, string> = {
  all: 'All levels',
  beginner: 'Beginner',
  intermediate: 'Intermediate',
  advanced: 'Advanced',
};

export function DocsCategoryCard({
  icon,
  title,
  description,
  href,
  recommended,
  timeEstimate,
  audience,
}: DocsCategoryCardProps) {
  return (
    <Link
      href={href}
      className="group relative flex h-full items-start gap-4 rounded-lg border border-fd-border bg-fd-card p-4 transition-all hover:border-[#f38020]/50 hover:bg-fd-muted/50"
    >
      {recommended && (
        <span className="absolute -top-2 -right-2 px-2 py-1 text-[10px] font-semibold bg-[#f38020] text-white rounded-full">
          Start Here
        </span>
      )}
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-fd-muted text-fd-muted-foreground group-hover:bg-[#f38020]/10 group-hover:text-[#f38020] transition-colors">
        {icon}
      </div>
      <div className="flex flex-col gap-1.5 min-w-0 flex-1">
        <h3 className="text-sm font-medium text-fd-foreground group-hover:text-[#f38020] transition-colors">
          {title}
        </h3>
        <p className="text-xs text-fd-muted-foreground leading-relaxed">{description}</p>
        {(timeEstimate || audience) && (
          <div className="flex items-center gap-2 text-[10px] text-fd-muted-foreground mt-0.5">
            {timeEstimate && (
              <span className="flex items-center gap-1">
                <svg
                  className="h-3 w-3"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.5}
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                {timeEstimate}
              </span>
            )}
            {timeEstimate && audience && <span className="text-fd-border">|</span>}
            {audience && <span>{audienceLabels[audience]}</span>}
          </div>
        )}
      </div>
    </Link>
  );
}
