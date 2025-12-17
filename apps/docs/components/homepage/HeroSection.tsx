'use client';

import Link from 'next/link';
import { CapabilityBadges } from './CapabilityBadges';
import { ValueProposition } from './ValueProposition';
import { IsometricHeroGraphic } from './IsometricHeroGraphic';

export function HeroSection() {
  return (
    <section className="relative flex flex-col items-center justify-center py-20 lg:py-32 animate-fade-slide-in overflow-hidden border-b border-fd-border bg-fd-background">
      {/* Background Pattern */}
      <div className="absolute inset-0 bg-dot-pattern opacity-50 pointer-events-none" />
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-fd-background pointer-events-none" />

      <div className="container relative z-10 grid lg:grid-cols-2 gap-12 items-center px-4">
        <div className="flex flex-col items-center lg:items-start text-center lg:text-left gap-6">
          {/* Tech Badge */}
          <div className="inline-flex items-center gap-2 px-3 py-1 text-xs font-mono font-medium text-[#f38020] bg-[#f38020]/10 border border-[#f38020]/20 rounded-full animate-fade-slide-in">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#f38020] opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-[#f38020]"></span>
            </span>
            v1.0.0 Stable
          </div>

          <h1 className="text-5xl font-bold tracking-tight text-fd-foreground sm:text-6xl xl:text-7xl font-sans">
            duyetbot
          </h1>
          
          <p className="text-lg text-fd-muted-foreground max-w-xl leading-relaxed">
            "You're absolutly right!"
          </p>

          <CapabilityBadges className="mt-2 text-left" />

          <div className="mt-8 flex flex-col sm:flex-row gap-4 w-full lg:w-auto">
            {/* Primary CTA */}
            <Link
              href="/docs/concepts"
              className="group relative inline-flex items-center justify-center gap-2 px-6 py-3 text-sm font-bold text-white transition-all bg-[#0d0d0d] hover:bg-[#262626] border border-transparent shadow-lg hover:shadow-xl hover:-translate-y-0.5 rounded-lg overflow-hidden min-w-[160px]"
            >
              <div className="absolute inset-0 bg-hatch-pattern opacity-0 group-hover:opacity-10 transition-opacity" />
              <span>Start Building</span>
              <svg
                className="h-4 w-4 transition-transform group-hover:translate-x-1"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 8.25L21 12m0 0l-3.75 3.75M21 12H3" />
              </svg>
            </Link>

            {/* Secondary CTA */}
            <Link
              href="/docs/getting-started"
              className="group inline-flex items-center justify-center gap-2 px-6 py-3 text-sm font-bold text-fd-foreground bg-white border border-fd-border hover:border-[#f38020] hover:text-[#f38020] shadow-sm hover:shadow-md transition-all rounded-lg min-w-[160px]"
            >
              <span className="flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                   <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
                </svg>
                Documentation
              </span>
            </Link>
          </div>
        </div>

        {/* Hero Graphic */}
        <div className="hidden lg:flex items-center justify-center relative">
          <div className="absolute inset-0 bg-blue-500/5 blur-3xl rounded-full" />
          <IsometricHeroGraphic />
        </div>
      </div>
    </section>
  );
}
