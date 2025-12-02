import { RootProvider } from 'fumadocs-ui/provider';
import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Duyetbot Agent',
  description: 'Documentation for the duyetbot-agent project',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <RootProvider>{children}</RootProvider>
      </body>
    </html>
  );
}
