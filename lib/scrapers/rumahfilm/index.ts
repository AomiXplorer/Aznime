import { DEFAULT_UA, looksLikeChallengePage } from '@/lib/scraper/utils';
import type { AnimeCardItem, PaginationInfo } from '@/lib/scraper/types';
import type { ComicCard, ComicFeed } from '@/lib/comics';
import { isRestrictedText, isRestrictedUrl } from './filter';
import { dedupeMovies, parseRumahFilmDetail, parseRumahFilmListing } from './parser';
import type {
  RumahFilmCatalogResult,
  RumahFilmDetailResult,
  RumahFilmMovie,
} from './types';

export const RUMAHFILM_BASE_URL =
  process.env.RUMAHFILM_BASE_URL?.replace(/\/+$/, '') || 'https://rumahfilm.net';

const TTL_MS = 10 * 60 * 1000;
const ERROR_TTL_MS = 60 * 1000;
const CACHE_MAX = 80;

const cache = new Map<string, { at: number; ttl: number; value: unknown }>();
const inflight = new Map<string, Promise<unknown>>();

function emptyPagination(page: number): PaginationInfo {
  return {
    currentPage: page,
    totalPages: null,
    hasNextPage: false,
    hasPrevPage: page > 1,
    nextPage: null,
    prevPage: page > 1 ? page - 1 : null,
  };
}

function getBaseHost(): string {
  try {
    return new URL(RUMAHFILM_BASE_URL).hostname.toLowerCase();
  } catch {
    return 'rumahfilm.net';
  }
}

function validateTargetUrl(urlOrPath: string): string {
  const base = new URL(RUMAHFILM_BASE_URL);
  const resolved = new URL(urlOrPath, base);
  if (
    (resolved.protocol !== 'https:' && resolved.protocol !== 'http:') ||
    resolved.hostname.toLowerCase() !== getBaseHost() ||
    resolved.username ||
    resolved.password
  ) {
    throw new Error('URL RumahFilm tidak diizinkan');
  }
  return resolved.toString();
}

async function cached<T>(
  key: string,
  load: () => Promise<T>,
  getTtl: (value: T) => number = () => TTL_MS
): Promise<T> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < hit.ttl) return hit.value as T;

  const running = inflight.get(key);
  if (running) return running as Promise<T>;

  const task = load()
    .then((value) => {
      cache.delete(key);
      if (cache.size >= CACHE_MAX) {
        const oldest = cache.keys().next().value;
        if (oldest) cache.delete(oldest);
      }
      cache.set(key, { at: Date.now(), ttl: getTtl(value), value });
      return value;
    })
    .finally(() => {
      inflight.delete(key);
    });

  inflight.set(key, task);
  return task;
}

class FetchBlockedError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'FetchBlockedError';
    this.status = status;
  }
}

class FetchNotFoundError extends Error {
  constructor() {
    super('Halaman tidak ditemukan');
    this.name = 'FetchNotFoundError';
  }
}

async function fetchRumahFilmHtml(urlOrPath: string): Promise<{ html: string; url: string }> {
  const targetUrl = validateTargetUrl(urlOrPath);
  const res = await fetch(targetUrl, {
    headers: {
      'User-Agent': DEFAULT_UA,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
      Referer: `${RUMAHFILM_BASE_URL}/`,
    },
    redirect: 'follow',
    signal: AbortSignal.timeout(15000),
  });

  if (res.status === 404 || res.status === 410) {
    await res.body?.cancel();
    throw new FetchNotFoundError();
  }

  const html = await res.text();
  if (res.status === 403 || res.status === 429 || res.status >= 500 || looksLikeChallengePage(html)) {
    throw new FetchBlockedError(
      `Sumber RumahFilm menolak permintaan (${res.status || 'verifikasi'}).`,
      res.status || 503
    );
  }

  if (!res.ok) {
    throw new FetchBlockedError(`Sumber RumahFilm mengembalikan HTTP ${res.status}.`, res.status);
  }

  return { html, url: res.url || targetUrl };
}

function buildListingCandidates(page: number): string[] {
  if (page <= 1) {
    return ['/movies/', '/movie/', '/'];
  }
  return [`/movies/page/${page}/`, `/movie/page/${page}/`, `/page/${page}/`];
}

