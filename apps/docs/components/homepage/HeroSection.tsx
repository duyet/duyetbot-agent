'use client';

import Link from 'next/link';

export function HeroSection() {
  return (
    <section className="flex flex-col items-center justify-center py-10 sm:py-14">
      <div className="flex flex-col items-center gap-4 text-center">
        <h1 className="text-3xl font-semibold tracking-tight text-fd-foreground sm:text-4xl">
          @duyetbot
        </h1>

        <p className="text-base text-fd-muted-foreground">
          You are absolutely right!
        </p>

        <div className="mt-4 flex flex-row gap-3">
          <Link
            href="/docs/getting-started"
            className="inline-flex items-center gap-2 rounded-md bg-[#f38020] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#e5731d]"
          >
            Get Started
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </Link>

          <Link
            href="/docs"
            className="inline-flex items-center gap-2 rounded-md border border-fd-border bg-fd-card px-4 py-2 text-sm font-medium text-fd-foreground transition-colors hover:bg-fd-muted"
          >
            Documentation
          </Link>
        </div>
      </div>
    </section>
  );
}
