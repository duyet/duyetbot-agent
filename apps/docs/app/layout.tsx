import { RootProvider } from 'fumadocs-ui/provider/next';
import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Duyetbot Agent',
  description: 'Documentation for the duyetbot-agent project',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="flex min-h-screen flex-col bg-background font-['Inter']">
        <RootProvider>{children}</RootProvider>
      </body>
    </html>
  );
}
