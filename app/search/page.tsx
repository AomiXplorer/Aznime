import type { Metadata } from 'next';
import Link from 'next/link';
import { Search } from 'lucide-react';
import { searchAcrossSources } from '@/lib/sources';
import { InfiniteAnimeCatalog } from '@/components/InfiniteAnimeCatalog';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { PageHeader } from '@/components/PageHeader';
import { ComicGrid } from '@/components/comics/ComicGrid';
import { searchComics } from '@/lib/comics';
import { socialMeta } from '@/lib/seo';

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
  const title = q ? `Hasil pencarian: ${q}` : 'Cari anime';
  const description = q
    ? `Hasil pencarian anime subtitle Indonesia untuk "${q}" di Aznime.`
    : 'Cari anime subtitle Indonesia berdasarkan judul di Aznime.';
  return {
    title,
    description,
    ...socialMeta(title, description),
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

  /* Satu kotak pencarian untuk semua jenis karya: anime, komik, dan webtoon
     dicari bersamaan lalu ditampilkan sebagai bagian terpisah. */
  const [comicHits] = await Promise.all([
    q ? searchComics(q, 12).catch(() => ({ komik: [], webtoon: [] })) : Promise.resolve({ komik: [], webtoon: [] }),
  ]);

  if (q) {
    try {
      data = await searchAcrossSources(q, 1);
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
        <div className="space-y-9">
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

          {comicHits.komik.length > 0 ? (
            <section aria-label="Hasil komik" className="space-y-4">
              <div className="flex items-end justify-between gap-4 border-b border-[#2b2222] pb-2">
                <h2 className="font-display text-[17px] font-semibold tracking-[-0.02em] text-white">
                  Komik
                </h2>
                <Link
                  href={`/komik?q=${encodeURIComponent(q)}`}
                  className="text-[12px] font-medium text-zinc-400 transition-colors hover:text-white"
                >
                  Semua komik
                </Link>
              </div>
              <ComicGrid items={comicHits.komik} showSource />
            </section>
          ) : null}

          {comicHits.webtoon.length > 0 ? (
            <section aria-label="Hasil webtoon" className="space-y-4">
              <div className="flex items-end justify-between gap-4 border-b border-[#2b2222] pb-2">
                <h2 className="font-display text-[17px] font-semibold tracking-[-0.02em] text-white">
                  Webtoon
                </h2>
                <Link
                  href={`/webtoon?q=${encodeURIComponent(q)}`}
                  className="text-[12px] font-medium text-zinc-400 transition-colors hover:text-white"
                >
                  Semua webtoon
                </Link>
              </div>
              <ComicGrid items={comicHits.webtoon} aspect="3/4" showSource />
            </section>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
