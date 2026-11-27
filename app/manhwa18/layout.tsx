import type { Metadata } from 'next';
import { AgeGate } from '@/components/AgeGate';
import { AdultDisabled } from '@/components/settings/AdultDisabled';
import { readPreferences } from '@/lib/preferences-server';
import { SITE_NAME } from '@/lib/site';

/**
 * Seluruh bagian /manhwa18 berada di bawah gerbang usia dan sengaja tidak
 * diindeks mesin pencari. Bagian ini hanya bisa dibuka dari panel Tipe di
 * katalog: tidak ada tautan di beranda maupun menu.
 */
export const metadata: Metadata = {
  title: {
    default: 'Manhwa 18+',
    template: `%s | ${SITE_NAME} Manhwa 18+`,
  },
  description:
    'Koleksi manhwa 18+ terjemahan Indonesia. Khusus pembaca 18 tahun ke atas.',
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: { index: false, follow: false },
  },
};

export default async function ManhwaLayout({ children }: { children: React.ReactNode }) {
  const prefs = await readPreferences();
  if (!prefs.adult) return <AdultDisabled section="manhwa18" />;

  return (
    <AgeGate
      description="Semua judul di halaman ini adalah manhwa 18+ terjemahan Indonesia. Dengan masuk, kamu menyatakan sudah berusia 18 tahun atau lebih."
      note="Judul di sini tidak muncul di katalog anime, pencarian utama, maupun sitemap."
    >
      {children}
    </AgeGate>
  );
}
