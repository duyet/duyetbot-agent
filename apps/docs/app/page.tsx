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
    <main className="container mx-auto px-4 py-8 lg:py-12 max-w-4xl">
      {/* Hero Section */}
      <section className="mb-12">
        <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight mb-4 text-fd-foreground">
          @duyetbot
        </h1>
        <p className="text-lg text-fd-muted-foreground mb-6 max-w-2xl">
        You are absolutely right!
        </p>
      </section>

      {/* Quick Links Section */}
      <section>
        <h2 className="text-xl font-semibold mb-6 text-fd-foreground">Quick Links</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {quickLinks.map((link) => (
            <Link key={link.href} href={link.href}>
              <div className="group h-full rounded-lg border border-fd-muted bg-fd-card p-5 transition-all hover:border-fd-primary cursor-pointer">
                <h3 className="text-lg font-semibold mb-2 text-fd-foreground group-hover:text-fd-primary transition-colors">
                  {link.title}
                </h3>
                <p className="text-sm text-fd-muted-foreground">{link.description}</p>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
