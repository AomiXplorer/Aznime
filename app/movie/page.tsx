import type { Metadata } from 'next';
import { Suspense } from 'react';
import { ComicCard } from '@/components/comics/ComicCard';
import { PageHeader } from '@/components/PageHeader';
import { COMMONS_MOVIES } from '@/lib/movie-commons';
import { getMovieCatalog, MOVIE_SOURCES, type MovieSource } from '@/lib/movies';

export const revalidate = 900;
export const metadata: Metadata = {
  title: 'Movie',
  description: 'Katalog film Aznime',
  alternates: { canonical: '/movie' },
};

async function SourceCatalog({ source }: { source: MovieSource }) {
  const movies = await getMovieCatalog(source);
  return movies.length ? (
    <div className="grid grid-cols-3 gap-x-3 gap-y-6 sm:grid-cols-4 lg:grid-cols-6">
      {movies.slice(0, 30).map((movie) => <ComicCard key={movie.id} item={movie} />)}
    </div>
  ) : (
    <p className="text-sm text-zinc-400">Katalog belum bisa dimuat dari sumber ini.</p>
  );
}

export default function MoviePage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader title="Movie" />
      <section aria-labelledby="movie-commons" className="mb-10">
        <h2 id="movie-commons" className="mb-4 font-display text-xl font-semibold">Koleksi Wikimedia Commons</h2>
        <div className="grid grid-cols-3 gap-x-3 gap-y-6 sm:grid-cols-4 lg:grid-cols-6">
          {COMMONS_MOVIES.map((movie) => <ComicCard key={movie.id} item={movie} />)}
        </div>
      </section>
      {(['kitanonton', 'rebahin'] as const).map((source) => (
        <section key={source} aria-labelledby={source} className="mb-10 border-t border-line pt-4">
          <h2 id={source} className="mb-3 font-display text-xl font-semibold">{MOVIE_SOURCES[source].name}</h2>
          <Suspense fallback={<p role="status" className="text-sm text-zinc-400">Memuat katalog…</p>}>
            <SourceCatalog source={source} />
          </Suspense>
        </section>
      ))}
    </div>
  );
}
