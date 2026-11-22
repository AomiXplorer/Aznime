import type { Metadata } from 'next';
import Link from 'next/link';
import { CalendarDays } from 'lucide-react';
import { getOngoing } from '@/lib/scraper';
import { InfiniteAnimeCatalog } from '@/components/InfiniteAnimeCatalog';
import { ErrorState } from '@/components/ErrorState';
import { PageHeader } from '@/components/PageHeader';

export const metadata: Metadata = {
  title: 'Anime Ongoing',
  description: 'Daftar anime ongoing subtitle Indonesia yang masih tayang dan diperbarui setiap minggu.',
  alternates: { canonical: '/ongoing' },
};

export const revalidate = 180;

export default async function OngoingPage() {
  let data = null;
  let errorMsg: string | null = null;

  try {
    data = await getOngoing(1);
  } catch (err) {
    errorMsg = err instanceof Error ? err.message : 'Gagal memuat daftar ongoing';
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader title="Sedang tayang" description="Diurutkan dari episode yang paling baru rilis.">
        <Link
          href="/schedule"
          className="inline-flex h-9 items-center gap-2 rounded-lg border border-line bg-surface px-4 text-[13px] font-semibold text-ink transition-colors duration-150 hover:border-line-accent hover:bg-elevated active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ink"
        >
          <CalendarDays className="h-4 w-4 text-accent-ink" aria-hidden="true" />
          Jadwal tayang
        </Link>
      </PageHeader>

      {data ? (
        <InfiniteAnimeCatalog
          initialItems={data.results}
          initialPagination={data.pagination}
          apiPath="/api/anime"
          queryParams={{ status: 'ongoing', order: 'update' }}
        />
      ) : (
        <ErrorState title="Gagal memuat anime ongoing" message={errorMsg || 'Terjadi kesalahan.'} />
      )}
    </div>
  );
}
