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
  alternates: { canonical: '/anime' },
};

export const dynamic = 'force-dynamic';

interface AnimeCatalogPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function getParam(val: string | string[] | undefined): string {
  if (Array.isArray(val)) return val[0] || '';
  return val || '';
}

/** Genre boleh lebih dari satu; duplikat dan nilai kosong dibuang. */
function getGenres(val: string | string[] | undefined): string[] {
  const raw = Array.isArray(val) ? val : val ? [val] : [];
  return Array.from(new Set(raw.map((item) => item.trim()).filter(Boolean)));
}

export default async function AnimeCatalogPage({ searchParams }: AnimeCatalogPageProps) {
  const sp = await searchParams;
  const status = getParam(sp.status);
  const type = getParam(sp.type);
  const order = getParam(sp.order) || 'update';
  const genres = getGenres(sp.genre);

  const [listRes, filterRes] = await Promise.allSettled([
    getAnimeList({
      page: 1,
      status: status || undefined,
      type: type || undefined,
      order: order || undefined,
      genre: genres.length ? genres : undefined,
    }),
    getFilterOptions(),
  ]);

  const data = listRes.status === 'fulfilled' ? listRes.value : null;
  const options = filterRes.status === 'fulfilled' ? filterRes.value : {};

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader
        title="Katalog"
        description="Pilih status, tipe, genre, atau urutan. Bisa pilih beberapa genre sekaligus."
      />

      <div className="mb-7">
        <CatalogFilters
          options={options}
          current={{ status, type, order, genres }}
          basePath="/anime"
        />
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
            genre: genres.length ? genres : undefined,
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
