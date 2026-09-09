import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Turbopack must not bundle sharp — use the platform-installed native binary.
  serverExternalPackages: ['sharp'],
  turbopack: {
    root: __dirname,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
    ],
  },
}

export default nextConfig
