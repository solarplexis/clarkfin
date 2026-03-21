/** @type {import('next').NextConfig} */
const nextConfig = {
  // Output standalone for efficient container/serverless deployment
  output: 'standalone',

  experimental: {
    // Prevent firebase-admin from being bundled for the client
    serverComponentsExternalPackages: ['firebase-admin'],
  },

  images: {
    remotePatterns: [],
  },
};

export default nextConfig;
