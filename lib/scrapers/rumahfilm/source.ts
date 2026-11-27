import type { FilmSource, MovieDetailResult, ScrapeResult } from '../types';
import { getRumahFilmCatalog, getRumahFilmDetail } from './index';

/**
 * Adapter RumahFilm untuk Source Manager. Hanya menjembatani scraper yang
 * sudah ada; logika fetch, parser, dan cache RumahFilm tidak diubah.
 *
 * Catalog yang offline dilempar sebagai error supaya manager menjalankan
 * fallback. (Katalog kosong tapi sumber terjangkau tetap dikembalikan
 * sebagai hasil kosong.)
 */
export const rumahFilmSource: FilmSource = {
  id: 'rumahfilm',
  name: 'RumahFilm',
  priority: 1,
  // Rantai fetch RumahFilm punya beberapa percobaan (12 dtk per percobaan),
  // jadi diberi batas lebih longgar daripada bawaan manager (8 dtk).
  timeout: 15_000,

  async scrapeMovies(options): Promise<ScrapeResult> {
    const feed = await getRumahFilmCatalog(options?.page ?? 1);
    if (feed.offline) {
      throw new Error(feed.error || 'RumahFilm sedang tidak dapat dihubungi.');
    }
    return { movies: feed.items, pagination: feed.pagination };
  },

  async getMovieDetail(slug): Promise<MovieDetailResult> {
    const result = await getRumahFilmDetail(slug);
    return {
      detail: result.detail,
      offline: result.offline,
      notFound: result.notFound,
      error: result.error,
    };
  },
};
