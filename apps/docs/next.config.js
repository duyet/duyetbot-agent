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

const { withContentlayer } = require('next-contentlayer2');

module.exports = withContentlayer(nextConfig);
