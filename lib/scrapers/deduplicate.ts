import { normalizeTitleKey } from './normalize';
import type { Movie } from './types';

/**
 * Deduplikasi antar-sumber, dijalankan SETELAH normalisasi.
 *
 * Prioritas kecocokan:
 *   1. ID eksternal (TMDB / IMDb)
 *   2. judul ternormalisasi + tahun
 *   3. judul ternormalisasi saja (hanya bila salah satu sisi tidak punya tahun)
 *
 * URL sumber sengaja TIDAK dipakai sebagai identitas global, karena tiap
 * sumber punya URL berbeda. Slug hanya dipakai di dalam sumber yang sama.
 *
 * Urutan input dipertahankan: film dari sumber berprioritas tinggi (yang
 * diberikan lebih dulu) menang, dan field yang kosong diisi dari duplikatnya.
 */
function mergeInto(winner: Movie, dup: Movie): void {
  winner.poster ??= dup.poster;
  winner.year ??= dup.year;
  winner.rating ??= dup.rating;
  if (!winner.genres?.length && dup.genres?.length) winner.genres = dup.genres;
  if (dup.externalIds) {
    winner.externalIds = { ...dup.externalIds, ...winner.externalIds };
  }
}

export function deduplicateMovies(movies: Movie[]): Movie[] {
  const byExternal = new Map<string, Movie>();
  const byTitleYear = new Map<string, Movie>();
  /** Judul -> film, untuk pencocokan film tanpa tahun. */
  const byTitle = new Map<string, Movie>();
  /** Judul -> film yang tidak punya tahun, untuk film bertahun yang datang belakangan. */
  const yearlessByTitle = new Map<string, Movie>();
  const bySourceSlug = new Map<string, Movie>();
  const output: Movie[] = [];

  for (const movie of movies) {
    const titleKey = normalizeTitleKey(movie.title);
    const externalKeys: string[] = [];
    if (movie.externalIds?.tmdb) externalKeys.push(`tmdb:${movie.externalIds.tmdb}`);
    if (movie.externalIds?.imdb) externalKeys.push(`imdb:${movie.externalIds.imdb}`);
    const slugKey = movie.source ? `${movie.source.id}:${movie.slug.toLowerCase()}` : '';
    const titleYearKey = titleKey && movie.year ? `${titleKey}|${movie.year}` : '';

    let match: Movie | undefined;
    for (const key of externalKeys) {
      match = byExternal.get(key);
      if (match) break;
    }
    if (!match && slugKey) match = bySourceSlug.get(slugKey);
    if (!match && titleYearKey) match = byTitleYear.get(titleYearKey);
    if (!match && titleKey) {
      match = movie.year ? yearlessByTitle.get(titleKey) : byTitle.get(titleKey);
    }

    if (match) {
      mergeInto(match, movie);
      for (const key of externalKeys) if (!byExternal.has(key)) byExternal.set(key, match);
      continue;
    }

    output.push(movie);
    for (const key of externalKeys) byExternal.set(key, movie);
    if (slugKey) bySourceSlug.set(slugKey, movie);
    if (titleYearKey) byTitleYear.set(titleYearKey, movie);
    if (titleKey) {
      if (!byTitle.has(titleKey)) byTitle.set(titleKey, movie);
      if (!movie.year && !yearlessByTitle.has(titleKey)) yearlessByTitle.set(titleKey, movie);
    }
  }

  return output;
}
