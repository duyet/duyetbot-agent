'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { SimpleTooltip } from './SimpleTooltip';

const InfoIcon = ({ className }: { className: string }) => (
  <svg
    className={className}
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth={1.5}
    aria-hidden="true"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
    />
  </svg>
);

interface FeatureCardProps {
  number: string;
  title: string;
  description: string;
  icon: ReactNode;
  href: string;
  technicalDetails?: string;
}

export function FeatureCard({
  number,
  title,
  description,
  icon,
  href,
  technicalDetails,
}: FeatureCardProps) {
  return (
    <Link
      href={href}
      className="group relative flex flex-col gap-3 rounded-lg border border-fd-border bg-fd-card p-5 transition-all hover:border-[#f38020]/50 hover:bg-fd-muted/30"
    >
      <div className="flex items-center gap-3">
        <span className="font-mono text-xs font-semibold text-[#f38020]">{number}</span>
        <div className="text-fd-muted-foreground group-hover:text-[#f38020] transition-colors">
          {icon}
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-fd-foreground group-hover:text-[#f38020] transition-colors">
            {title}
          </h3>
          {technicalDetails && (
            <SimpleTooltip content={technicalDetails}>
              <InfoIcon className="h-3.5 w-3.5 text-fd-muted-foreground hover:text-[#f38020] cursor-help transition-colors" />
            </SimpleTooltip>
          )}
        </div>
        <p className="text-xs text-fd-muted-foreground leading-relaxed">{description}</p>
      </div>

      <div className="mt-auto flex items-center gap-1.5 text-xs font-medium text-[#f38020] opacity-0 group-hover:opacity-100 transition-opacity">
        Learn more
        <svg
          className="h-3 w-3 transition-transform group-hover:translate-x-0.5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          strokeWidth={2}
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      </div>
    </Link>
  );
}
