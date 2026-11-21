import type { Metadata, Viewport } from 'next';
import { Figtree } from 'next/font/google';
import './globals.css';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';

const figtree = Figtree({
  subsets: ['latin'],
  variable: '--font-figtree',
  display: 'swap',
});

const SITE_NAME = 'Aznime';

/** URL publik kanonik. Urutan prioritas mengikuti lingkungan deploy (Vercel). */
const siteUrl = (
  process.env.NEXT_PUBLIC_SITE_URL ||
  process.env.APP_URL ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : 'http://localhost:3000')
).replace(/\/+$/, '');

const TITLE = 'Aznime – Streaming Anime Subtitle Indonesia';
const DESCRIPTION =
  'Tonton anime subtitle Indonesia terbaru, ongoing, dan completed dengan katalog cepat, jadwal tayang harian, trailer AniList, serta pemutar yang otomatis memilih server tercepat.';

/** 1200x630, dibuat khusus untuk preview WhatsApp/Discord/Telegram/X. */
const OG_IMAGE = `${siteUrl}/og/aznime-og.png`;
const OG_IMAGE_ALT = 'Aznime – streaming anime subtitle Indonesia';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  applicationName: SITE_NAME,
  title: {
    default: TITLE,
    template: `%s | ${SITE_NAME}`,
  },
  description: DESCRIPTION,
  keywords: [
    'streaming anime',
    'anime subtitle indonesia',
    'nonton anime',
    'anime ongoing',
    'jadwal anime',
    'anime completed',
  ],
  category: 'entertainment',
  alternates: {
    canonical: '/',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
      'max-video-preview': -1,
    },
  },
  openGraph: {
    type: 'website',
    locale: 'id_ID',
    siteName: SITE_NAME,
    url: siteUrl,
    title: TITLE,
    description: DESCRIPTION,
    images: [
      {
        url: OG_IMAGE,
        width: 1200,
        height: 630,
        alt: OG_IMAGE_ALT,
        type: 'image/png',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: TITLE,
    description: DESCRIPTION,
    images: [OG_IMAGE],
  },
  // Diisi lewat env setelah properti Search Console dibuat; tidak diklaim aktif.
  verification: process.env.GOOGLE_SITE_VERIFICATION
    ? { google: process.env.GOOGLE_SITE_VERIFICATION }
    : undefined,
};

export const viewport: Viewport = {
  themeColor: '#0a0b0e',
  width: 'device-width',
  initialScale: 1,
  colorScheme: 'dark',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: SITE_NAME,
    alternateName: 'Aznime Streaming Anime',
    url: siteUrl,
    inLanguage: 'id-ID',
    description: DESCRIPTION,
    potentialAction: {
      '@type': 'SearchAction',
      target: `${siteUrl}/search?q={search_term_string}`,
      'query-input': 'required name=search_term_string',
    },
  };

  return (
    <html lang="id" className={`dark ${figtree.variable}`}>
      <body className="flex min-h-screen flex-col bg-canvas text-[#f4f4f5] selection:bg-accent-strong selection:text-white">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-accent-strong focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-white"
        >
          Langsung ke konten utama
        </a>
        <Navbar />
        <main id="main-content" className="flex-1">
          {children}
        </main>
        <Footer />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </body>
    </html>
  );
}
