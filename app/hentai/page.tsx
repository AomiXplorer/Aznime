import Link from 'next/link';
import { Search } from 'lucide-react';
import { EmptyState } from '@/components/EmptyState';
import { NekopoiGrid } from '@/components/NekopoiGrid';
import {
  NEKOPOI_ONLY_GENRE,
  getNekopoiLatestEpisodes,
  getNekopoiSeriesList,
  nekopoiIsHentaiItem,
  nekopoiToCard,
  searchNekopoi,
} from '@/lib/nekopoi';
import type { AnimeCardItem } from '@/lib/scraper/types';
import { cn } from '@/lib/cn';

export const revalidate = 900;

const PAGE_SIZE = 24;

type Tab = 'semua' | 'episode' | 'seri';

const TABS: { key: Tab; label: string }[] = [
  { key: 'semua', label: 'Sorotan' },
  { key: 'episode', label: 'Episode terbaru' },
  { key: 'seri', label: 'Seri hentai' },
];

function normalizeTab(raw: string | undefined): Tab {
  return TABS.some((tab) => tab.key === raw) ? (raw as Tab) : 'semua';
}

function buildHref(params: { tab?: Tab; page?: number; q?: string }): string {
  const search = new URLSearchParams();
  if (params.q) search.set('q', params.q);
  if (params.tab && params.tab !== 'semua') search.set('tab', params.tab);
  if (params.page && params.page > 1) search.set('page', String(params.page));
  const query = search.toString();
  return query ? `/hentai?${query}` : '/hentai';
}

interface PagerProps {
  page: number;
  hasNext: boolean;
  tab: Tab;
  q?: string;
}

function Pager({ page, hasNext, tab, q }: PagerProps) {
  if (page === 1 && !hasNext) return null;
  return (
    <nav
      aria-label="Navigasi halaman"
      className="mt-8 flex items-center justify-between gap-3 border-t border-white/[0.08] pt-4"
    >
      {page > 1 ? (
        <Link
          href={buildHref({ tab, page: page - 1, q })}
          className="inline-flex h-9 items-center rounded-md border border-white/10 px-3 text-[12.5px] font-semibold text-zinc-300 transition-colors duration-150 hover:border-white/25 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
        >
          Sebelumnya
        </Link>
      ) : (
        <span aria-hidden="true" />
      )}
      <span className="text-[11.5px] tabular-nums text-zinc-500">Halaman {page}</span>
      {hasNext ? (
        <Link
          href={buildHref({ tab, page: page + 1, q })}
          className="inline-flex h-9 items-center rounded-md border border-white/10 px-3 text-[12.5px] font-semibold text-zinc-300 transition-colors duration-150 hover:border-white/25 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
        >
          Berikutnya
        </Link>
      ) : (
        <span aria-hidden="true" />
      )}
    </nav>
  );
}

function SectionHeading({ title, meta, href }: { title: string; meta?: string; href?: string }) {
  return (
    <div className="mb-4 flex items-baseline justify-between gap-3 border-b border-white/[0.08] pb-2">
      <h2 className="text-[13px] font-semibold uppercase tracking-[0.1em] text-zinc-200">{title}</h2>
      {href ? (
        <Link
          href={href}
          className="text-[11.5px] font-semibold text-zinc-400 transition-colors hover:text-white"
        >
          Lihat semua
        </Link>
      ) : meta ? (
        <span className="text-[11.5px] tabular-nums text-zinc-500">{meta}</span>
      ) : null}
    </div>
  );
}

async function loadTabItems(
  tab: Tab,
  page: number
): Promise<{ items: AnimeCardItem[]; hasNext: boolean }> {
  if (tab === 'episode') {
    const { items, pagination } = await getNekopoiLatestEpisodes(page);
    return {
      items: items.filter(nekopoiIsHentaiItem).map(nekopoiToCard),
      hasNext: pagination.hasNextPage,
    };
  }

  // Daftar seri dikirim sekaligus oleh sumber, jadi dipotong per halaman di sini.
  const all = (await getNekopoiSeriesList()).filter(nekopoiIsHentaiItem);
  const start = (page - 1) * PAGE_SIZE;
  const slice = all.slice(start, start + PAGE_SIZE);
  return { items: slice.map(nekopoiToCard), hasNext: start + PAGE_SIZE < all.length };
}

