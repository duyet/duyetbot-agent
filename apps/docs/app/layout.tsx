import { RootProvider } from 'fumadocs-ui/provider';
import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'duyetbot',
  description: 'Documentation for @duyetbot',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="flex flex-col min-h-screen">
        <RootProvider>{children}</RootProvider>
      </body>
    </html>
  );
}
