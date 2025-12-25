import type { NextConfig } from 'next';

// Development configuration with API proxying to Wrangler
const isDev = process.env.NODE_ENV === 'development';

const config: NextConfig = {
  reactStrictMode: true,
  images: {
    unoptimized: true,
  },
  // Static export for Cloudflare Workers with Assets (production only)
  // In development, use Next.js dev server with rewrites for API proxying
  output: isDev ? undefined : 'export',
  // Skip trailing slash redirects for static hosting
  trailingSlash: false,
  // Disable server-specific features in production
  distDir: 'out',
  // Add rewrites for API proxying in development
  ...(isDev && {
    async rewrites() {
      const apiPort = process.env.WRANGLER_PORT || '8787';
      return [
        {
          source: '/api/v1/:path*',
          destination: `http://localhost:${apiPort}/api/v1/:path*`,
        },
        {
          source: '/api/auth/:path*',
          destination: `http://localhost:${apiPort}/api/auth/:path*`,
        },
      ];
    },
  }),
};

export default config;
