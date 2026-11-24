import type { Metadata } from 'next';
import { PageHeader } from '@/components/PageHeader';
import { ProfileView } from '@/components/profile/ProfileView';

export const metadata: Metadata = {
  title: 'Profil',
  description: 'Akun Aznime: ringkasan riwayat tontonan, favorit, dan status sesi.',
  robots: { index: false, follow: true },
};

export default function ProfilePage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader title="Profil" description="Ringkasan akun, riwayat, dan daftar favoritmu di Aznime." />
      <ProfileView />
    </div>
  );
}
