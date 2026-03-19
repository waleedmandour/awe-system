import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Remove standalone output for Vercel (it handles this automatically)
  typescript: {
    ignoreBuildErrors: false,
  },
  reactStrictMode: true,
  // Enable experimental features for better PWA support
  experimental: {
    // Enable PWA features
  },
};

export default nextConfig;