export function getRumahFilmCatalog(page = 1): Promise<RumahFilmCatalogResult> {
  const safePage = Number.isFinite(page) && page >= 1 ? Math.trunc(page) : 1;

  return cached(
    `rumahfilm:catalog:${safePage}`,
    async () => {
      const candidates = buildListingCandidates(safePage);
      let lastError: string | undefined;
      let reachedWithoutData = false;

      for (const path of candidates) {
        try {
          const { html } = await fetchRumahFilmHtml(path);
          const parsed = parseRumahFilmListing(html, safePage, RUMAHFILM_BASE_URL);
          if (parsed.items.length > 0) {
            return {
              items: dedupeMovies(parsed.items),
              pagination: parsed.pagination,
              offline: false,
            };
          }
          reachedWithoutData = true;
        } catch (err) {
          if (err instanceof FetchNotFoundError) continue;
          if (err instanceof FetchBlockedError) {
            lastError = err.message;
            break;
          }
          lastError = err instanceof Error ? err.message : 'Gagal menghubungi RumahFilm';
        }
      }

      if (reachedWithoutData && !lastError) {
        return {
          items: [],
          pagination: emptyPagination(safePage),
          offline: false,
        };
      }

      return {
        items: [],
        pagination: emptyPagination(safePage),
        offline: true,
        error: lastError || 'RumahFilm sedang tidak dapat dihubungi dari server saat ini.',
      };
    },
    (res) => (res.offline ? ERROR_TTL_MS : TTL_MS)
  );
}

export function getRumahFilmDetail(slugOrUrl: string): Promise<RumahFilmDetailResult> {
  const cleanSlug = slugOrUrl.trim().replace(/^\/+|\/+$/g, '');
  if (!cleanSlug || isRestrictedText(cleanSlug) || isRestrictedUrl(`/${cleanSlug}/`)) {
    return Promise.resolve({ detail: null, offline: false, notFound: true });
  }

  return cached(
    `rumahfilm:detail:${cleanSlug}`,
    async () => {
      const candidates = /^https?:\/\//i.test(slugOrUrl)
        ? [slugOrUrl]
        : [`/${encodeURIComponent(cleanSlug)}/`, `/movies/${encodeURIComponent(cleanSlug)}/`];

      let hadNotFound = false;
      let lastError: string | undefined;

      for (const path of candidates) {
        try {
          const { html, url } = await fetchRumahFilmHtml(path);
          const detail = parseRumahFilmDetail(html, cleanSlug, url, RUMAHFILM_BASE_URL);
          if (!detail) {
            return { detail: null, offline: false, notFound: true };
          }
          return { detail, offline: false, notFound: false };
        } catch (err) {
          if (err instanceof FetchNotFoundError) {
            hadNotFound = true;
            continue;
          }
          if (err instanceof FetchBlockedError) {
            lastError = err.message;
            break;
          }
          lastError = err instanceof Error ? err.message : 'Gagal menghubungi RumahFilm';
        }
      }

      if (hadNotFound && !lastError) {
        return { detail: null, offline: false, notFound: true };
      }

      return {
        detail: null,
        offline: true,
        notFound: false,
        error: lastError || 'Detail film sedang tidak dapat diambil dari RumahFilm.',
      };
    },
    (res) => (res.offline ? ERROR_TTL_MS : TTL_MS)
  );
}

export function toAnimeCardItem(movie: RumahFilmMovie): AnimeCardItem {
  const ratingText = movie.rating !== undefined ? `★ ${movie.rating.toFixed(1)}` : null;
  const fallbackGenre = movie.genres?.[0] ?? null;

  return {
    postId: movie.sourceId ?? null,
    title: movie.title,
    seriesTitle: movie.title,
    slug: movie.slug,
    url: movie.sourceUrl,
    href: `/film/${encodeURIComponent(movie.slug)}`,
    kind: 'anime',
    poster: movie.poster ?? null,
    type: movie.year ? String(movie.year) : null,
    status: ratingText || fallbackGenre,
    sub: null,
    episode: null,
    episodeNumber: null,
    isHot: false,
    source: 'rumahfilm',
    genres: movie.genres,
  };
}

export function toComicCard(movie: RumahFilmMovie): ComicCard {
  const metaParts = [movie.year ? String(movie.year) : null, movie.genres?.[0] ?? null].filter(
    Boolean
  );
  return {
    id: `rumahfilm:${movie.slug}`,
    source: 'rumahfilm',
    title: movie.title,
    poster: movie.poster ?? null,
    meta: metaParts.length > 0 ? metaParts.join(' · ') : null,
    latest: movie.rating !== undefined ? `★ ${movie.rating.toFixed(1)}` : null,
    href: `/film/${encodeURIComponent(movie.slug)}`,
  };
}

export async function getRumahFilmFeed(limit = 14): Promise<ComicFeed> {
  try {
    const result = await Promise.race([
      getRumahFilmCatalog(1),
      new Promise<RumahFilmCatalogResult>((resolve) =>
        setTimeout(
          () => resolve({ items: [], pagination: emptyPagination(1), offline: true }),
          5000
        )
      ),
    ]);
    return {
      items: result.items.slice(0, limit).map(toComicCard),
      offline: result.offline,
    };
  } catch {
    return { items: [], offline: true };
  }
}
