import type { Metadata, Viewport } from 'next';
import { Bricolage_Grotesque, Figtree } from 'next/font/google';
import './globals.css';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import { MaintenanceBypassBanner } from '@/components/MaintenanceBypassBanner';
import { AuthProvider } from '@/components/auth/AuthProvider';
<<<<<<< HEAD
import { SITE_NAME, SITE_URL } from '@/lib/site';
=======
import { serializeJsonLd } from '@/lib/json-ld';
import { siteJsonLd } from '@/lib/seo';
import {
  HOME_URL,
  SITE_DESCRIPTION,
  SITE_LOCALE,
  SITE_NAME,
  SITE_URL,
} from '@/lib/site';
>>>>>>> c5dfbd0 (Update maintennace)

/* Dua peran, dua wajah: Figtree untuk teks dan kontrol, Bricolage Grotesque
   untuk judul. Satu wajah untuk semuanya adalah salah satu tanda paling khas
   UI hasil generator, jadi judul punya karakter sendiri. */
const figtree = Figtree({
  subsets: ['latin'],
  variable: '--font-figtree',
  display: 'swap',
  weight: ['400', '500', '600'],
});

const bricolage = Bricolage_Grotesque({
  subsets: ['latin'],
  variable: '--font-bricolage',
  display: 'swap',
  weight: ['500', '600', '700'],
});

const TITLE = 'Aznime – Streaming Anime Subtitle Indonesia';
<<<<<<< HEAD
const DESCRIPTION =
  'Watch anime with Indonesian subtitles. Fresh episodes, a daily airing schedule, AniList trailers, and a player that picks the fastest server for you.';
=======
const DESCRIPTION = SITE_DESCRIPTION;
>>>>>>> c5dfbd0 (Update maintennace)

/** 1200x630 key visual, dibuat khusus untuk preview WhatsApp/Discord/Telegram/X. */
const OG_IMAGE = `${SITE_URL}/og/aznime-og-v3.jpg`;
const OG_IMAGE_ALT = 'Aznime key visual – anime girl with pink hair and a white high-neck sweater';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  applicationName: SITE_NAME,
  title: {
    default: TITLE,
    template: `%s | ${SITE_NAME}`,
  },
  description: DESCRIPTION,
  keywords: [
<<<<<<< HEAD
=======
    'Aznime',
>>>>>>> c5dfbd0 (Update maintennace)
    'streaming anime',
    'anime subtitle indonesia',
    'nonton anime',
    'anime ongoing',
    'jadwal anime',
    'anime completed',
  ],
  category: 'entertainment',
  alternates: {
<<<<<<< HEAD
    canonical: '/',
=======
    // Selalu bentuk berakhir garis miring, sama seperti yang dilaporkan
    // Search Console sebagai canonical pilihan pengguna.
    canonical: HOME_URL,
>>>>>>> c5dfbd0 (Update maintennace)
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
<<<<<<< HEAD
    locale: 'id_ID',
    siteName: SITE_NAME,
    url: SITE_URL,
=======
    locale: SITE_LOCALE,
    siteName: SITE_NAME,
    url: HOME_URL,
>>>>>>> c5dfbd0 (Update maintennace)
    title: TITLE,
    description: DESCRIPTION,
    images: [
      {
        url: OG_IMAGE,
        width: 1200,
        height: 630,
        alt: OG_IMAGE_ALT,
        type: 'image/jpeg',
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
  themeColor: '#0c0909',
  width: 'device-width',
  initialScale: 1,
  colorScheme: 'dark',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
<<<<<<< HEAD
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: SITE_NAME,
    alternateName: 'Aznime Streaming Anime',
    url: SITE_URL,
    inLanguage: 'id-ID',
    description: DESCRIPTION,
    potentialAction: {
      '@type': 'SearchAction',
      target: `${SITE_URL}/search?q={search_term_string}`,
      'query-input': 'required name=search_term_string',
    },
  };

  return (
    <html lang="id" className={`dark ${figtree.variable}`}>
=======
  const jsonLd = siteJsonLd();

  return (
    <html lang="id" className={`dark ${figtree.variable} ${bricolage.variable}`}>
>>>>>>> c5dfbd0 (Update maintennace)
      <body className="flex min-h-screen flex-col bg-canvas text-[#f4f4f5] selection:bg-accent-strong selection:text-white">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-accent-strong focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-white"
        >
          Langsung ke konten utama
        </a>
        <AuthProvider>
          <Navbar />
          <main id="main-content" className="flex-1">
            {children}
          </main>
          <Footer />
        <MaintenanceBypassBanner />
        </AuthProvider>
        <script
          type="application/ld+json"
<<<<<<< HEAD
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
=======
          dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }}
>>>>>>> c5dfbd0 (Update maintennace)
        />
      </body>
    </html>
  );
}
