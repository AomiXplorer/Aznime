import type { Metadata } from 'next';
import Link from 'next/link';
import { ComicGrid } from '@/components/comics/ComicGrid';
import { EmptyState } from '@/components/EmptyState';
import { PageHeader } from '@/components/PageHeader';
import { getDonghiveList } from '@/lib/donghive';

export const revalidate = 600;

export const metadata: Metadata = {
  title: 'Donghua · Subtitle Indonesia',
  description: 'Daftar Donghua terbaru dengan subtitle Indonesia.',
};

interface DonghivePageProps {
  searchParams: Promise<{ page?: string; q?: string }>;
}

function pageHref(page: number, query: string): string {
  const params = new URLSearchParams();
  if (query) params.set('q', query);
  if (page > 1) params.set('page', String(page));
  const search = params.toString();
  return search ? `/donghive?${search}` : '/donghive';
}

export default async function DonghiveIndexPage({ searchParams }: DonghivePageProps) {
  const params = await searchParams;
  const rawPage = Number(params.page || 1);
  const page = Number.isFinite(rawPage) && rawPage > 0 ? Math.trunc(rawPage) : 1;
  const query = (params.q || '').trim().slice(0, 100);

  try {
    const result = await getDonghiveList(page, query);
    return (
      <div className="mx-auto max-w-7xl px-4 pb-16 pt-7 sm:px-6 lg:px-8">
        <PageHeader title="Donghua" description="Daftar Donghua dan episode terbaru.">
          <form action="/donghive" method="get" className="flex w-full gap-2 sm:w-auto">
            <label htmlFor="donghive-search" className="sr-only">Cari Donghua</label>
            <input
              id="donghive-search"
              type="search"
              name="q"
              defaultValue={query}
              placeholder="Cari judul"
              className="h-10 min-w-0 flex-1 rounded-md border border-white/10 bg-white/[0.04] px-3 text-[13px] text-white placeholder:text-zinc-500 focus:border-white/30 focus:outline-none focus:ring-2 focus:ring-white/25 sm:w-56"
            />
            <button
              type="submit"
              className="h-10 cursor-pointer rounded-md bg-white px-4 text-[12.5px] font-semibold text-black transition-colors duration-150 hover:bg-zinc-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
            >
              Cari
            </button>
          </form>
        </PageHeader>

        {result.items.length ? (
          <>
            <ComicGrid items={result.items} />
            <nav aria-label="Halaman katalog Donghua" className="mt-10 flex items-center justify-center gap-3">
              {page > 1 ? (
                <Link
                  href={pageHref(page - 1, query)}
                  prefetch={false}
                  className="inline-flex h-10 items-center rounded-md border border-white/10 px-4 text-[12px] font-medium text-zinc-300 transition-colors hover:border-white/25 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
                >
                  Sebelumnya
                </Link>
              ) : null}
              <span className="text-[12px] tabular-nums text-zinc-500">Halaman {page}</span>
              {result.hasNextPage ? (
                <Link
                  href={pageHref(page + 1, query)}
                  prefetch={false}
                  className="inline-flex h-10 items-center rounded-md border border-white/10 px-4 text-[12px] font-medium text-zinc-300 transition-colors hover:border-white/25 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
                >
                  Berikutnya
                </Link>
              ) : null}
            </nav>
          </>
        ) : (
          <EmptyState
            title={query ? 'Judul tidak ditemukan' : 'Daftar belum tersedia'}
            description={query ? `Tidak ada hasil untuk “${query}”.` : 'API Donghua sedang tidak mengirimkan daftar.'}
            actionLabel={query ? 'Lihat semua Donghua' : undefined}
            actionHref={query ? '/donghive' : undefined}
          />
        )}
        <p className="mt-12 border-t border-[#2b2222] pt-4 text-[11px] leading-relaxed text-zinc-600">
          Data katalog dan episode dimuat dari API Sanka Vollerei (sumber Anichin).
        </p>
      </div>
    );
  } catch (error) {
    return (
      <div className="mx-auto max-w-7xl px-4 pb-16 pt-7 sm:px-6 lg:px-8">
        <PageHeader title="Donghua" description="Daftar Donghua dan episode terbaru." />
        <EmptyState
          title="Gagal memuat katalog"
          description={error instanceof Error ? error.message : 'API Donghua tidak merespons.'}
          actionLabel="Coba lagi"
          actionHref={pageHref(page, query)}
        />
      </div>
    );
  }
}
