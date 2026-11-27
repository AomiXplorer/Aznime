import { isNonMovieUrl, isRestrictedMovie } from './rumahfilm/filter';
import type { Movie } from './types';

/**
 * Filter konten yang sama untuk SEMUA sumber, dijalankan setelah normalisasi.
 * Aturan sengaja memakai satu implementasi (filter RumahFilm yang sudah ada)
 * supaya sumber baru tidak bisa melewatinya.
 */
export function isAllowedMovie(movie: Movie): boolean {
  if (isNonMovieUrl(movie.url) || isNonMovieUrl(movie.sourceUrl)) return false;
  return !isRestrictedMovie({
    title: movie.title,
    url: movie.url,
    sourceUrl: movie.sourceUrl,
    genres: movie.genres,
  });
}

export function filterMovies(movies: Movie[]): Movie[] {
  return movies.filter(isAllowedMovie);
}
