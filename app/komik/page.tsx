import type { Metadata } from 'next';
import Link from 'next/link';
import { Search } from 'lucide-react';
import { getKomikCatalog } from '@/lib/comics';
import { socialMeta } from '@/lib/seo';
import { PageHeader } from '@/components/PageHeader';
import { ComicGrid } from '@/components/comics/ComicGrid';

const TITLE = 'Komik';
const DESCRIPTION =
  'Baca komik, manga, manhwa, dan manhua terjemahan Indonesia. Daftar judul terbaru dari komiku.org, lengkap dengan daftar chapter.';

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: '/komik' },
  ...socialMeta(TITLE, DESCRIPTION),
};

export const revalidate = 600;

interface KomikPageProps {
  searchParams: Promise<{ q?: string | string[] }>;
}

export default async function KomikPage({ searchParams }: KomikPageProps) {
  const params = await searchParams;
  const raw = Array.isArray(params.q) ? params.q[0] : params.q;
  const query = (raw || '').trim().slice(0, 100);
  const feed = await getKomikCatalog(query, 60);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader
        title="Komik"
        description="Katalog komik dari komiku.org. Cari judul, lalu pilih chapter untuk dibaca."
      />

      <form action="/komik" method="GET" className="mb-8 flex max-w-xl gap-2">
        <label htmlFor="komik-search" className="sr-only">
          Cari judul komik
        </label>
        <div className="relative flex-1">
          <Search
            className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
            aria-hidden="true"
          />
          <input
            id="komik-search"
            name="q"
            type="search"
            defaultValue={query}
            placeholder="Cari judul komik"
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
        <ComicGrid items={feed.items} />
      ) : (
        <div className="rounded-[4px] border border-line px-4 py-10 text-center">
          <p className="text-[14px] font-medium text-white">
            {feed.offline
              ? 'Sumber komik sedang tidak bisa dihubungi'
              : query
                ? 'Judul tidak ditemukan'
                : 'Belum ada komik'}
          </p>
          <p className="mx-auto mt-1.5 max-w-[52ch] text-[12.5px] leading-relaxed text-zinc-400">
            {feed.offline
              ? 'komiku.org menolak permintaan dari server Aznime saat ini. Coba lagi beberapa saat lagi.'
              : query
                ? `Tidak ada hasil untuk “${query}”. Coba kata kunci lain atau lihat daftar terbaru.`
                : 'Daftar komik belum bisa dimuat. Coba muat ulang halaman ini.'}
          </p>
          {query ? (
            <Link
              href="/komik"
              className="mt-4 inline-flex h-9 items-center rounded-[4px] border border-white/15 px-4 text-[12.5px] font-semibold text-white transition-colors hover:border-white/40 hover:bg-white/[0.05]"
            >
              Lihat semua komik
            </Link>
          ) : null}
        </div>
      )}
    </div>
  );
}
