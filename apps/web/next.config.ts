import type { NextConfig } from 'next';

const config: NextConfig = {
  reactStrictMode: true,
  images: {
    unoptimized: true,
  },
  // Static export for Cloudflare Workers with Assets
  output: 'export',
  // Skip trailing slash redirects for static hosting
  trailingSlash: false,
  // Disable server-specific features
  distDir: 'out',
};

export default config;
