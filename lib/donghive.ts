import { UpstreamError } from '@/lib/scraper/utils';
import type { ComicCard } from '@/lib/comics';

/**
 * Sanka Vollerei API adapter for its Anichin-backed donghua catalog.
 * Keep the existing module name and app routes so current Aznime links remain
 * valid while the upstream source is replaced.
 */
export const SANKA_DONGHUA_API_URL = 'https://www.sankavollerei.web.id';

export interface DonghiveEpisodeRef {
  episode: string | null;
  title: string;
  date: string | null;
  slug: string;
  url: string;
}

export interface DonghiveDetail {
  title: string;
  slug: string;
  url: string;
  poster: string | null;
  rating: string | null;
  synopsis: string | null;
  metadata: Record<string, string>;
  genres: string[];
  episodes: DonghiveEpisodeRef[];
}

export interface DonghiveServer {
  name: string;
  url: string;
}

export interface DonghiveEpisode {
  title: string;
  slug: string;
  url: string;
  episodeNumber: string | null;
  releaseDate: string | null;
  thumbnail: string | null;
  series: { title: string | null; slug: string | null; url: string | null };
  navigation: { prev: string | null; next: string | null; allEpisodes: string | null };
  servers: DonghiveServer[];
}

export interface DonghiveListResult {
  items: ComicCard[];
  hasNextPage: boolean;
  page: number;
}

type ApiObject = Record<string, unknown>;

function asObject(value: unknown): ApiObject {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as ApiObject) : {};
}

function asArray(value: unknown): ApiObject[] {
  return Array.isArray(value) ? value.map(asObject) : [];
}

function text(value: unknown): string {
  return typeof value === 'string' || typeof value === 'number' ? String(value).trim() : '';
}

function safeSlug(value: unknown): string {
  return text(value).replace(/^\/+|\/+$/g, '').split('/').filter(Boolean).pop() || '';
}

function absoluteUrl(value: unknown): string | null {
  const raw = text(value);
  if (!raw) return null;
  try {
    const url = new URL(raw, SANKA_DONGHUA_API_URL);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : null;
  } catch {
    return null;
  }
}

function slugFromUrl(value: string | null): string | null {
  if (!value) return null;
  try {
    return safeSlug(decodeURIComponent(new URL(value).pathname));
  } catch {
    return null;
  }
}

function pageNumber(page: number): number {
  return Number.isFinite(page) ? Math.max(1, Math.trunc(page)) : 1;
}

function apiPath(...parts: string[]): string {
  return `/anime/donghua/${parts.map((part) => encodeURIComponent(part)).join('/')}`;
}

async function getJson(path: string, revalidate: number): Promise<ApiObject> {
  const url = new URL(path, SANKA_DONGHUA_API_URL).toString();
  let response: Response;
  try {
    response = await fetch(url, {
      headers: { Accept: 'application/json', 'User-Agent': 'Aznime/1.1 (+https://aznime.com)' },
      signal: AbortSignal.timeout(12000),
      next: { revalidate },
    });
  } catch (error) {
    throw new UpstreamError(
      `API donghua tidak merespons${error instanceof Error ? ` (${error.message})` : ''}.`,
      { status: 503, url }
    );
  }

  if (!response.ok) {
    throw new UpstreamError(`API donghua merespons HTTP ${response.status}.`, {
      status: response.status,
      url: response.url,
    });
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new UpstreamError('API donghua mengirim respons yang bukan JSON.', { status: 502, url });
  }
  const result = asObject(payload);
  if (text(result.status).toLowerCase() === 'error' || text(result.status).toLowerCase() === 'failed') {
    throw new UpstreamError(text(result.message) || 'API donghua gagal memuat data.', { status: 502, url });
  }
  return result;
}

function listingFrom(payload: ApiObject): ApiObject[] {
  for (const key of ['latest_donghua', 'search_results', 'results', 'data', 'donghua']) {
    const items = asArray(payload[key]);
    if (items.length > 0) return items;
  }
  return [];
}

function episodeRefFrom(item: ApiObject, fallbackTitle = ''): DonghiveEpisodeRef | null {
  const slug = safeSlug(item.slug) || slugFromUrl(absoluteUrl(item.href));
  const title = text(item.episode) || text(item.title) || fallbackTitle;
  if (!slug || !title) return null;
  return {
    episode: text(item.episode_number) || null,
    title,
    date: text(item.release_date) || null,
    slug,
    url: absoluteUrl(item.anichinUrl) || absoluteUrl(item.href) || new URL(`/donghua/episode/${encodeURIComponent(slug)}`, SANKA_DONGHUA_API_URL).toString(),
  };
}

function cardFrom(item: ApiObject): ComicCard | null {
  const slug = safeSlug(item.slug) || slugFromUrl(absoluteUrl(item.href));
  const title = text(item.title);
  if (!slug || !title) return null;
  const poster = absoluteUrl(item.poster);
  return {
    id: `donghive:${slug}`,
    source: 'donghive',
    title,
    poster,
    meta: [text(item.type) || 'Donghua', text(item.status), text(item.sub)].filter(Boolean).join(' · '),
    latest: text(item.latest_episode) || null,
    href: `/donghive/${encodeURIComponent(slug)}`,
  };
}

export async function getDonghiveHome(limit = 10): Promise<ComicCard[]> {
  const payload = await getJson(apiPath('latest', '1'), 600);
  return listingFrom(payload)
    .map(cardFrom)
    .filter((item): item is ComicCard => item !== null)
    .slice(0, Math.max(0, limit));
}

