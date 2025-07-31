/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  serverExternalPackages: ['@react-pdf/renderer'],
};

export default nextConfig;
