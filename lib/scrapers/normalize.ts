import type { FilmSource, Movie } from './types';

const MAX_TITLE = 200;

function httpUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value.trim());
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
    if (url.username || url.password) return null;
    return url.toString();
  } catch {
    return null;
  }
}

function cleanText(value: string | null | undefined): string {
  return (value ?? '').replace(/\s+/g, ' ').trim();
}

/**
 * Kunci judul untuk membandingkan film antar-sumber.
 * "Avatar: The Way of Water (2022)" dan "Avatar The Way of Water" -> kunci sama.
 */
export function normalizeTitleKey(title: string | null | undefined): string {
  return cleanText(title)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\((?:19|20)\d{2}\)/g, ' ')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function validYear(year: number | undefined): number | undefined {
  if (year === undefined || !Number.isFinite(year)) return undefined;
  const y = Math.trunc(year);
  return y >= 1888 && y <= new Date().getFullYear() + 2 ? y : undefined;
}

function validRating(rating: number | undefined): number | undefined {
  if (rating === undefined || !Number.isFinite(rating)) return undefined;
  return rating >= 0 && rating <= 10 ? rating : undefined;
}

/**
 * Satukan bentuk Movie dari sumber mana pun. Mengembalikan null untuk data
 * yang tidak layak tampil (tanpa judul, slug, atau URL valid).
 */
export function normalizeMovie(raw: Movie, source: Pick<FilmSource, 'id' | 'name'>): Movie | null {
  const title = cleanText(raw.title).slice(0, MAX_TITLE);
  const slug = cleanText(raw.slug);
  const url = httpUrl(raw.url);
  const sourceUrl = httpUrl(raw.sourceUrl) ?? url;
  if (!title || !slug || !url || !sourceUrl) return null;

  const poster = httpUrl(raw.poster) ?? undefined;
  const genres = (raw.genres ?? []).map(cleanText).filter(Boolean);
  const tmdb = cleanText(raw.externalIds?.tmdb);
  const imdb = cleanText(raw.externalIds?.imdb).toLowerCase();

  return {
    sourceId: raw.sourceId ?? null,
    title,
    slug,
    url,
    sourceUrl,
    poster,
    year: validYear(raw.year),
    rating: validRating(raw.rating),
    genres: genres.length > 0 ? genres : undefined,
    type: 'movie',
    externalIds: tmdb || imdb ? { tmdb: tmdb || undefined, imdb: imdb || undefined } : undefined,
    source: { id: source.id, name: source.name, url: sourceUrl },
  };
}

export function normalizeMovies(
  raw: Movie[],
  source: Pick<FilmSource, 'id' | 'name'>
): Movie[] {
  const out: Movie[] = [];
  for (const item of raw) {
    const movie = normalizeMovie(item, source);
    if (movie) out.push(movie);
  }
  return out;
}
