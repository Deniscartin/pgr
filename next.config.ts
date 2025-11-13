import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  serverExternalPackages: ['@react-pdf/renderer'],
  webpack: (config) => {
    // Exclude the Expo mobile app directory from Next.js build
    config.module.rules.push({
      test: /\.(tsx|ts|js|jsx)$/,
      exclude: /petrolis-app/,
    });
    return config;
  },
};

export default nextConfig;
