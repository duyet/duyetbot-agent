import Link from 'next/link';

interface QuickLink {
  title: string;
  description: string;
  href: string;
}

const quickLinks: QuickLink[] = [
  {
    title: 'Architecture',
    description: 'System design overview',
    href: '/docs/architecture',
  },
  {
    title: 'Getting Started',
    description: 'Setup and installation',
    href: '/docs/getting-started',
  },
  {
    title: 'Cloudflare First',
    description: 'Deploy to the edge',
    href: '/docs/guides/cloudflare-first',
  },
  {
    title: 'Router Agent',
    description: 'Smart query routing',
    href: '/docs/concepts/router-agent',
  },
  {
    title: 'Telegram Setup',
    description: 'Build a Telegram bot',
    href: '/docs/guides/telegram-bot-setup',
  },
  {
    title: 'API Reference',
    description: 'Endpoints and schemas',
    href: '/docs/reference/api',
  },
];

export default function HomePage() {
  return (
    <main className="min-h-screen flex flex-col">
      {/* Hero Section */}
      <section className="flex-1 flex flex-col items-center justify-center px-4 py-16 sm:py-24 lg:py-32">
        <div className="text-center max-w-4xl">
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight mb-6">
            <span className="bg-gradient-to-r from-fd-primary to-fd-primary/70 bg-clip-text text-transparent">
              DUYETBOT AGENT
            </span>
          </h1>
          <p className="text-lg sm:text-xl text-fd-muted-foreground mb-10 max-w-2xl mx-auto">
            Autonomous AI agent with persistent memory across CLI, GitHub, and Telegram
          </p>
          <Link
            href="/docs/getting-started"
            className="inline-flex items-center justify-center rounded-lg bg-fd-primary px-8 py-3 text-base font-medium text-fd-primary-foreground shadow-lg transition-all hover:bg-fd-primary/90 hover:shadow-xl active:scale-95"
          >
            Get Started →
          </Link>
        </div>
      </section>

      {/* Quick Links Section */}
      <section className="flex-1 px-4 py-16 sm:py-24 lg:py-32">
        <div className="container mx-auto max-w-6xl">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {quickLinks.map((link) => (
              <Link key={link.href} href={link.href}>
                <div className="group relative h-full rounded-xl border border-fd-muted bg-fd-card p-6 sm:p-8 transition-all hover:border-fd-primary hover:shadow-lg hover:shadow-fd-primary/10 hover:bg-opacity-80 cursor-pointer">
                  <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-fd-primary/0 to-fd-primary/0 group-hover:from-fd-primary/5 group-hover:to-fd-primary/5 transition-all" />
                  <div className="relative z-10">
                    <h3 className="text-xl sm:text-2xl font-bold mb-3 text-fd-foreground group-hover:text-fd-primary transition-colors">
                      {link.title}
                    </h3>
                    <p className="text-base text-fd-muted-foreground group-hover:text-fd-foreground transition-colors">
                      {link.description}
                    </p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
