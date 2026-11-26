import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AnimeImage } from '@/components/AnimeImage';
import { COMMONS_MOVIES } from '@/lib/movie-commons';
import { getMovie, isMovieSource, moviePath, MOVIE_SOURCES } from '@/lib/movies';

interface MoviePageProps {
  params: Promise<{ source: string; path: string[] }>;
}

export const revalidate = 900;

export async function generateMetadata({ params }: MoviePageProps): Promise<Metadata> {
  const { source, path } = await params;
  const title = source === 'commons' && path.length === 1
    ? COMMONS_MOVIES.find((movie) => movie.href.endsWith('/' + path[0]))?.title
    : undefined;
  return { title: title || 'Movie' };
}

export default async function MovieDetailPage({ params }: MoviePageProps) {
  const { source, path } = await params;
  if (source !== 'commons' && (!isMovieSource(source) || !moviePath(path))) notFound();
  const movie = source === 'commons'
    ? (path.length === 1 ? COMMONS_MOVIES.find((item) => item.href.endsWith('/' + path[0])) : undefined)
    : await getMovie(source, path);
  if (!movie && source === 'commons') notFound();

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <Link href="/movie" className="mb-5 inline-flex text-sm font-medium text-zinc-400 hover:text-white">Semua Movie</Link>
      {movie ? (
        <>
          <div className="mb-6 flex items-start gap-4 sm:gap-6">
            <div className="relative aspect-[2/3] w-24 shrink-0 overflow-hidden rounded-md sm:w-36">
              <AnimeImage src={movie.poster} alt={movie.title} sizes="144px" unoptimized />
            </div>
            <div>
              <h1 className="font-display text-2xl font-semibold text-white sm:text-4xl">{movie.title}</h1>
              {movie.meta ? <p className="mt-1 text-sm text-zinc-400">{movie.meta}</p> : null}
              {movie.synopsis ? <p className="mt-3 max-w-prose text-sm leading-relaxed text-zinc-300">{movie.synopsis}</p> : null}
            </div>
          </div>
          {movie.video ? (
            <video controls playsInline preload="none" poster={movie.poster || undefined} className="aspect-video w-full rounded-md bg-black" aria-label={movie.title}>
              <source src={movie.video} />
            </video>
          ) : movie.embed ? (
            <iframe
              src={movie.embed}
              title={movie.title}
              className="aspect-video w-full rounded-md bg-black"
              sandbox="allow-scripts allow-same-origin allow-presentation"
              allowFullScreen
              referrerPolicy="no-referrer"
              loading="lazy"
            />
          ) : <p className="mb-3 text-sm text-zinc-400">Pemutar tidak tersedia di Aznime untuk film ini.</p>}
          <a href={movie.sourceUrl} target="_blank" rel="noopener noreferrer" className="mt-4 inline-flex text-sm text-zinc-400 underline hover:text-white">
            Lihat di {source === 'commons' ? 'Wikimedia Commons' : MOVIE_SOURCES[source].name}
          </a>
        </>
      ) : (
        <h1 className="font-display text-xl font-semibold">Detail film belum bisa dimuat dari sumber.</h1>
      )}
    </div>
  );
}
