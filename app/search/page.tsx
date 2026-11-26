import type { Metadata } from 'next';
import { Suspense } from 'react';
import { FilmCatalog } from '@/components/FilmCatalog';
import { Search } from 'lucide-react';
import { searchAcrossSources } from '@/lib/sources';
import { InfiniteAnimeCatalog } from '@/components/InfiniteAnimeCatalog';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { PageHeader } from '@/components/PageHeader';

export const dynamic = 'force-dynamic';

interface SearchPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function getQueryString(val: string | string[] | undefined): string {
  if (Array.isArray(val)) return (val[0] || '').trim();
  return (val || '').trim();
}

export async function generateMetadata({ searchParams }: SearchPageProps): Promise<Metadata> {
  const sp = await searchParams;
  const q = getQueryString(sp.q);
  return {
    title: q ? `Hasil pencarian: ${q}` : 'Cari anime dan film',
    description: q
      ? `Hasil pencarian anime subtitle Indonesia untuk "${q}" di Aznime.`
      : 'Cari anime subtitle Indonesia berdasarkan judul di Aznime.',
    // Halaman hasil pencarian tidak diindeks: kontennya dinamis, bertumpuk
    // dengan katalog, dan bisa menghasilkan URL tak terbatas.
    robots: { index: false, follow: true },
    alternates: { canonical: '/search' },
  };
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const sp = await searchParams;
  const q = getQueryString(sp.q);

  let data = null;
  let errorMsg: string | null = null;

  if (q) {
    try {
      data = await searchAcrossSources(q, 1);
    } catch (err) {
      errorMsg = err instanceof Error ? err.message : 'Gagal mencari anime';
    }
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader title="Cari anime dan film" />

      <form action="/search" method="GET" className="mb-8 flex max-w-xl gap-2">
        <label htmlFor="page-search-input" className="sr-only">
          Kata kunci judul anime atau film
        </label>
        <div className="relative flex-1">
          <Search
            className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
            aria-hidden="true"
          />
          <input
            id="page-search-input"
            name="q"
            type="search"
            defaultValue={q}
            placeholder="Masukkan judul anime atau film"
            required
            className="h-11 w-full rounded-[4px] border border-white/10 bg-white/[0.03] pl-10 pr-4 text-[13.5px] text-white placeholder:text-zinc-500 transition-colors focus:border-white/30 focus:bg-white/[0.05] focus:outline-none"
          />
        </div>
        <button
          type="submit"
          className="h-11 cursor-pointer rounded-[4px] bg-white px-6 text-[13px] font-semibold text-black transition-colors hover:bg-white/85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
        >
          Cari
        </button>
      </form>

      {q && <Suspense fallback={<p>Mencari film…</p>}><FilmCatalog query={q.slice(0, 100)} /></Suspense>}
      {!q ? (
        <EmptyState
          title="Masukkan judul anime atau film"
          description="Ketik judul pada kolom di atas, atau tekan Ctrl+K dari halaman mana pun."
          actionLabel="Lihat katalog populer"
          actionHref="/anime?order=popular"
        />
      ) : errorMsg ? (
        <ErrorState title="Pencarian gagal" message={errorMsg} />
      ) : data ? (
        <div className="space-y-5">
          <p className="text-sm text-muted">
            Hasil untuk <span className="font-semibold text-white">&ldquo;{q}&rdquo;</span>
          </p>
          <InfiniteAnimeCatalog
            initialItems={data.results}
            initialPagination={data.pagination}
            apiPath="/api/search"
            queryParams={{ mode: 'full', q }}
            emptyTitle={`Tidak ada anime untuk "${q}"`}
            emptyDescription="Periksa ejaan judul atau coba kata kunci yang lebih singkat."
          />
        </div>
      ) : null}
    </div>
  );
}
