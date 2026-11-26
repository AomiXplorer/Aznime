import type { Metadata } from 'next';
import Link from 'next/link';
import { Search } from 'lucide-react';
import { getWebtoonCatalog } from '@/lib/comics';
import { socialMeta } from '@/lib/seo';
import { PageHeader } from '@/components/PageHeader';
import { ComicGrid } from '@/components/comics/ComicGrid';

const TITLE = 'Webtoon';
const DESCRIPTION =
  'Baca webtoon bahasa Indonesia dari WEBTOON. Daftar judul populer dan terbaru, langsung dari sumber resminya.';

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: '/webtoon' },
  ...socialMeta(TITLE, DESCRIPTION),
};

export const revalidate = 600;

interface WebtoonPageProps {
  searchParams: Promise<{ q?: string | string[] }>;
}

export default async function WebtoonPage({ searchParams }: WebtoonPageProps) {
  const params = await searchParams;
  const raw = Array.isArray(params.q) ? params.q[0] : params.q;
  const query = (raw || '').trim().slice(0, 100);
  const feed = await getWebtoonCatalog(query, 60);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader
        title="Webtoon"
        description="Katalog webtoon berbahasa Indonesia dari WEBTOON. Pilih judul, lalu pilih episode untuk dibaca."
      />

      <form action="/webtoon" method="GET" className="mb-8 flex max-w-xl gap-2">
        <label htmlFor="webtoon-search" className="sr-only">
          Cari judul webtoon
        </label>
        <div className="relative flex-1">
          <Search
            className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
            aria-hidden="true"
          />
          <input
            id="webtoon-search"
            name="q"
            type="search"
            defaultValue={query}
            placeholder="Cari judul webtoon"
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

      {feed.items.length > 0 ? (
        <ComicGrid items={feed.items} aspect="3/4" />
      ) : (
        <div className="rounded-[4px] border border-line px-4 py-10 text-center">
          <p className="text-[14px] font-medium text-white">
            {feed.offline ? 'Sumber webtoon sedang tidak bisa dihubungi' : 'Tidak ada webtoon yang cocok'}
          </p>
          <p className="mx-auto mt-1.5 max-w-[52ch] text-[12.5px] leading-relaxed text-zinc-400">
            {feed.offline
              ? 'WEBTOON menolak permintaan dari server Aznime saat ini. Coba lagi beberapa saat lagi.'
              : `Tidak ada hasil untuk “${query}”. Coba kata kunci lain atau lihat daftar populer.`}
          </p>
          {query ? (
            <Link
              href="/webtoon"
              className="mt-4 inline-flex h-9 items-center rounded-[4px] border border-white/15 px-4 text-[12.5px] font-semibold text-white transition-colors hover:border-white/40 hover:bg-white/[0.05]"
            >
              Lihat semua webtoon
            </Link>
          ) : null}
        </div>
      )}
    </div>
  );
}
