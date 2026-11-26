import type { Metadata } from 'next';
import { AgeGate } from '@/components/AgeGate';
import { SITE_NAME } from '@/lib/site';

/**
 * Seluruh bagian /doujin berada di bawah gerbang usia dan sengaja tidak
 * diindeks mesin pencari. Bagian ini hanya bisa dibuka dari panel Tipe di
 * katalog: tidak ada tautan di beranda maupun menu.
 */
export const metadata: Metadata = {
  title: {
    default: 'Doujin',
    template: `%s | ${SITE_NAME} Doujin`,
  },
  description:
    'Koleksi komik dewasa (manhwa dan manhua) terjemahan Indonesia. Khusus pembaca 18 tahun ke atas.',
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: { index: false, follow: false },
  },
};

export default function DoujinLayout({ children }: { children: React.ReactNode }) {
  return <AgeGate>{children}</AgeGate>;
}
