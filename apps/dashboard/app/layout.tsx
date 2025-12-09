import type { Metadata, Viewport } from 'next';
import { Providers } from './providers';
import './globals.css';
import { Header } from '@/components/layout/header';
import { Sidebar } from '@/components/layout/sidebar';

export const metadata: Metadata = {
  title: 'duyetbot Dashboard',
  description: 'AI Agent Dashboard and Monitor',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta charSet="utf-8" />
      </head>
      <body className="overflow-hidden">
        <Providers>
          <div className="flex h-screen flex-col bg-background">
            {/* Header */}
            <Header />

            {/* Main content with sidebar */}
            <div className="flex flex-1 overflow-hidden">
              {/* Sidebar */}
              <Sidebar />

              {/* Page content */}
              <main className="flex-1 overflow-auto">
                <div className="h-full">{children}</div>
              </main>
            </div>
          </div>
        </Providers>
      </body>
    </html>
  );
}