export async function getDonghiveList(page = 1, query = ''): Promise<DonghiveListResult> {
  const currentPage = pageNumber(page);
  const search = query.trim().slice(0, 100);
  const payload = await getJson(
    search ? apiPath('search', search) : apiPath('latest', String(currentPage)),
    600
  );
  const rawItems = listingFrom(payload);
  const items = rawItems.map(cardFrom).filter((item): item is ComicCard => item !== null);
  const totalPages = Number(payload.total_pages || payload.totalPages || 0);
  const hasNextPage = typeof payload.has_next === 'boolean'
    ? payload.has_next
    : typeof payload.hasNextPage === 'boolean'
      ? payload.hasNextPage
      : totalPages > 0
        ? currentPage < totalPages
        : rawItems.length >= 30;
  return { items, hasNextPage, page: currentPage };
}

export async function getDonghiveDetail(slug: string): Promise<DonghiveDetail> {
  const safe = safeSlug(slug);
  if (!safe || safe.includes('..')) throw new UpstreamError('Slug donghua tidak valid.', { status: 404 });
  const payload = await getJson(apiPath('detail', safe), 1800);
  const title = text(payload.title);
  if (!title) throw new UpstreamError('Judul donghua tidak ditemukan.', { status: 404 });

  const genres = asArray(payload.genres).map((genre) => text(genre.name || genre.title)).filter(Boolean);
  const episodes = asArray(payload.episodes_list)
    .map((item) => episodeRefFrom(item, title))
    .filter((item): item is DonghiveEpisodeRef => item !== null);
  const metadata: Record<string, string> = {};
  for (const [key, label] of [
    ['status', 'Status'],
    ['type', 'Tipe'],
    ['episodes_count', 'Jumlah episode'],
    ['studio', 'Studio'],
    ['network', 'Network'],
    ['released', 'Rilis'],
    ['duration', 'Durasi'],
    ['country', 'Negara'],
    ['subber', 'Penerjemah'],
    ['author', 'Uploader'],
  ] as const) {
    const value = text(payload[key]);
    if (value) metadata[label] = value;
  }

  return {
    title,
    slug: safeSlug(payload.slug) || safe,
    url: absoluteUrl(payload.anichinUrl) || new URL(`/donghua/${encodeURIComponent(safe)}/`, SANKA_DONGHUA_API_URL).toString(),
    poster: absoluteUrl(payload.poster),
    rating: text(payload.rating) || null,
    synopsis: text(payload.synopsis) || null,
    metadata,
    genres: [...new Set(genres)],
    episodes,
  };
}

export async function getDonghiveEpisode(slug: string): Promise<DonghiveEpisode> {
  const safe = safeSlug(slug);
  if (!safe || safe.includes('..')) throw new UpstreamError('Slug episode tidak valid.', { status: 404 });
  const payload = await getJson(apiPath('episode', safe), 300);
  const title = text(payload.episode);
  if (!title) throw new UpstreamError('Episode donghua tidak ditemukan.', { status: 404 });

  const streaming = asObject(payload.streaming);
  const rawServers = asArray(streaming.servers);
  const mainServer = asObject(streaming.main_url);
  if (Object.keys(mainServer).length > 0) rawServers.unshift(mainServer);
  const seen = new Set<string>();
  const servers = rawServers
    .map((server) => ({ name: text(server.name), url: absoluteUrl(server.url) }))
    .filter((server): server is DonghiveServer => {
      if (!server.name || !server.url || seen.has(server.url)) return false;
      seen.add(server.url);
      return true;
    });

  const series = asObject(payload.donghua_details);
  const navigation = asObject(payload.navigation);
  const previous = asObject(navigation.previous_episode);
  const next = asObject(navigation.next_episode);
  const allEpisodes = asObject(navigation.all_episodes);
  const seriesSlug = safeSlug(series.slug) || safeSlug(allEpisodes.slug);
  const seriesUrl = absoluteUrl(series.anichinUrl) || absoluteUrl(allEpisodes.anichinUrl) ||
    (seriesSlug ? new URL(`/donghua/${encodeURIComponent(seriesSlug)}/`, SANKA_DONGHUA_API_URL).toString() : null);

  return {
    title,
    slug: safeSlug(payload.slug) || safe,
    url: absoluteUrl(payload.anichinUrl) || new URL(`/donghua/episode/${encodeURIComponent(safe)}/`, SANKA_DONGHUA_API_URL).toString(),
    episodeNumber: text(payload.episode_number) || title.match(/episode\s*([\d.]+)/i)?.[1] || null,
    releaseDate: text(series.released) || null,
    thumbnail: absoluteUrl(series.poster),
    series: {
      title: text(series.title) || null,
      slug: seriesSlug || null,
      url: seriesUrl,
    },
    navigation: {
      prev: absoluteUrl(previous.anichinUrl) || absoluteUrl(previous.href),
      next: absoluteUrl(next.anichinUrl) || absoluteUrl(next.href),
      allEpisodes: absoluteUrl(allEpisodes.anichinUrl) || absoluteUrl(allEpisodes.href) || seriesUrl,
    },
    servers,
  };
}

export function donghiveEpisodeSummary(episode: DonghiveEpisodeRef) {
  return {
    number: episode.episode,
    title: episode.title,
    date: episode.date,
    slug: episode.slug,
    url: episode.url,
  };
}
