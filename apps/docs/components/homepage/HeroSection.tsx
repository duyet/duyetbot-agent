'use client';

import Link from 'next/link';
import { CapabilityBadges } from './CapabilityBadges';
import { ValueProposition } from './ValueProposition';

export function HeroSection() {
  return (
    <section className="flex flex-col items-center justify-center py-10 sm:py-14 animate-fade-slide-in">
      <div className="flex flex-col items-center gap-4 text-center">
        <h1 className="text-3xl font-semibold tracking-tight text-fd-foreground sm:text-4xl">
          @duyetbot
        </h1>

        <ValueProposition />
        <CapabilityBadges className="mt-4" />

        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          {/* Primary CTA - Concepts (understanding first) */}
          <Link
            href="/docs/concepts"
            className="group inline-flex items-center justify-center gap-2 rounded-md bg-[#f38020] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#e5731d] animate-fade-slide-in"
            style={{ animationDelay: '0.2s', animationFillMode: 'both' }}
          >
            Understand Architecture
            <span className="text-xs opacity-80">5 min</span>
            <svg
              className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
              aria-hidden="true"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </Link>

          {/* Secondary CTA - Quick Start */}
          <Link
            href="/docs/getting-started"
            className="inline-flex items-center justify-center gap-2 rounded-md border border-fd-border bg-fd-card px-4 py-2 text-sm font-medium text-fd-foreground transition-colors hover:bg-fd-muted animate-fade-slide-in"
            style={{ animationDelay: '0.3s', animationFillMode: 'both' }}
          >
            Quick Start
            <span className="text-xs text-fd-muted-foreground">10 min</span>
          </Link>

          {/* Tertiary CTA - Deploy */}
          <Link
            href="/docs/guides/cloudflare-deploy"
            className="inline-flex items-center justify-center gap-2 rounded-md border border-fd-border bg-fd-card px-4 py-2 text-sm font-medium text-fd-foreground transition-colors hover:bg-fd-muted animate-fade-slide-in"
            style={{ animationDelay: '0.4s', animationFillMode: 'both' }}
          >
            Deploy Now
          </Link>
        </div>
      </div>
    </section>
  );
}
