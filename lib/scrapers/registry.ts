import { rumahFilmSource } from './rumahfilm/source';
import type { FilmSource } from './types';

/**
 * Registry sumber film. Satu-satunya tempat yang perlu diubah untuk
 * menambah atau mengganti sumber:
 *
 *   1. buat adapter yang mengimplementasikan FilmSource
 *   2. tambahkan ke array di bawah dengan priority yang sesuai
 *
 * Hanya daftarkan sumber yang sudah lolos validasi (lihat
 * docs/multi-source-film.md, bagian "Validasi sumber baru").
 */
export const filmSources: FilmSource[] = [rumahFilmSource];

/** Sumber terurut berdasarkan priority (kecil lebih dulu). Urutan stabil untuk priority sama. */
export function getSortedSources(sources: FilmSource[] = filmSources): FilmSource[] {
  return sources
    .map((source, index) => ({ source, index }))
    .sort((a, b) => a.source.priority - b.source.priority || a.index - b.index)
    .map(({ source }) => source);
}

export function getSourceById(id: string, sources: FilmSource[] = filmSources): FilmSource | undefined {
  return sources.find((source) => source.id === id);
}
