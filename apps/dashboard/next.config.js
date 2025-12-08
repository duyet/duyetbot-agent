/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    esmExternals: true,
  },
  // Required for Cloudflare Workers
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