interface HentaiPageProps {
  searchParams: Promise<{ q?: string; tab?: string; page?: string }>;
}

export default async function HentaiIndexPage({ searchParams }: HentaiPageProps) {
  const params = await searchParams;
  const q = (params.q || '').trim().slice(0, 100);
  const tab = normalizeTab(params.tab);
  const pageRaw = Number(params.page || '1');
  const page = Number.isFinite(pageRaw) && pageRaw >= 1 ? Math.trunc(pageRaw) : 1;

  let searchResult: { items: AnimeCardItem[]; hasNext: boolean } | null = null;
  let searchError: string | null = null;

  if (q) {
    try {
      const result = await searchNekopoi(q, page);
      searchResult = {
        items: result.items.filter(nekopoiIsHentaiItem).map(nekopoiToCard),
        hasNext: result.pagination.hasNextPage,
      };
    } catch (err) {
      searchError = err instanceof Error ? err.message : 'Gagal mencari judul hentai.';
    }
  }

  return (
    <div className="mx-auto max-w-7xl px-4 pb-16 pt-8 sm:px-6 lg:px-8">
      <header className="mb-6">
        <div className="flex flex-wrap items-center gap-2.5">
          <h1 className="text-[1.7rem] font-extrabold leading-tight text-white sm:text-[2rem]">
            Hentai
          </h1>
          <span className="rounded-sm bg-rose-500/15 px-1.5 py-0.5 text-[10px] font-bold uppercase leading-tight tracking-[0.08em] text-rose-300">
            18+
          </span>
        </div>
        <p className="mt-1.5 max-w-2xl text-[13.5px] leading-relaxed text-muted">
          Koleksi hentai subtitle Indonesia dari Nekopoi: seri lengkap dan episode terbaru. Khusus
          penonton 18 tahun ke atas.
        </p>
      </header>

      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <form action="/hentai" method="get" className="relative w-full sm:max-w-sm">
          <label htmlFor="hentai-search" className="sr-only">
            Cari judul hentai
          </label>
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500"
            aria-hidden="true"
          />
          <input
            id="hentai-search"
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Cari judul hentai"
            className="h-10 w-full rounded-md border border-white/10 bg-white/[0.04] pl-9 pr-3 text-[13px] text-zinc-100 placeholder:text-zinc-500 transition-colors duration-150 focus:border-white/25 focus:bg-white/[0.06] focus:outline-none"
          />
        </form>

        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-zinc-500">
            Genre
          </span>
          <span className="rounded-full bg-white/10 px-3 py-1 text-[11.5px] font-semibold text-zinc-100">
            {NEKOPOI_ONLY_GENRE}
          </span>
        </div>
      </div>

      <p className="mb-6 text-[11.5px] leading-relaxed text-zinc-500">
        Semua judul di bagian ini tergolong {NEKOPOI_ONLY_GENRE}. Genre rinci tiap judul (ahegao,
        anal, bdsm, dan lainnya) baru ditampilkan saat kamu membuka halaman sinopsisnya.
      </p>

      {q ? (
        <section aria-label="Hasil pencarian">
          <SectionHeading title={`Hasil untuk “${q}”`} />
          {searchError ? (
            <EmptyState title="Pencarian gagal" description={searchError} />
          ) : searchResult && searchResult.items.length > 0 ? (
            <>
              <NekopoiGrid items={searchResult.items} priorityCount={7} />
              <Pager page={page} hasNext={searchResult.hasNext} tab={tab} q={q} />
            </>
          ) : (
            <EmptyState
              title="Tidak ada judul yang cocok"
              description="Coba kata kunci lain, misalnya judul Jepang atau nama seri tanpa tambahan episode."
              actionLabel="Kembali ke daftar"
              actionHref="/hentai"
            />
          )}
        </section>
      ) : tab === 'semua' ? (
        <div className="space-y-10">
          <section aria-label="Episode hentai terbaru">
            <SectionHeading title="Episode terbaru" href={buildHref({ tab: 'episode' })} />
            <LatestEpisodesRow />
          </section>

          <section aria-label="Seri hentai">
            <SectionHeading title="Seri hentai" href={buildHref({ tab: 'seri' })} />
            <SeriesRow />
          </section>
        </div>
      ) : (
        <section aria-label={TABS.find((item) => item.key === tab)?.label}>
          <SectionHeading
            title={TABS.find((item) => item.key === tab)?.label || 'Daftar'}
            meta={`Halaman ${page}`}
          />
          <TabGrid tab={tab} page={page} />
        </section>
      )}

      <div className="mt-12 flex flex-wrap gap-2 border-t border-white/[0.08] pt-5">
        {TABS.map((item) => (
          <Link
            key={item.key}
            href={buildHref({ tab: item.key })}
            aria-current={!q && tab === item.key ? 'page' : undefined}
            className={cn(
              'inline-flex h-9 items-center rounded-md px-3 text-[12.5px] font-semibold transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60',
              !q && tab === item.key
                ? 'bg-white text-black'
                : 'border border-white/10 text-zinc-300 hover:border-white/25 hover:text-white'
            )}
          >
            {item.label}
          </Link>
        ))}
      </div>
    </div>
  );
}

