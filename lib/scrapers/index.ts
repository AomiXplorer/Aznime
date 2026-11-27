import { toComicFeed } from './cards';
import { createSourceManager } from './manager';
import type { ComicFeed } from '@/lib/comics';
import type { GetMoviesOptions, MovieDetailResult, MoviesResult } from './types';

/**
 * Movie Service: pintu masuk tunggal untuk /film, /api/film, dan beranda.
 * Halaman tidak boleh mengimpor scraper sumber (RumahFilm, dll.) langsung.
 */
const manager = createSourceManager();

export function getMovies(options?: GetMoviesOptions): Promise<MoviesResult> {
  return manager.getMovies(options);
}

export function getMovieDetail(
  slug: string,
  options?: { sourceId?: string; timeout?: number }
): Promise<MovieDetailResult> {
  return manager.getMovieDetail(slug, options);
}

/** Umpan film untuk beranda; tidak pernah menahan halaman lebih dari 5 detik. */
export async function getFilmFeed(limit = 14): Promise<ComicFeed> {
  try {
    const result = await Promise.race([
      getMovies({ page: 1 }),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 5000)),
    ]);
    if (!result) return { items: [], offline: true };
    return toComicFeed(result, limit);
  } catch {
    return { items: [], offline: true };
  }
}

export { createSourceManager } from './manager';
export { getFilmHref, toAnimeCardItem, toComicCard } from './cards';
export { filmSources } from './registry';
export type * from './types';
