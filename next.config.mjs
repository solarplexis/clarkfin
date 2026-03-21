/** @type {import('next').NextConfig} */
const nextConfig = {
  // Output standalone for efficient container/serverless deployment
  output: 'standalone',

  // Prevent firebase-admin from being bundled for the client
  serverExternalPackages: ['firebase-admin'],

  images: {
    remotePatterns: [],
  },
};

export default nextConfig;
