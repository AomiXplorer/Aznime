import type { Metadata } from 'next';
import { socialMeta } from '@/lib/seo';
import { PageHeader } from '@/components/PageHeader';
import { HistoryView } from '@/components/history/HistoryView';

export const metadata: Metadata = {
  title: 'Riwayat tontonan',
  description: 'Lanjutkan anime yang terakhir kamu tonton. Riwayat tersimpan di akun dan tersedia di perangkat lain.',
  robots: { index: false, follow: true },
  ...socialMeta('Riwayat tontonan',
    'Lanjutkan anime yang terakhir kamu tonton. Riwayat tersimpan di akun dan tersedia di perangkat lain.'),
};

export default function HistoryPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader
        title="Riwayat tontonan"
        description="Anime yang terakhir kamu buka, urut dari yang paling baru. Tekan Lanjutkan untuk langsung membuka episodenya."
      />
      <HistoryView />
    </div>
  );
}
