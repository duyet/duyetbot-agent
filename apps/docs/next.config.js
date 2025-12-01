/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    mdxRs: true,
  },
  output: 'export',
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
};

const { withContentlayer } = require('@contentlayer/next');

module.exports = withContentlayer(nextConfig);