/* Blok di bawah dipisah sebagai komponen async agar tiap bagian punya batas
   error sendiri: satu endpoint bermasalah tidak mengosongkan seluruh halaman. */

async function LatestEpisodesRow() {
  try {
    const { items } = await getNekopoiLatestEpisodes(1);
    const cards = items.filter(nekopoiIsHentaiItem).map(nekopoiToCard);
    if (cards.length === 0) {
      return <p className="text-[12.5px] text-zinc-500">Belum ada episode baru dari sumber.</p>;
    }
    return <NekopoiGrid items={cards} priorityCount={7} />;
  } catch (err) {
    return (
      <p className="text-[12.5px] text-zinc-500">
        {err instanceof Error ? err.message : 'Gagal memuat episode terbaru.'}
      </p>
    );
  }
}

async function SeriesRow() {
  try {
    const all = (await getNekopoiSeriesList()).filter(nekopoiIsHentaiItem);
    const items = all.slice(0, PAGE_SIZE).map(nekopoiToCard);
    if (items.length === 0) {
      return <p className="text-[12.5px] text-zinc-500">Daftar seri belum tersedia.</p>;
    }
    return <NekopoiGrid items={items} />;
  } catch (err) {
    return (
      <p className="text-[12.5px] text-zinc-500">
        {err instanceof Error ? err.message : 'Gagal memuat daftar seri.'}
      </p>
    );
  }
}

async function TabGrid({ tab, page }: { tab: Tab; page: number }) {
  try {
    const { items, hasNext } = await loadTabItems(tab, page);
    if (items.length === 0) {
      return (
        <EmptyState
          title="Belum ada isi di halaman ini"
          description="Sumber mungkin sedang memperbarui daftar. Coba halaman sebelumnya."
          actionLabel="Ke halaman pertama"
          actionHref={buildHref({ tab })}
        />
      );
    }
    return (
      <>
        <NekopoiGrid items={items} priorityCount={7} />
        <Pager page={page} hasNext={hasNext} tab={tab} />
      </>
    );
  } catch (err) {
    return (
      <EmptyState
        title="Gagal memuat daftar"
        description={err instanceof Error ? err.message : 'Sumber Nekopoi tidak merespons.'}
        actionLabel="Coba lagi"
        actionHref={buildHref({ tab, page })}
      />
    );
  }
}
