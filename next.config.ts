import type { NextConfig } from 'next';

/**
 * Header keamanan untuk semua respons.
 *
 * CSP sengaja dibuat permisif pada sumber daya yang memang dipakai situs
 * (iframe pemutar dari host mirror, Turnstile Cloudflare, gambar dari CDN
 * sumber) tetapi tetap menutup jalur serius: plugin/objek, penyalahgunaan
 * <base>, pengiriman form ke domain lain, dan pembingkaian halaman.
 * `script-src` masih memuat 'unsafe-inline' karena Next menyisipkan skrip
 * bootstrap inline tanpa nonce; menghapusnya akan mematikan hidrasi.
 */
const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "media-src 'self' blob: https:",
  "font-src 'self' data:",
  "connect-src 'self' https:",
  "frame-src https:",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
].join('; ');

const SECURITY_HEADERS = [
  { key: 'Content-Security-Policy', value: CONTENT_SECURITY_POLICY },
  // 2 tahun, termasuk subdomain. HSTS hanya dikirim lewat HTTPS oleh browser,
  // jadi domain yang belum punya sertifikat tetap aman.
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()' },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
  { key: 'X-DNS-Prefetch-Control', value: 'off' },
];

const nextConfig: NextConfig = {
  /* Source map browser tidak dikirim ke publik: isi bundle server memuat nama
     variabel internal dan jalur file, tidak ada gunanya dibagikan ke pengunjung. */
  productionBrowserSourceMaps: false,

  reactStrictMode: true,
  poweredByHeader: false,
  compress: true,

  images: {
    // Optimizer gambar Vercel dibatasi kuota transformasi per bulan; saat habis
    // semua /_next/image dibalas 402 OPTIMIZED_IMAGE_REQUEST_PAYMENT_REQUIRED dan
    // poster jatuh ke placeholder. Poster di sini sudah berukuran kartu dari CDN
    // sumber, jadi langsung pakai URL aslinya: tanpa kuota, tanpa biaya transformasi.
    unoptimized: true,
    // AVIF/WebP otomatis memangkas ~30-50% byte poster tanpa mengubah kualitas
    // visual pada ukuran kartu.
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 60 * 60 * 24 * 30,
    deviceSizes: [360, 420, 640, 768, 1024, 1280, 1600, 1920],
    imageSizes: [64, 96, 128, 160, 210, 256, 384],
    // Poster Nekopoi dilayani proksi sendiri: /api/img?u=...
    // Pola lokal ini membuat gambar berproksi tetap sah bila suatu saat
    // dipasang tanpa prop `unoptimized`.
    localPatterns: [
      { pathname: '/api/img', search: '**' },
      { pathname: '/contributors/**' },
    ],
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
        source: '/:path*',
        headers: SECURITY_HEADERS,
      },
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
