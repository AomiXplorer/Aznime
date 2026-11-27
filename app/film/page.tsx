import type { Metadata } from 'next';
import { Suspense } from 'react';
import { getMovies, toAnimeCardItem } from '@/lib/scrapers';
import { socialMeta } from '@/lib/seo';
import { EmptyState } from '@/components/EmptyState';
import { InfiniteAnimeCatalog } from '@/components/InfiniteAnimeCatalog';
import { PageHeader } from '@/components/PageHeader';
import { AnimeGridSkeleton } from '@/components/Skeleton';

const TITLE = 'Film';
const DESCRIPTION =
  'Katalog film pilihan. Jelajahi daftar movie beserta tahun rilis, rating, dan detail lengkapnya di Aznime.';

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: '/film' },
  ...socialMeta(TITLE, DESCRIPTION),
};

export const dynamic = 'force-dynamic';

export default function FilmPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader
        title="Film"
        description="Katalog film pilihan. Pilih judul untuk melihat detail, sinopsis, dan sumber tontonannya."
      />

      <Suspense fallback={<AnimeGridSkeleton count={18} />}>
        <FilmCatalogResults />
      </Suspense>
    </div>
  );
}

async function FilmCatalogResults() {
  const feed = await getMovies({ page: 1 });

  if (feed.offline && feed.items.length === 0) {
    return (
      <EmptyState
        title="Sumber film sedang tidak bisa dihubungi"
        description="Semua sumber film menolak atau belum merespons permintaan dari server Aznime saat ini. Coba lagi beberapa saat lagi."
      />
    );
  }

  return (
    <InfiniteAnimeCatalog
      initialItems={feed.items.map(toAnimeCardItem)}
      initialPagination={feed.pagination}
      apiPath="/api/film"
      queryParams={{}}
      emptyTitle="Belum ada film ditemukan"
      emptyDescription="Daftar film belum tersedia saat ini."
      emptyActionLabel={null}
      emptyActionHref={null}
      endLabel="film"
    />
  );
}
