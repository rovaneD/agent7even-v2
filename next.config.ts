import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Turbopack must not bundle sharp — use the platform-installed native binary.
  serverExternalPackages: ['sharp'],
  // sharp's native libvips (.so) is not picked up by output file tracing, so
  // Vercel functions failed with "libvips-cpp.so... cannot open shared object".
  // Include the linux-x64 binaries in every server function bundle.
  outputFileTracingIncludes: {
    '/**': [
      './node_modules/@img/sharp-linux-x64/**/*',
      './node_modules/@img/sharp-libvips-linux-x64/**/*',
    ],
  },
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
