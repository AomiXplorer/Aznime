import type { Metadata } from 'next';
import { AgeGate } from '@/components/AgeGate';
import { AdultDisabled } from '@/components/settings/AdultDisabled';
import { readPreferences } from '@/lib/preferences-server';
import { SITE_NAME } from '@/lib/site';

/**
 * Seluruh bagian /hentai berada di bawah gerbang usia dan sengaja tidak
 * diindeks mesin pencari: katalog utama tetap bersih, dan halaman dewasa tidak
 * pernah masuk sitemap.
 */
export const metadata: Metadata = {
  title: {
    default: 'Hentai Sub Indo',
    template: `%s | ${SITE_NAME} Hentai`,
  },
  description:
    'Koleksi hentai subtitle Indonesia: seri lengkap dan episode terbaru. Khusus penonton 18 tahun ke atas.',
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: { index: false, follow: false },
  },
};

export default async function HentaiLayout({ children }: { children: React.ReactNode }) {
  const prefs = await readPreferences();
  if (!prefs.adult) return <AdultDisabled section="hentai" />;
  return <AgeGate>{children}</AgeGate>;
}
