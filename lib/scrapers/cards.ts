import type { AnimeCardItem } from '@/lib/scraper/types';
import type { ComicCard, ComicFeed } from '@/lib/comics';
import { getSortedSources } from './registry';
import type { Movie, MoviesResult } from './types';

/**
 * Tautan detail film. Film dari sumber utama memakai /film/<slug> seperti
 * sebelumnya; film dari sumber cadangan membawa ?src=<id> supaya halaman
 * detail tahu sumber mana yang harus ditanya.
 */
export function getFilmHref(movie: Pick<Movie, 'slug' | 'source'>): string {
  const base = `/film/${encodeURIComponent(movie.slug)}`;
  const primary = getSortedSources()[0];
  if (movie.source && primary && movie.source.id !== primary.id) {
    return `${base}?src=${encodeURIComponent(movie.source.id)}`;
  }
  return base;
}

export function toAnimeCardItem(movie: Movie): AnimeCardItem {
  const ratingText = movie.rating !== undefined ? `★ ${movie.rating.toFixed(1)}` : null;
  const fallbackGenre = movie.genres?.[0] ?? null;

  return {
    postId: movie.sourceId ?? null,
    title: movie.title,
    seriesTitle: movie.title,
    slug: movie.slug,
    url: movie.sourceUrl,
    href: getFilmHref(movie),
    kind: 'anime',
    poster: movie.poster ?? null,
    type: movie.year ? String(movie.year) : null,
    status: ratingText || fallbackGenre,
    sub: null,
    episode: null,
    episodeNumber: null,
    isHot: false,
    // Penanda keluarga "film" untuk UI (poster langsung, tautan /film).
    // Sumber sebenarnya ada di movie.source, bukan di sini.
    source: 'rumahfilm',
    genres: movie.genres,
  };
}

export function toComicCard(movie: Movie): ComicCard {
  const metaParts = [movie.year ? String(movie.year) : null, movie.genres?.[0] ?? null].filter(
    Boolean
  );
  return {
    id: `film:${movie.source?.id ?? 'unknown'}:${movie.slug}`,
    source: 'rumahfilm',
    title: movie.title,
    poster: movie.poster ?? null,
    meta: metaParts.length > 0 ? metaParts.join(' · ') : null,
    latest: movie.rating !== undefined ? `★ ${movie.rating.toFixed(1)}` : null,
    href: getFilmHref(movie),
  };
}

export function toComicFeed(result: Pick<MoviesResult, 'items' | 'offline'>, limit: number): ComicFeed {
  return { items: result.items.slice(0, limit).map(toComicCard), offline: result.offline };
}
