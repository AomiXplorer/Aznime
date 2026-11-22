import type { Metadata } from 'next';
import Link from 'next/link';
import { Archive } from 'lucide-react';
import { getAnimeList, getFilterOptions } from '@/lib/scraper';
import type { PaginationInfo } from '@/lib/scraper/types';
import {
  MALZ_PAGE_BASE,
  getMalzArchivePool,
  supplementWithArchive,
  toVirtualMalzPage,
} from '@/lib/sources';
import { CatalogFilters } from '@/components/CatalogFilters';
import { InfiniteAnimeCatalog } from '@/components/InfiniteAnimeCatalog';
import { ErrorState } from '@/components/ErrorState';
import { PageHeader } from '@/components/PageHeader';

export const metadata: Metadata = {
  title: 'Katalog Anime',
  description:
    'Jelajahi katalog lengkap anime subtitle Indonesia berdasarkan genre, status, tipe, dan urutan terbaru, termasuk arsip judul lama, dengan infinite scrolling.',
  alternates: { canonical: '/anime' },
};

export const dynamic = 'force-dynamic';

const ARCHIVE_PAGE_SIZE = 24;

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

function archivePagination(poolLength: number): PaginationInfo {
  const currentPage = toVirtualMalzPage(1);
  const hasNextPage = ARCHIVE_PAGE_SIZE < poolLength;
  return {
    currentPage,
    totalPages: Math.ceil(poolLength / ARCHIVE_PAGE_SIZE),
    hasNextPage,
    hasPrevPage: false,
    nextPage: hasNextPage ? toVirtualMalzPage(2) : null,
    prevPage: null,
  };
}

export default async function AnimeCatalogPage({ searchParams }: AnimeCatalogPageProps) {
  const sp = await searchParams;
  const status = getParam(sp.status);
  const type = getParam(sp.type);
  const order = getParam(sp.order) || 'update';
  const genres = getGenres(sp.genre);
  const archiveMode = order === 'archive';

  const [listRes, filterRes, poolRes] = await Promise.allSettled([
    archiveMode
      ? Promise.resolve(null)
      : getAnimeList({
          page: 1,
          status: status || undefined,
          type: type || undefined,
          order: order || undefined,
          genre: genres.length ? genres : undefined,
        }),
    getFilterOptions(),
    archiveMode ? getMalzArchivePool() : Promise.resolve([]),
  ]);

  const options = filterRes.status === 'fulfilled' ? filterRes.value : {};
  const pool = poolRes.status === 'fulfilled' ? poolRes.value : [];
  const archiveItems = pool.slice(0, ARCHIVE_PAGE_SIZE);

  const data =
    !archiveMode && listRes.status === 'fulfilled' && listRes.value
      ? {
          ...listRes.value,
          results: await supplementWithArchive(listRes.value.results, {
            status: status || undefined,
            type: type || undefined,
            genres,
          }),
        }
      : null;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader
        title={archiveMode ? 'Arsip anime' : 'Katalog'}
        description={
          archiveMode
            ? 'Judul dari arsip sumber kedua yang belum ada di katalog utama. Lengkap dengan pemutar dan trailer.'
            : 'Pilih status, tipe, genre, atau urutan. Bisa pilih beberapa genre sekaligus.'
        }
      >
        <Link
          href={archiveMode ? '/anime' : '/anime?order=archive'}
          className="inline-flex h-9 items-center gap-2 rounded-full bg-white/10 px-4 text-[13px] font-semibold text-white transition-colors hover:bg-white/20 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
        >
          <Archive className="h-4 w-4" aria-hidden="true" />
          {archiveMode ? 'Katalog utama' : 'Arsip anime'}
        </Link>
      </PageHeader>

      <div className="mb-7">
        <CatalogFilters
          options={options}
          current={{ status, type, order, genres }}
          basePath="/anime"
        />
      </div>

      {archiveMode ? (
        <InfiniteAnimeCatalog
          initialItems={archiveItems}
          initialPagination={archivePagination(pool.length)}
          apiPath="/api/anime"
          queryParams={{ order: 'archive' }}
          emptyTitle="Arsip belum tersedia"
          emptyDescription="Arsip sumber kedua sedang tidak bisa dihubungi. Coba lagi beberapa saat lagi."
        />
      ) : data ? (
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
