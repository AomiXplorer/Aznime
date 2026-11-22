import type { Metadata } from 'next';
import { getMaintenanceState } from '@/lib/maintenance';
import { MaintenanceView } from '@/components/MaintenanceView';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Pemeliharaan Sistem',
  description: 'Aznime sedang melakukan pemeliharaan dan pembaruan server sementara.',
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: { index: false, follow: false },
  },
};

interface MaintenancePageProps {
  searchParams: Promise<{ bypass?: string }>;
}

export default async function MaintenancePage({ searchParams }: MaintenancePageProps) {
  const [state, params] = await Promise.all([
    getMaintenanceState({ bypassCache: true }),
    searchParams,
  ]);

  return (
    <MaintenanceView
      initialState={{
        enabled: state.enabled,
        message: state.message,
        startedAt: state.startedAt,
        endsAt: state.endsAt,
      }}
      bypassInvalid={params.bypass === 'invalid'}
    />
  );
}
