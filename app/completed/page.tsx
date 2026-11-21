import type { Metadata } from 'next';
import { getCompleted } from '@/lib/scraper';
import { InfiniteAnimeCatalog } from '@/components/InfiniteAnimeCatalog';
import { ErrorState } from '@/components/ErrorState';
import { PageHeader } from '@/components/PageHeader';

export const metadata: Metadata = {
  title: 'Anime Completed',
  description: 'Koleksi anime completed subtitle Indonesia yang sudah tamat seluruh episodenya.',
};

export const revalidate = 300;

export default async function CompletedPage() {
  let data = null;
  let errorMsg: string | null = null;

  try {
    data = await getCompleted(1);
  } catch (err) {
    errorMsg = err instanceof Error ? err.message : 'Gagal memuat daftar completed';
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader title="Sudah tamat" description="Semua episode sudah rilis, siap ditonton marathon." />

      {data ? (
        <InfiniteAnimeCatalog
          initialItems={data.results}
          initialPagination={data.pagination}
          apiPath="/api/anime"
          queryParams={{ status: 'completed', order: 'update' }}
        />
      ) : (
        <ErrorState title="Gagal memuat anime completed" message={errorMsg || 'Terjadi kesalahan.'} />
      )}
    </div>
  );
}
