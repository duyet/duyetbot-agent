import { initOpenNextCloudflareForDev } from '@opennextjs/cloudflare';
import type { NextConfig } from 'next';

// Initialize Cloudflare context for local development
// This enables access to D1, KV, and other bindings via getCloudflareContext()
initOpenNextCloudflareForDev();

const config: NextConfig = {
  reactStrictMode: true,
  images: {
    unoptimized: true,
  },
};

export default config;
