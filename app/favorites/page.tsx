import type { Metadata } from 'next';
import { PageHeader } from '@/components/PageHeader';
import { FavoritesView } from '@/components/favorites/FavoritesView';

export const metadata: Metadata = {
  title: 'Favorit',
  description: 'Daftar anime favorit yang kamu simpan di akun Aznime.',
  robots: { index: false, follow: true },
};

export default function FavoritesPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader
        title="Favorit"
        description="Koleksi anime yang kamu tandai. Tersimpan di akun, jadi tetap ada saat kamu ganti perangkat."
      />
      <FavoritesView />
    </div>
  );
}
