import type { PaginationInfo } from '@/lib/scraper/types';

/**
 * Tipe bersama lapisan multi-source film.
 *
 * Halaman /film dan komponen UI hanya mengenal tipe-tipe ini, tidak pernah
 * mengenal RumahFilm atau sumber tertentu lainnya.
 */

export interface MovieSourceInfo {
  id: string;
  name: string;
  /** URL halaman film di sumber asal (untuk debugging dan tautan "buka di sumber"). */
  url: string;
}

export interface MovieExternalIds {
  tmdb?: string;
  imdb?: string;
}

export interface Movie {
  /** ID film di sumber asal, bila ada. Bukan ID global. */
  sourceId?: string | null;
  title: string;
  slug: string;
  url: string;
  sourceUrl: string;
  poster?: string;
  year?: number;
  rating?: number;
  genres?: string[];
  type: 'movie';
  /** ID eksternal (TMDB/IMDb) bila sumber menyediakannya; dipakai deduplikasi. */
  externalIds?: MovieExternalIds;
  /** Diisi oleh Source Manager, bukan oleh adapter. */
  source?: MovieSourceInfo;
}

export interface MovieStreamSource {
  label: string;
  url: string;
  kind: 'iframe' | 'video';
}

export interface MovieDetail extends Movie {
  originalTitle?: string;
  backdrop?: string;
  synopsis?: string;
  director?: string;
  cast?: string[];
  duration?: string;
  country?: string;
  releaseDate?: string;
  streamUrls?: MovieStreamSource[];
}

export interface ScrapeOptions {
  page?: number;
  /** Batas waktu per panggilan, dalam milidetik. */
  timeout?: number;
  signal?: AbortSignal;
}

/** Hasil mentah satu adapter. Pagination opsional; sumber tanpa pagination boleh mengosongkannya. */
export interface ScrapeResult {
  movies: Movie[];
  pagination?: PaginationInfo;
}

export interface MovieDetailResult {
  detail: MovieDetail | null;
  offline: boolean;
  notFound: boolean;
  error?: string;
  sourceId?: string;
}

/**
 * Kontrak adapter. Menambah sumber baru = implementasi interface ini lalu
 * daftarkan di registry.ts. Tidak ada perubahan di /film atau komponen UI.
 *
 * Adapter boleh melempar error (HTTP error, parse error, timeout, dll.);
 * Source Manager yang menangkap dan menjalankan fallback.
 */
export interface FilmSource {
  id: string;
  name: string;
  /** Lebih kecil = dicoba lebih dulu. */
  priority: number;
  /** Batas waktu bawaan sumber ini (ms). Bila kosong, memakai bawaan manager. */
  timeout?: number;
  scrapeMovies: (options?: ScrapeOptions) => Promise<ScrapeResult>;
  /** Opsional: detail film. Sumber tanpa fungsi ini hanya melayani katalog. */
  getMovieDetail?: (slug: string, options?: ScrapeOptions) => Promise<MovieDetailResult>;
}

export type ScrapeMode = 'fallback' | 'aggregate';

export type SourceStatus = 'healthy' | 'degraded' | 'unavailable';

export interface GetMoviesOptions {
  page?: number;
  /** Bawaan: 'fallback'. */
  mode?: ScrapeMode;
  /** Timeout per sumber (ms), menimpa nilai bawaan sumber. */
  timeout?: number;
  /** Matikan cache manager (dipakai tes). */
  cache?: boolean;
}

export interface SourceAttempt {
  sourceId: string;
  outcome: 'success' | 'empty' | 'timeout' | 'error' | 'skipped';
  /** Pesan singkat saja; tidak pernah berisi HTML mentah. */
  message?: string;
}

export interface MoviesResult {
  items: Movie[];
  pagination: PaginationInfo;
  offline: boolean;
  error?: string;
  /** Sumber yang akhirnya dipakai (mode fallback) atau yang berhasil (mode aggregate). */
  usedSources: string[];
  attempts: SourceAttempt[];
}
