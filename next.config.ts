import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  serverExternalPackages: ['esbuild'],
  experimental: {
    // Server Actions are enabled by default in Next 16, kept explicit for clarity.
  },
};

export default nextConfig;
