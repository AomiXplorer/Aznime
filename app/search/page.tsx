import type { Metadata } from 'next';
import { Search } from 'lucide-react';
import { search } from '@/lib/scraper';
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
    title: q ? `Hasil pencarian: ${q}` : 'Cari anime',
    description: q
      ? `Hasil pencarian anime subtitle Indonesia untuk "${q}" di Aznime.`
      : 'Cari anime subtitle Indonesia berdasarkan judul di Aznime.',
  };
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const sp = await searchParams;
  const q = getQueryString(sp.q);

  let data = null;
  let errorMsg: string | null = null;

  if (q) {
    try {
      data = await search(q, 1);
    } catch (err) {
      errorMsg = err instanceof Error ? err.message : 'Gagal mencari anime';
    }
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader title="Cari anime" />

      <form action="/search" method="GET" className="mb-8 flex max-w-xl gap-2">
        <label htmlFor="page-search-input" className="sr-only">
          Kata kunci judul anime
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
            placeholder="Masukkan judul anime"
            required
            className="h-11 w-full rounded-full bg-white/[0.08] pl-10 pr-4 text-sm text-white placeholder:text-zinc-500 transition-colors focus:bg-white/[0.12] focus:outline-none focus:ring-2 focus:ring-white/40"
          />
        </div>
        <button
          type="submit"
          className="h-11 cursor-pointer rounded-full bg-accent-strong px-6 text-sm font-bold text-white transition-all hover:bg-accent active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
        >
          Cari
        </button>
      </form>

      {!q ? (
        <EmptyState
          title="Masukkan judul anime"
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
