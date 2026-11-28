import type { Metadata } from 'next';
import { Search } from 'lucide-react';
import { searchFilmSafe } from '@/lib/film';
import { socialMeta } from '@/lib/seo';
import { PageHeader } from '@/components/PageHeader';
import { FilmGrid } from '@/components/film/FilmGrid';

const TITLE = 'Film';
const DESCRIPTION =
  'Nonton film dan bioskop terbaru subtitle Indonesia. Katalog film dari Juraganfilm, lengkap dengan pemutar dan tautan unduhan.';

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: '/film' },
  ...socialMeta(TITLE, DESCRIPTION),
};

export const revalidate = 900;

interface FilmPageProps {
  searchParams: Promise<{ q?: string | string[] }>;
}

export default async function FilmPage({ searchParams }: FilmPageProps) {
  const params = await searchParams;
  const raw = Array.isArray(params.q) ? params.q[0] : params.q;
  const query = (raw || '').trim().slice(0, 100);
  const feed = await searchFilmSafe(query, 60);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader
        title="Film"
        description="Katalog film dari Juraganfilm. Cari judul, lalu pilih pemutar yang tersedia."
      />

      <form action="/film" method="GET" className="mb-8 flex max-w-xl gap-2">
        <label htmlFor="film-search" className="sr-only">
          Cari film
        </label>
        <input
          id="film-search"
          name="q"
          defaultValue={query}
          placeholder="Cari film, mis. doraemon"
          className="h-10 min-w-0 flex-1 rounded-md border border-[#2b2222] bg-[#131010] px-3 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-white/25 focus:outline-none"
        />
        <button
          type="submit"
          className="inline-flex h-10 cursor-pointer items-center gap-1.5 rounded-md bg-[#be123c] px-4 text-sm font-medium text-white transition-colors duration-150 hover:bg-[#9f1239]"
        >
          <Search className="h-4 w-4" aria-hidden="true" />
          Cari
        </button>
      </form>

      {feed.items.length > 0 ? (
        <FilmGrid items={feed.items} />
      ) : (
        <div className="rounded-lg border border-[#2b2222] bg-[#131010] px-6 py-14 text-center">
          <h2 className="font-display text-lg font-semibold text-zinc-100">
            {feed.offline ? 'Sumber film sedang tidak tersedia' : 'Tidak ada film yang cocok'}
          </h2>
          <p className="mx-auto mt-1.5 max-w-md text-sm text-zinc-400">
            {feed.offline
              ? 'Server sumber film sedang tidak bisa dihubungi. Coba muat ulang beberapa saat lagi.'
              : 'Coba kata kunci lain, misalnya judul asli filmnya.'}
          </p>
        </div>
      )}
    </div>
  );
}
