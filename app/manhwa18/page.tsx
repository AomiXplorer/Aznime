import type { Metadata } from 'next';
import Link from 'next/link';
import { Search } from 'lucide-react';
import { getManhwaCatalog } from '@/lib/mangasusuku';
import { socialMeta } from '@/lib/seo';
import { PageHeader } from '@/components/PageHeader';
import { ComicGrid } from '@/components/comics/ComicGrid';

const TITLE = 'Manhwa 18+';
const DESCRIPTION =
  'Koleksi manhwa 18+ terjemahan Indonesia. Khusus pembaca 18 tahun ke atas.';

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: '/manhwa18' },
  robots: { index: false, follow: false, nocache: true },
  ...socialMeta(TITLE, DESCRIPTION),
};

export const revalidate = 600;

interface ManhwaPageProps {
  searchParams: Promise<{ q?: string | string[] }>;
}

export default async function ManhwaPage({ searchParams }: ManhwaPageProps) {
  const params = await searchParams;
  const raw = Array.isArray(params.q) ? params.q[0] : params.q;
  const query = (raw || '').trim().slice(0, 100);
  const feed = await getManhwaCatalog(query, 60);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader
        title="Manhwa 18+"
        description="Katalog manhwa 18+ dari MangaSusuku. Cari judul, lalu pilih chapter untuk dibaca. Semua isi di halaman ini untuk pembaca 18 tahun ke atas."
      />

      <form action="/manhwa18" method="GET" className="mb-8 flex max-w-xl gap-2">
        <label htmlFor="manhwa-search" className="sr-only">
          Cari judul manhwa 18+
        </label>
        <div className="relative flex-1">
          <Search
            className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
            aria-hidden="true"
          />
          <input
            id="manhwa-search"
            name="q"
            type="search"
            defaultValue={query}
            placeholder="Cari judul manhwa 18+"
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
              ? 'Sumber manhwa 18+ sedang tidak bisa dihubungi'
              : query
                ? 'Judul tidak ditemukan'
                : 'Belum ada judul'}
          </p>
          <p className="mx-auto mt-1.5 max-w-[52ch] text-[12.5px] leading-relaxed text-zinc-400">
            {feed.offline
              ? 'MangaSusuku menolak permintaan dari server Aznime saat ini. Coba lagi beberapa saat lagi.'
              : query
                ? `Tidak ada hasil untuk “${query}”. Coba kata kunci lain atau lihat daftar terbaru.`
                : 'Daftar judul belum bisa dimuat. Coba muat ulang halaman ini.'}
          </p>
          {query ? (
            <Link
              href="/manhwa18"
              className="mt-4 inline-flex h-9 items-center rounded-[4px] border border-white/15 px-4 text-[12.5px] font-semibold text-white transition-colors hover:border-white/40 hover:bg-white/[0.05]"
            >
              Lihat semua judul
            </Link>
          ) : null}
        </div>
      )}
    </div>
  );
}
