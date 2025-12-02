import { Button } from 'fumadocs-ui/components/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from 'fumadocs-ui/components/card';
import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="fumadocs-max-w-4xl fumadocs-container fumadocs-mx-auto fumadocs-p-8 fumadocs-max-w-[90vw] fumadocs-md:fumadocs-max-w-[80vw]">
      <div className="fumadocs-mb-12 fumadocs-flex fumadocs-flex-col fumadocs-items-center fumadocs-text-center fumadocs-pt-12">
        <h1 className="fumadocs-mb-4 fumadocs-text-5xl fumadocs-font-extrabold fumadocs-tracking-tight fumadocs-bg-gradient fumadocs-from-black fumadocs-via-gray-600 fumadocs-to-black fumadocs-bg-clip-text fumadocs-text-transparent fumadocs-sm:fumadocs-text-6xl">
          Duyetbot Agent
        </h1>
        <p className="fumadocs-max-w-2xl fumadocs-text-xl fumadocs-text-muted-foreground fumadocs-mb-8">
          Autonomous AI agent with persistent memory across CLI, GitHub, and Telegram
        </p>
        <div className="fumadocs-flex fumadocs-flex-col fumadocs-sm:fumadocs-flex-row fumadocs-gap-4">
          <Button variant="secondary" size="lg" asChild>
            <Link href="/docs/README">Get Started</Link>
          </Button>
        </div>
      </div>
      <div className="fumadocs-grid fumadocs-grid-cols-1 fumadocs-md:fumadocs-grid-cols-2 fumadocs-lg:fumadocs-grid-cols-3 fumadocs-gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Quick Start</CardTitle>
            <CardDescription>Installation and basic setup</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" asChild className="fumadocs-w-full">
              <Link href="/docs/getting-started">getting-started.md</Link>
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Architecture</CardTitle>
            <CardDescription>System design overview</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" asChild className="fumadocs-w-full">
              <Link href="/docs/architecture">architecture.md</Link>
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Deployment</CardTitle>
            <CardDescription>Deploy to Cloudflare Pages</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" asChild className="fumadocs-w-full">
              <Link href="/docs/deploy">deploy.md</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
