import type { Metadata } from 'next';
import { socialMeta } from '@/lib/seo';
import { PageHeader } from '@/components/PageHeader';
import { SettingsView } from '@/components/settings/SettingsView';
import { readPreferences } from '@/lib/preferences-server';

export const metadata: Metadata = {
  title: 'Pengaturan',
  description: 'Atur filter konten dewasa, penyimpanan riwayat tontonan, dan akun Aznime.',
  robots: { index: false, follow: true },
  ...socialMeta('Pengaturan', 'Atur filter konten dewasa, riwayat tontonan, dan akun Aznime.'),
};

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const prefs = await readPreferences();

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader
        title="Pengaturan"
        description="Atur konten yang ingin kamu lihat, cara riwayat disimpan, dan akunmu. Perubahan langsung berlaku."
      />
      <SettingsView initial={prefs} />
    </div>
  );
}
