import type { Metadata } from 'next';
import { getAnimeList, getFilterOptions } from '@/lib/scraper';
import { CatalogFilters } from '@/components/CatalogFilters';
import { InfiniteAnimeCatalog } from '@/components/InfiniteAnimeCatalog';
import { ErrorState } from '@/components/ErrorState';
import { PageHeader } from '@/components/PageHeader';

export const metadata: Metadata = {
  title: 'Katalog Anime',
  description:
    'Jelajahi katalog lengkap anime subtitle Indonesia berdasarkan genre, status, tipe, dan urutan terbaru dengan infinite scrolling.',
};

export const dynamic = 'force-dynamic';

interface AnimeCatalogPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function getParam(val: string | string[] | undefined): string {
  if (Array.isArray(val)) return val[0] || '';
  return val || '';
}

export default async function AnimeCatalogPage({ searchParams }: AnimeCatalogPageProps) {
  const sp = await searchParams;
  const status = getParam(sp.status);
  const type = getParam(sp.type);
  const order = getParam(sp.order) || 'update';
  const genre = getParam(sp.genre);

  const [listRes, filterRes] = await Promise.allSettled([
    getAnimeList({
      page: 1,
      status: status || undefined,
      type: type || undefined,
      order: order || undefined,
      genre: genre || undefined,
    }),
    getFilterOptions(),
  ]);

  const data = listRes.status === 'fulfilled' ? listRes.value : null;
  const options = filterRes.status === 'fulfilled' ? filterRes.value : {};

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader title="Katalog" description="Saring berdasarkan status, format, genre, atau popularitas." />

      <div className="mb-7">
        <CatalogFilters options={options} current={{ status, type, order, genre }} basePath="/anime" />
      </div>

      {data ? (
        <InfiniteAnimeCatalog
          initialItems={data.results}
          initialPagination={data.pagination}
          apiPath="/api/anime"
          queryParams={{
            status: status || undefined,
            type: type || undefined,
            order: order || undefined,
            genre: genre || undefined,
          }}
        />
      ) : (
        <ErrorState
          title="Gagal memuat katalog anime"
          message={
            listRes.status === 'rejected' && listRes.reason instanceof Error
              ? listRes.reason.message
              : 'Tidak dapat mengambil daftar anime saat ini.'
          }
        />
      )}
    </div>
  );
}
