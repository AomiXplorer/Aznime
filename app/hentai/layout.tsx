import type { Metadata } from 'next';
import { AgeGate } from '@/components/AgeGate';
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

export default function HentaiLayout({ children }: { children: React.ReactNode }) {
  return <AgeGate>{children}</AgeGate>;
}
