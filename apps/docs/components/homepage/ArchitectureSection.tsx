'use client';

export function ArchitectureSection() {
  return (
    <section className="my-12">
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-fd-foreground mb-1">
          System Architecture
        </h2>
        <p className="text-sm text-fd-muted-foreground">
          How requests flow through the agent system
        </p>
      </div>

      {/* Architecture Diagram Container */}
      <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6 sm:p-8">
        {/* Subtle grid pattern overlay */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
          }}
        />

        {/* Desktop SVG Diagram */}
        <div className="hidden md:block relative">
          <svg
            viewBox="0 0 900 320"
            className="w-full h-auto"
            style={{ minHeight: '280px' }}
          >
            {/* Connection Lines - Smooth Bezier Curves */}
            <defs>
              <linearGradient id="lineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#f38020" stopOpacity="0.6" />
                <stop offset="100%" stopColor="#f38020" stopOpacity="0.3" />
              </linearGradient>
              <filter id="glow">
                <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
                <feMerge>
                  <feMergeNode in="coloredBlur"/>
                  <feMergeNode in="SourceGraphic"/>
                </feMerge>
              </filter>
            </defs>

            {/* Telegram to Workers */}
            <path
              d="M 155 100 C 220 100, 240 160, 305 160"
              fill="none"
              stroke="url(#lineGradient)"
              strokeWidth="2"
              strokeLinecap="round"
            />

            {/* GitHub to Workers */}
            <path
              d="M 155 220 C 220 220, 240 160, 305 160"
              fill="none"
              stroke="url(#lineGradient)"
              strokeWidth="2"
              strokeLinecap="round"
            />

            {/* Workers to Router */}
            <path
              d="M 445 160 C 510 160, 520 160, 575 160"
              fill="none"
              stroke="url(#lineGradient)"
              strokeWidth="2"
              strokeLinecap="round"
            />

            {/* Router to Agents */}
            <path
              d="M 715 130 C 760 130, 770 70, 815 70"
              fill="none"
              stroke="url(#lineGradient)"
              strokeWidth="2"
              strokeLinecap="round"
            />
            <path
              d="M 715 150 C 760 150, 770 130, 815 130"
              fill="none"
              stroke="url(#lineGradient)"
              strokeWidth="2"
              strokeLinecap="round"
            />
            <path
              d="M 715 170 C 760 170, 770 190, 815 190"
              fill="none"
              stroke="url(#lineGradient)"
              strokeWidth="2"
              strokeLinecap="round"
            />
            <path
              d="M 715 190 C 760 190, 770 250, 815 250"
              fill="none"
              stroke="url(#lineGradient)"
              strokeWidth="2"
              strokeLinecap="round"
            />

            {/* Platform Nodes */}
            <g transform="translate(30, 65)">
              <rect
                x="0"
                y="0"
                width="125"
                height="70"
                rx="8"
                fill="white"
                fillOpacity="0.95"
                filter="url(#glow)"
              />
              <text x="62.5" y="32" textAnchor="middle" className="text-sm font-medium fill-slate-800">
                Telegram
              </text>
              <text x="62.5" y="50" textAnchor="middle" className="text-xs fill-slate-500">
                Bot Interface
              </text>
            </g>

            <g transform="translate(30, 185)">
              <rect
                x="0"
                y="0"
                width="125"
                height="70"
                rx="8"
                fill="white"
                fillOpacity="0.95"
                filter="url(#glow)"
              />
              <text x="62.5" y="32" textAnchor="middle" className="text-sm font-medium fill-slate-800">
                GitHub
              </text>
              <text x="62.5" y="50" textAnchor="middle" className="text-xs fill-slate-500">
                Webhooks
              </text>
            </g>

            {/* Workers Node */}
            <g transform="translate(305, 120)">
              <rect
                x="0"
                y="0"
                width="140"
                height="80"
                rx="8"
                fill="white"
                fillOpacity="0.95"
                filter="url(#glow)"
              />
              <text x="70" y="35" textAnchor="middle" className="text-sm font-medium fill-slate-800">
                Workers
              </text>
              <text x="70" y="55" textAnchor="middle" className="text-xs fill-slate-500">
                Edge Runtime
              </text>
            </g>

            {/* Router Node - Highlighted */}
            <g transform="translate(575, 110)">
              <rect
                x="0"
                y="0"
                width="140"
                height="100"
                rx="8"
                fill="#f38020"
                fillOpacity="0.15"
                stroke="#f38020"
                strokeWidth="2"
              />
              <rect
                x="4"
                y="4"
                width="132"
                height="92"
                rx="6"
                fill="white"
                fillOpacity="0.98"
              />
              <text x="70" y="40" textAnchor="middle" className="text-sm font-semibold fill-slate-800">
                Router Agent
              </text>
              <text x="70" y="60" textAnchor="middle" className="text-xs fill-slate-500">
                Durable Object
              </text>
              <text x="70" y="80" textAnchor="middle" className="text-[10px] fill-[#f38020] font-medium">
                Pattern + LLM
              </text>
            </g>

            {/* Agent Nodes */}
            <g transform="translate(815, 40)">
              <rect
                x="0"
                y="0"
                width="70"
                height="56"
                rx="6"
                fill="white"
                fillOpacity="0.9"
              />
              <text x="35" y="24" textAnchor="middle" className="text-xs font-medium fill-slate-700">
                Simple
              </text>
              <text x="35" y="40" textAnchor="middle" className="text-[10px] fill-slate-400">
                Quick
              </text>
            </g>

            <g transform="translate(815, 100)">
              <rect
                x="0"
                y="0"
                width="70"
                height="56"
                rx="6"
                fill="white"
                fillOpacity="0.9"
              />
              <text x="35" y="24" textAnchor="middle" className="text-xs font-medium fill-slate-700">
                Orchestrator
              </text>
              <text x="35" y="40" textAnchor="middle" className="text-[10px] fill-slate-400">
                Complex
              </text>
            </g>

            <g transform="translate(815, 162)">
              <rect
                x="0"
                y="0"
                width="70"
                height="56"
                rx="6"
                fill="white"
                fillOpacity="0.9"
              />
              <text x="35" y="24" textAnchor="middle" className="text-xs font-medium fill-slate-700">
                HITL
              </text>
              <text x="35" y="40" textAnchor="middle" className="text-[10px] fill-slate-400">
                Approval
              </text>
            </g>

            <g transform="translate(815, 222)">
              <rect
                x="0"
                y="0"
                width="70"
                height="56"
                rx="6"
                fill="white"
                fillOpacity="0.9"
              />
              <text x="35" y="24" textAnchor="middle" className="text-xs font-medium fill-slate-700">
                Researcher
              </text>
              <text x="35" y="40" textAnchor="middle" className="text-[10px] fill-slate-400">
                Deep
              </text>
            </g>

            {/* Flow Labels */}
            <text x="200" y="30" className="text-[10px] fill-slate-400 font-medium uppercase tracking-wider">
              Platforms
            </text>
            <text x="340" y="30" className="text-[10px] fill-slate-400 font-medium uppercase tracking-wider">
              Edge
            </text>
            <text x="600" y="30" className="text-[10px] fill-slate-400 font-medium uppercase tracking-wider">
              Routing
            </text>
            <text x="810" y="30" className="text-[10px] fill-slate-400 font-medium uppercase tracking-wider">
              Agents
            </text>
          </svg>
        </div>

        {/* Mobile Layout */}
        <div className="md:hidden space-y-4">
          <div className="text-[10px] text-slate-400 font-medium uppercase tracking-wider mb-2">
            Platforms
          </div>
          <div className="grid grid-cols-2 gap-2">
            <MobileNode title="Telegram" subtitle="Bot" />
            <MobileNode title="GitHub" subtitle="Webhooks" />
          </div>

          <MobileArrow />

          <div className="text-[10px] text-slate-400 font-medium uppercase tracking-wider mb-2">
            Edge
          </div>
          <MobileNode title="Workers" subtitle="Runtime" />

          <MobileArrow />

          <div className="text-[10px] text-slate-400 font-medium uppercase tracking-wider mb-2">
            Routing
          </div>
          <MobileNode title="Router Agent" subtitle="Pattern + LLM" highlight />

          <MobileArrow />

          <div className="text-[10px] text-slate-400 font-medium uppercase tracking-wider mb-2">
            Agents
          </div>
          <div className="grid grid-cols-2 gap-2">
            <MobileNode title="Simple" subtitle="Quick" small />
            <MobileNode title="Orchestrator" subtitle="Complex" small />
            <MobileNode title="HITL" subtitle="Approval" small />
            <MobileNode title="Researcher" subtitle="Deep" small />
          </div>
        </div>
      </div>
    </section>
  );
}

interface MobileNodeProps {
  title: string;
  subtitle: string;
  highlight?: boolean;
  small?: boolean;
}

function MobileNode({ title, subtitle, highlight, small }: MobileNodeProps) {
  return (
    <div
      className={`
        rounded-lg px-4 py-3 text-center
        ${highlight
          ? 'bg-[#f38020]/10 border-2 border-[#f38020]/50'
          : 'bg-white/90'
        }
        ${small ? 'py-2' : 'py-3'}
      `}
    >
      <div className={`font-medium text-slate-800 ${small ? 'text-xs' : 'text-sm'}`}>
        {title}
      </div>
      <div className={`text-slate-500 ${small ? 'text-[10px]' : 'text-xs'} mt-0.5`}>
        {subtitle}
      </div>
    </div>
  );
}

function MobileArrow() {
  return (
    <div className="flex justify-center py-1">
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <path
          d="M10 4L10 16M10 16L6 12M10 16L14 12"
          stroke="#f38020"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity="0.6"
        />
      </svg>
    </div>
  );
}
