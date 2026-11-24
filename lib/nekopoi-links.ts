/**
 * Penautan murni untuk konten Nekopoi (tanpa dependensi server), dipakai
 * bersama oleh halaman, grid, dan kotak pencarian cepat.
 */

export const NEKOPOI_ANIME_PREFIX = 'nekopoi-';
export const NEKOPOI_EPISODE_PREFIX = 'nekopoi-ep-';

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/** Slug seri tanpa awalan, atau null bila nilai ini slug episode. */
export function nekopoiSeriesSlugFromValue(value: string): string | null {
  const decoded = safeDecode(value);
  if (!decoded.startsWith(NEKOPOI_ANIME_PREFIX) || decoded.startsWith(NEKOPOI_EPISODE_PREFIX)) {
    return null;
  }
  return decoded.slice(NEKOPOI_ANIME_PREFIX.length).trim() || null;
}

/** Slug episode tanpa awalan, atau null bila nilai ini slug seri. */
export function nekopoiEpisodeSlugFromValue(value: string): string | null {
  const decoded = safeDecode(value);
  if (!decoded.startsWith(NEKOPOI_EPISODE_PREFIX)) return null;
  return decoded.slice(NEKOPOI_EPISODE_PREFIX.length).trim() || null;
}

/**
 * Tujuan sebuah kartu Nekopoi: seri menuju halaman sinopsis, episode menuju
 * pemutar. Slug dari sumber sudah membawa awalannya sendiri.
 */
export function nekopoiCardHref(item: { slug: string | null; kind: 'anime' | 'episode' }): string {
  if (!item.slug) return '/hentai';
  const episodeSlug = nekopoiEpisodeSlugFromValue(item.slug);
  if (episodeSlug || item.kind === 'episode') {
    return `/hentai/watch/${encodeURIComponent(episodeSlug || item.slug)}`;
  }
  const seriesSlug = nekopoiSeriesSlugFromValue(item.slug) || item.slug;
  return `/hentai/${encodeURIComponent(seriesSlug)}`;
}
