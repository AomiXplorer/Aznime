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

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ||
  process.env.APP_URL ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');

const DESCRIPTION =
  'Tonton anime subtitle Indonesia terbaru, ongoing, dan completed dengan katalog cepat, jadwal tayang harian, trailer AniList, serta pemutar yang otomatis memilih server tercepat.';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: 'Aznime – Streaming Anime Subtitle Indonesia',
    template: '%s | Aznime',
  },
  description: DESCRIPTION,
  openGraph: {
    type: 'website',
    locale: 'id_ID',
    siteName: 'Aznime',
    title: 'Aznime – Streaming Anime Subtitle Indonesia',
    description: DESCRIPTION,
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Aznime – Streaming Anime Subtitle Indonesia',
    description: DESCRIPTION,
  },
};

export const viewport: Viewport = {
  themeColor: '#0a0b0e',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'Aznime',
    url: siteUrl,
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
