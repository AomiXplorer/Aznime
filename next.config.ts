import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  compress: true,

  images: {
    // AVIF/WebP otomatis memangkas ~30-50% byte poster tanpa mengubah kualitas
    // visual pada ukuran kartu.
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 60 * 60 * 24 * 30,
    deviceSizes: [360, 420, 640, 768, 1024, 1280, 1600, 1920],
    imageSizes: [64, 96, 128, 160, 210, 256, 384],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
      {
        protocol: 'http',
        hostname: '**',
      },
    ],
  },

  experimental: {
    // Tree-shake import ikon agar bundel hanya memuat ikon yang dipakai.
    optimizePackageImports: ['lucide-react'],
  },

  async headers() {
    return [
      {
        // Aset brand statis: aman di-cache lama karena namanya tidak berubah.
        source: '/:dir(icons|og)/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
    ];
  },
};

export default nextConfig;
