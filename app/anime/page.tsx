import type { Metadata } from 'next';
import { socialMeta } from '@/lib/seo';
import { Suspense } from 'react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Archive } from 'lucide-react';
import { getAnimeList, getFilterOptions } from '@/lib/scraper';
import type { FilterOptionsMap, PaginationInfo } from '@/lib/scraper/types';
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
import { AnimeGridSkeleton } from '@/components/Skeleton';

export const metadata: Metadata = {
  title: 'Katalog Anime',
  description:
    'Jelajahi katalog lengkap anime subtitle Indonesia berdasarkan genre, status, tipe, dan urutan terbaru, termasuk arsip judul lama, dengan infinite scrolling.',
  alternates: { canonical: '/anime' },
  ...socialMeta('Katalog Anime',
    'Jelajahi katalog lengkap anime subtitle Indonesia berdasarkan genre, status, tipe, dan urutan terbaru, termasuk arsip judul lama, dengan infinite scrolling.'),
};

export const dynamic = 'force-dynamic';

const ARCHIVE_PAGE_SIZE = 24;

/**
 * Bagian hentai sengaja disembunyikan: tidak ada tautan di navbar, beranda,
 * footer, maupun sitemap. Jalan masuknya hanya panel "Pilih tipe" di filter
 * katalog, yang langsung mengarah ke /hentai.
 */
const HENTAI_VALUE = 'hentai';

const isHentaiValue = (value: string) => value.trim().toLowerCase() === HENTAI_VALUE;

/** Genre Hentai bawaan sumber dibuang supaya jalan masuknya tetap satu. */
function withoutHentaiGenre(options: FilterOptionsMap): FilterOptionsMap {
  const genre = options.genre || [];
  const filtered = genre.filter((item) => !isHentaiValue(item.value));
  return filtered.length === genre.length ? options : { ...options, genre: filtered };
}

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

  // Memilih tipe Hentai membuka bagian khusus 18+ (dengan gerbang usianya).
  if (isHentaiValue(type) || genres.some(isHentaiValue)) {
    redirect('/hentai');
  }

  /* Filter diambil lebih dulu karena barisnya bagian dari kerangka halaman;
     daftar anime yang lambat dipindah ke Suspense di bawah supaya judul dan
     filter sudah terlihat saat daftar masih diambil. */
  const filterRes = await getFilterOptions()
    .then((value) => ({ ok: true as const, value }))
    .catch(() => ({ ok: false as const, value: {} as FilterOptionsMap }));

  const options = withoutHentaiGenre(filterRes.value);

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
          className="inline-flex h-9 items-center gap-2 rounded-[4px] border border-white/15 px-4 text-[12.5px] font-semibold text-white transition-colors hover:border-white/40 hover:bg-white/[0.05] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
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

      <Suspense fallback={<AnimeGridSkeleton count={18} />}>
        <CatalogResults
          archiveMode={archiveMode}
          status={status}
          type={type}
          order={order}
          genres={genres}
        />
      </Suspense>
    </div>
  );
}

interface CatalogResultsProps {
  archiveMode: boolean;
  status: string;
  type: string;
  order: string;
  genres: string[];
}

/** Daftar katalog; sengaja dipisah agar bisa dialirkan setelah kerangka tampil. */
async function CatalogResults({ archiveMode, status, type, order, genres }: CatalogResultsProps) {
  const [listRes, poolRes] = await Promise.allSettled([
    archiveMode
      ? Promise.resolve(null)
      : getAnimeList({
          page: 1,
          status: status || undefined,
          type: type || undefined,
          order: order || undefined,
          genre: genres.length ? genres : undefined,
        }),
    archiveMode ? getMalzArchivePool() : Promise.resolve([]),
  ]);

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

  if (archiveMode) {
    return (
      <InfiniteAnimeCatalog
        initialItems={archiveItems}
        initialPagination={archivePagination(pool.length)}
        apiPath="/api/anime"
        queryParams={{ order: 'archive' }}
        emptyTitle="Arsip belum tersedia"
        emptyDescription="Arsip sumber kedua sedang tidak bisa dihubungi. Coba lagi beberapa saat lagi."
      />
    );
  }

  if (data) {
    return (
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
    );
  }

  return (
    <ErrorState
      title="Gagal memuat katalog anime"
      message={
        listRes.status === 'rejected' && listRes.reason instanceof Error
          ? listRes.reason.message
          : 'Tidak dapat mengambil daftar anime saat ini.'
      }
    />
  );
}
