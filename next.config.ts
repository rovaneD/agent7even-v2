import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Turbopack must not bundle sharp — use the platform-installed native binary.
  serverExternalPackages: ['sharp', '@ffmpeg-installer/ffmpeg'],
  // sharp's native libvips (.so) is not picked up by output file tracing, so
  // Vercel functions failed with "libvips-cpp.so... cannot open shared object".
  // Include the linux-x64 binaries in every server function bundle.
  outputFileTracingIncludes: {
    '/**': [
      './node_modules/@img/sharp-linux-x64/**/*',
      './node_modules/@img/sharp-libvips-linux-x64/**/*',
    ],
    // Video edit step: static ffmpeg binary + subtitle font.
    // Presenter pipeline: joins the creator's voice lines with ffmpeg.
    '/api/internal/presenter-render': ['./node_modules/@ffmpeg-installer/linux-x64/**/*'],
    '/api/internal/voice': ['./node_modules/@ffmpeg-installer/linux-x64/**/*'],
    // Approve & create: voice join + final edit (captions need the fonts).
    '/api/posts/video-create': ['./node_modules/@ffmpeg-installer/linux-x64/**/*', './assets/fonts/**/*'],
    // Cinematic B-roll: voice join + final edit with B-roll cutaways.
    '/api/posts/video-broll': ['./node_modules/@ffmpeg-installer/linux-x64/**/*', './assets/fonts/**/*'],
    '/api/internal/video-assemble': [
      './node_modules/@ffmpeg-installer/linux-x64/**/*',
      './assets/fonts/**/*',
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
