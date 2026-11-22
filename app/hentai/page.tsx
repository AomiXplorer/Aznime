import Link from 'next/link';
import { EmptyState } from '@/components/EmptyState';
import { HentaiSearch } from '@/components/HentaiSearch';
import { NekopoiGrid } from '@/components/NekopoiGrid';
import {
  getNekopoiLatestEpisodes,
  getNekopoiSeriesList,
  nekopoiIsHentaiItem,
  nekopoiToCard,
  searchNekopoiCatalog,
} from '@/lib/nekopoi';
import type { AnimeCardItem } from '@/lib/scraper/types';
import { cn } from '@/lib/cn';

export const revalidate = 900;

const PAGE_SIZE = 24;

type Tab = 'episode' | 'seri';

const TABS: { key: Tab; label: string }[] = [
  { key: 'episode', label: 'Terbaru' },
  { key: 'seri', label: 'Seri' },
];

/** `semua` adalah nilai tab lama yang masih mungkin tersimpan di tautan. */
function normalizeTab(raw: string | undefined): Tab {
  return raw === 'seri' ? 'seri' : 'episode';
}

function buildHref(params: { tab?: Tab; page?: number; q?: string }): string {
  const search = new URLSearchParams();
  if (params.q) search.set('q', params.q);
  if (params.tab && params.tab !== 'episode') search.set('tab', params.tab);
  if (params.page && params.page > 1) search.set('page', String(params.page));
  const query = search.toString();
  return query ? `/hentai?${query}` : '/hentai';
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

  return (
    <div className="mx-auto max-w-7xl px-4 pb-20 pt-7 sm:px-6 lg:px-8">
      <header className="border-b border-white/[0.07] pb-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between sm:gap-8">
          <div>
            <p className="flex items-center gap-2 text-[10.5px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
              <span className="rounded-[3px] bg-rose-600 px-1.5 py-[3px] text-[10px] font-bold leading-none tracking-[0.04em] text-white">
                18+
              </span>
              Nekopoi · Sub Indo
            </p>
            <h1 className="mt-2 font-display text-[2.4rem] font-black leading-[0.88] tracking-[-0.045em] text-white sm:text-[3.1rem]">
              Hentai
            </h1>
          </div>
          <p className="max-w-[20rem] text-[12.5px] leading-relaxed text-zinc-500 sm:pb-1 sm:text-right">
            Seri dan episode terbaru, diperbarui mengikuti sumber.
          </p>
        </div>

        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <HentaiSearch initialQuery={q} />
          <nav
            aria-label="Pilih daftar"
            className="flex items-center gap-0.5 self-start rounded-[6px] border border-white/10 bg-white/[0.02] p-1"
          >
            {TABS.map((item) => {
              const active = !q && tab === item.key;
              return (
                <Link
                  key={item.key}
                  href={buildHref({ tab: item.key })}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'inline-flex h-8 items-center rounded-[4px] px-3.5 text-[12.5px] font-semibold transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60',
                    active
                      ? 'bg-white text-black'
                      : 'text-zinc-400 hover:bg-white/[0.06] hover:text-white'
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </header>

      <div className="mt-6">
        {q ? (
          <SearchResults query={q} page={page} tab={tab} />
        ) : tab === 'seri' ? (
          <SeriesList page={page} />
        ) : (
          <LatestList page={page} />
        )}
      </div>

      <p className="mt-12 border-t border-white/[0.07] pt-4 text-[11px] leading-relaxed text-zinc-600">
        Sumber data Nekopoi. Bagian ini tidak muncul di katalog, pencarian utama, maupun sitemap
        Aznime.
      </p>
    </div>
  );
}

/* Bagian isi dipisah per komponen async supaya satu endpoint yang bermasalah
   tidak mengosongkan seluruh halaman. */

async function SearchResults({ query, page, tab }: { query: string; page: number; tab: Tab }) {
  let items: AnimeCardItem[] = [];
  let hasNext = false;
  let error: string | null = null;

  try {
    const result = await searchNekopoiCatalog(query, page);
    items = result.items.filter(nekopoiIsHentaiItem).map(nekopoiToCard);
    hasNext = result.pagination.hasNextPage;
  } catch (err) {
    error = err instanceof Error ? err.message : 'Gagal mencari judul hentai.';
  }

  return (
    <section aria-label="Hasil pencarian">
      <div className="mb-4 flex items-baseline justify-between gap-3">
        <h2 className="font-display text-[15px] font-bold text-white">
          Hasil “{query}”
          {items.length > 0 ? (
            <span className="ml-2 text-[12px] font-medium tabular-nums text-zinc-500">
              {items.length} judul
            </span>
          ) : null}
        </h2>
        <Link
          href={buildHref({ tab })}
          className="text-[12px] font-semibold text-zinc-400 transition-colors hover:text-white"
        >
          Hapus
        </Link>
      </div>

      {error ? (
        <EmptyState title="Pencarian gagal" description={error} />
      ) : items.length > 0 ? (
        <>
          <NekopoiGrid items={items} priorityCount={6} />
          <Pager page={page} hasNext={hasNext} tab={tab} q={query} />
        </>
      ) : (
        <EmptyState
          title="Tidak ada judul yang cocok"
          description="Coba judul Jepangnya, atau nama seri tanpa tambahan “episode”."
          actionLabel="Kembali ke daftar"
          actionHref="/hentai"
        />
      )}
    </section>
  );
}

async function LatestList({ page }: { page: number }) {
  try {
    const { items, pagination } = await getNekopoiLatestEpisodes(page);
    const cards = items.filter(nekopoiIsHentaiItem).map(nekopoiToCard);

    if (cards.length === 0) {
      return (
        <EmptyState
          title="Belum ada episode di halaman ini"
          description="Sumber mungkin sedang memperbarui daftar. Coba halaman sebelumnya."
          actionLabel="Ke halaman pertama"
          actionHref={buildHref({ tab: 'episode' })}
        />
      );
    }

    return (
      <section aria-label="Episode hentai terbaru">
        <NekopoiGrid items={cards} priorityCount={6} />
        <Pager page={page} hasNext={pagination.hasNextPage} tab="episode" />
      </section>
    );
  } catch (err) {
    return (
      <EmptyState
        title="Gagal memuat daftar"
        description={err instanceof Error ? err.message : 'Sumber Nekopoi tidak merespons.'}
        actionLabel="Coba lagi"
        actionHref={buildHref({ tab: 'episode', page })}
      />
    );
  }
}

async function SeriesList({ page }: { page: number }) {
  try {
    // Daftar seri dikirim sekaligus oleh sumber, jadi dipotong per halaman di sini.
    const all = (await getNekopoiSeriesList()).filter(nekopoiIsHentaiItem);
    const start = (page - 1) * PAGE_SIZE;
    const slice = all.slice(start, start + PAGE_SIZE);
    const hasNext = start + PAGE_SIZE < all.length;

    if (slice.length === 0) {
      return (
        <EmptyState
          title="Halaman ini kosong"
          description="Daftar seri sudah habis di halaman sebelumnya."
          actionLabel="Ke halaman pertama"
          actionHref={buildHref({ tab: 'seri' })}
        />
      );
    }

    return (
      <section aria-label="Daftar seri hentai">
        <NekopoiGrid items={slice.map(nekopoiToCard)} priorityCount={6} />
        <Pager page={page} hasNext={hasNext} tab="seri" />
      </section>
    );
  } catch (err) {
    return (
      <EmptyState
        title="Gagal memuat daftar seri"
        description={err instanceof Error ? err.message : 'Sumber Nekopoi tidak merespons.'}
        actionLabel="Coba lagi"
        actionHref={buildHref({ tab: 'seri', page })}
      />
    );
  }
}

function Pager({
  page,
  hasNext,
  tab,
  q,
}: {
  page: number;
  hasNext: boolean;
  tab: Tab;
  q?: string;
}) {
  if (page === 1 && !hasNext) return null;

  const itemClass =
    'inline-flex h-9 items-center rounded-[5px] border border-white/10 px-3.5 text-[12.5px] font-semibold text-zinc-300 transition-colors duration-150 hover:border-white/25 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60';

  return (
    <nav aria-label="Navigasi halaman" className="mt-8 flex items-center justify-between gap-3">
      {page > 1 ? (
        <Link href={buildHref({ tab, page: page - 1, q })} className={itemClass}>
          Sebelumnya
        </Link>
      ) : (
        <span aria-hidden="true" />
      )}
      <span className="text-[11.5px] tabular-nums text-zinc-500">Halaman {page}</span>
      {hasNext ? (
        <Link href={buildHref({ tab, page: page + 1, q })} className={itemClass}>
          Berikutnya
        </Link>
      ) : (
        <span aria-hidden="true" />
      )}
    </nav>
  );
}
