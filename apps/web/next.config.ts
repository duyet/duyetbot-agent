import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  images: {
    remotePatterns: [
      {
        hostname: "avatar.vercel.sh",
      },
      {
        protocol: "https",
        // R2 bucket public URL - configure with your custom domain
        // Replace with your actual R2 public URL or custom domain
        hostname: "*.r2.dev",
      },
    ],
  },
};

export default nextConfig;
