import type {
  AnimeCardItem,
  DownloadBox,
  EpisodeSummary,
  MirrorServer,
  PaginationInfo,
  QuickSearchItem,
} from './scraper/types';
import { UpstreamError } from './scraper/utils';

/**
 * Sumber ketiga Aznime: Nekopoi (konten 18+), dibaca lewat API publik
 * Sanka Vollerei. Semua data di sini adalah konten dewasa, jadi seluruh modul
 * ini hanya dipakai halaman di bawah /hentai dan tidak pernah dicampur ke
 * katalog anime utama.
 *
 * Batas laju API sumber 45 permintaan/menit, karena itu setiap endpoint diberi
 * cache memori + revalidate panjang.
 */
export const NEKOPOI_BASE_URL = (
  process.env.NEKOPOI_API_BASE_URL || 'https://www.sankavollerei.web.id/anime/nekopoi'
).replace(/\/+$/, '');

export const NEKOPOI_SITE_URL = 'https://nekopoi.care';

/**
 * Aturan tampilan yang diminta pemilik situs: di semua daftar (kartu katalog,
 * pencarian, judul halaman) genre yang muncul cukup "Hentai". Genre asli
 * Nekopoi (Ahegao, Anal, BDSM, ...) baru ditampilkan saat membuka halaman
 * sinopsis satu judul.
 */
export const NEKOPOI_ONLY_GENRE = 'Hentai';

const ANIME_PREFIX = 'nekopoi-';
const EPISODE_PREFIX = 'nekopoi-ep-';

export function nekopoiAnimeSlug(slug: string): string {
  return `${ANIME_PREFIX}${slug.trim()}`;
}

export function nekopoiEpisodeSlug(slug: string): string {
  return `${EPISODE_PREFIX}${slug.trim()}`;
}

export function nekopoiAnimeSlugFromSlug(value: string): string | null {
  const decoded = safeDecode(value);
  if (!decoded.startsWith(ANIME_PREFIX) || decoded.startsWith(EPISODE_PREFIX)) return null;
  const rest = decoded.slice(ANIME_PREFIX.length).trim();
  return rest || null;
}

export function nekopoiEpisodeSlugFromSlug(value: string): string | null {
  const decoded = safeDecode(value);
  if (!decoded.startsWith(EPISODE_PREFIX)) return null;
  const rest = decoded.slice(EPISODE_PREFIX.length).trim();
  return rest || null;
}

/**
 * Slug dari URL /hentai/[slug]: boleh slug sumber apa adanya, boleh masih
 * berawalan (dipakai tautan internal yang membawa slug global).
 */
export function nekopoiSeriesSlugFromRoute(value: string): string | null {
  const decoded = safeDecode(value).trim();
  if (!decoded) return null;
  if (decoded.startsWith(EPISODE_PREFIX)) return null;
  if (decoded.startsWith(ANIME_PREFIX)) return decoded.slice(ANIME_PREFIX.length).trim() || null;
  return decoded;
}

/** Padanan untuk URL /hentai/watch/[slug]. */
export function nekopoiEpisodeSlugFromRoute(value: string): string | null {
  const decoded = safeDecode(value).trim();
  if (!decoded) return null;
  if (decoded.startsWith(EPISODE_PREFIX)) {
    return decoded.slice(EPISODE_PREFIX.length).trim() || null;
  }
  if (decoded.startsWith(ANIME_PREFIX)) return null;
  return decoded;
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/**
 * Slug episode Nekopoi selalu berakhiran "-episode-N" (kadang ditambah
 * "-subtitle-indonesia"). Slug seri induknya dipakai untuk menampilkan daftar
 * episode lain dan tombol navigasi. Postingan 3D/JAV tidak punya pola ini, jadi
 * hasilnya null dan halaman episode tampil tanpa daftar seri.
 */
export function nekopoiSeriesSlugFromEpisode(episodeSlug: string): string | null {
  const match = episodeSlug.match(
    /^(.*?)-episode-([0-9]+(?:\.[0-9]+)?)(?:-subtitle-indonesia)?$/i
  );
  return match && match[1] ? match[1] : null;
}

/* ------------------------------------------------------------------ payload */

export interface NekopoiListItem {
  title: string;
  slug: string;
  url: string;
  thumbnail?: string;
  status?: string;
  score?: string;
  date?: string;
  description?: string;
  genres?: string[];
}

export interface NekopoiSeriesRef {
  title: string;
  slug: string;
  url: string;
}

export interface NekopoiHomePayload {
  recommended: NekopoiSeriesRef[];
  latest_hentai: NekopoiListItem[];
  latest_episodes: NekopoiListItem[];
  latest_jav: NekopoiListItem[];
}

export interface NekopoiGenre {
  name: string;
  slug: string;
  url: string;
}

export interface NekopoiEpisodeRef {
  title: string;
  slug: string;
  url: string;
  thumbnail?: string;
  uploadedDate?: string;
}

export interface NekopoiDetailPayload {
  title: string;
  slug: string;
  url: string;
  thumbnail: string;
  japan_name?: string;
  producer?: string;
  type?: string;
  status?: string;
  duration?: string;
  score?: string;
  genres: string[];
  episodes: NekopoiEpisodeRef[];
}

export interface NekopoiStream {
  server: string;
  url: string;
}

export interface NekopoiDownload {
  quality: string;
  links: { host: string; url: string }[];
}

export interface NekopoiEpisodePayload {
  title: string;
  slug: string;
  url: string;
  thumbnail?: string;
  description?: string;
  series?: { name: string; slug: string; url: string } | null;
  streams: NekopoiStream[];
  downloads: NekopoiDownload[];
}

interface NekopoiEnvelope<T> {
  status?: string;
  message?: string;
  data?: T;
  pagination?: {
    current_page?: number;
    total_pages?: number;
    has_next?: boolean;
    has_prev?: boolean;
  };
}

/* -------------------------------------------------------------------- fetch */

const MEMORY_CACHE_MAX = 120;
const memoryCache = new Map<string, { value: unknown; expiresAt: number }>();

function readCache<T>(key: string): T | null {
  const entry = memoryCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    memoryCache.delete(key);
    return null;
  }
  return entry.value as T;
}

function writeCache(key: string, value: unknown, ttlSeconds: number): void {
  if (ttlSeconds <= 0) return;
  if (memoryCache.size >= MEMORY_CACHE_MAX) {
    const oldest = memoryCache.keys().next().value;
    if (oldest) memoryCache.delete(oldest);
  }
  memoryCache.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
}

/** API menolak permintaan tanpa User-Agent browser (403 dari detektor bot). */
const BROWSER_UA =
  'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36';

async function nekopoiFetch<T>(path: string, revalidate: number): Promise<NekopoiEnvelope<T>> {
  const url = `${NEKOPOI_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;
  const cacheKey = `nekopoi:${url}`;
  const cached = readCache<NekopoiEnvelope<T>>(cacheKey);
  if (cached !== null) return cached;

  let res: Response;
  try {
    res = await fetch(url, {
      headers: { Accept: 'application/json', 'User-Agent': BROWSER_UA },
      signal: AbortSignal.timeout(15000),
      next: { revalidate },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Network error';
    throw new UpstreamError(`Gagal terhubung ke Nekopoi (${msg})`, { url });
  }

  if (res.status === 404 || res.status === 410) {
    throw new UpstreamError('Konten tidak ditemukan di Nekopoi', { status: 404, url });
  }
  if (!res.ok) {
    throw new UpstreamError(`Nekopoi membalas HTTP ${res.status}`, { status: res.status, url });
  }

  let json: unknown;
  try {
    json = await res.json();
  } catch {
    throw new UpstreamError('Nekopoi mengirim respons yang bukan JSON', { status: 502, url });
  }

  const envelope = json as NekopoiEnvelope<T>;
  if (!envelope || envelope.status === 'error' || envelope.data === undefined) {
    throw new UpstreamError(envelope?.message || 'Nekopoi menolak permintaan', {
      status: 502,
      url,
    });
  }

  writeCache(cacheKey, envelope, revalidate);
  return envelope;
}

function toPagination(
  pagination: NekopoiEnvelope<unknown>['pagination'],
  fallbackPage = 1
): PaginationInfo {
  const currentPage = pagination?.current_page || fallbackPage;
  const totalPages = pagination?.total_pages ?? null;
  const hasNextPage = Boolean(pagination?.has_next);
  return {
    currentPage,
    totalPages,
    hasNextPage,
    hasPrevPage: Boolean(pagination?.has_prev) || currentPage > 1,
    nextPage: hasNextPage ? currentPage + 1 : null,
    prevPage: currentPage > 1 ? currentPage - 1 : null,
  };
}

/* ------------------------------------------------------------------- teks */

const LEADING_TAG = /^\s*\[[^\]]{1,40}\]\s*/;
const TRAILING_SUB = /\s*(?:subtitle\s+indonesia|subtitle\s+indo|sub\s*indo)\s*$/i;
const EPISODE_SUFFIX = /\s*episode\s+([0-9]+(?:\.[0-9]+)?)\s*$/i;
const SERIES_TITLE_NOISE = /^\s*unduh\s+"?([^"]+?)"?\s*(?:indonesian\s+)?(?:subbed|subtitle|sub).*$/i;

/**
 * Judul Nekopoi menumpuk penanda rilis ("[UNCENSORED] ... Episode 6 Subtitle
 * Indonesia"). Penanda itu dibuang supaya kartu tidak penuh teks teknis, dan
 * nomor episode diambil terpisah.
 */
export function nekopoiCleanTitle(raw: string): string {
  let text = raw.replace(/\s+/g, ' ').trim();
  for (let pass = 0; pass < 3; pass += 1) {
    const next = text.replace(LEADING_TAG, '');
    if (next === text) break;
    text = next;
  }
  text = text.replace(TRAILING_SUB, '').trim();
  return text || raw.trim();
}

/** Judul seri tanpa embel-embel episode, mis. dipakai sebagai `seriesTitle`. */
export function nekopoiSeriesTitle(raw: string): string {
  return nekopoiCleanTitle(raw).replace(EPISODE_SUFFIX, '').trim() || nekopoiCleanTitle(raw);
}

export function nekopoiEpisodeNumber(raw: string): string | null {
  const match = raw.match(EPISODE_SUFFIX) || raw.match(/\bepisode\s+([0-9]+(?:\.[0-9]+)?)/i);
  return match ? match[1] : null;
}

/**
 * Detail Nekopoi memberi judul halaman, bukan judul seri:
 * `Unduh "Kuroinu: ..." Indonesian Subbed/Dubbed Online`.
 */
export function nekopoiDetailTitle(raw: string): string {
  const quoted = raw.match(SERIES_TITLE_NOISE);
  if (quoted && quoted[1]) return quoted[1].trim();
  return nekopoiCleanTitle(raw);
}

/** Deskripsi episode diawali "Sinopsis :" — dibuang agar kalimatnya utuh. */
export function nekopoiSynopsis(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const text = raw.replace(/^\s*sinopsis\s*:\s*/i, '').trim();
  return text || null;
}

/* ------------------------------------------------------------------ mapper */

export function nekopoiImage(url: string | null | undefined): string | null {
  if (!url) return null;
  const trimmed = url.trim();
  if (!trimmed) return null;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

/**
 * Seri hentai selalu berada di /hentai/<slug>/. Episode lepas, 3D, dan JAV
 * berada langsung di akar situs, jadi path URL adalah penanda paling andal
 * untuk membedakan halaman seri dari halaman tonton.
 */
export function nekopoiIsSeries(item: Pick<NekopoiListItem, 'url'>): boolean {
  return Boolean(item.url && /\/hentai\//i.test(item.url));
}

/**
 * Sumber yang sama juga memuat rilisan 3D dan JAV, sedangkan bagian Aznime ini
 * khusus hentai animasi. Postingan 3D/JAV dibuang di sini: seri hentai selalu
 * berada di /hentai/, dan episode animasi selalu memuat kata "episode" pada
 * judul atau slug-nya.
 */
export function nekopoiIsHentaiItem(
  item: Pick<NekopoiListItem, 'url' | 'slug' | 'title'>
): boolean {
  if (item.url && /\/hentai\//i.test(item.url)) return true;
  return /episode/i.test(item.slug || '') || /episode/i.test(item.title || '');
}

/**
 * Kartu untuk daftar. Genre sengaja dikunci ke "Hentai" sesuai aturan tampilan;
 * genre asli hanya muncul di halaman sinopsis.
 */
export function nekopoiToCard(item: NekopoiListItem): AnimeCardItem {
  const title = nekopoiCleanTitle(item.title);
  const isSeries = nekopoiIsSeries(item);
  const number = isSeries ? null : nekopoiEpisodeNumber(item.title);

  return {
    postId: null,
    title,
    seriesTitle: number ? nekopoiSeriesTitle(item.title) : title,
    slug: isSeries ? nekopoiAnimeSlug(item.slug) : nekopoiEpisodeSlug(item.slug),
    url: item.url || null,
    kind: isSeries ? 'anime' : 'episode',
    poster: nekopoiImage(item.thumbnail),
    type: NEKOPOI_ONLY_GENRE,
    status: item.status?.trim() || null,
    sub: 'Sub Indo',
    episode: number,
    episodeNumber: number ? Number.parseFloat(number) : null,
    isHot: false,
    source: 'nekopoi',
    genres: [NEKOPOI_ONLY_GENRE],
  };
}

export function nekopoiToQuickItem(item: NekopoiListItem): QuickSearchItem {
  const card = nekopoiToCard(item);
  return {
    postId: card.postId || card.slug || '',
    title: card.title,
    slug: card.slug,
    url: card.url,
    kind: card.kind,
    poster: card.poster,
    genres: card.genres || [NEKOPOI_ONLY_GENRE],
    type: card.type,
    latestEpisode: card.episode,
    sub: card.sub,
    source: 'nekopoi',
  };
}

export function nekopoiToEpisodeSummary(episode: NekopoiEpisodeRef): EpisodeSummary {
  const number = nekopoiEpisodeNumber(episode.title);
  return {
    number,
    title: nekopoiCleanTitle(episode.title),
    date: episode.uploadedDate || null,
    // URL pemutar /hentai/watch memakai slug sumber apa adanya (tanpa awalan),
    // jadi ringkasan episode di bagian ini juga memakai slug mentah.
    slug: episode.slug?.trim() || null,
    url: episode.url,
  };
}

/** Genre asli dari halaman sinopsis, urut sesuai sumber tanpa duplikat. */
export function nekopoiDetailGenres(genres: string[] | null | undefined): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of genres || []) {
    const name = (raw || '').trim();
    if (!name) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(name);
  }
  if (result.length === 0) result.push(NEKOPOI_ONLY_GENRE);
  return result;
}

/** Widget Discord bukan pemutar video, jadi dibuang dari daftar server. */
const NON_PLAYER_HOSTS = ['discord.com', 'discord.gg'];

export function nekopoiStreamsToMirrors(streams: NekopoiStream[] | null | undefined): MirrorServer[] {
  return (streams || [])
    .filter((stream) => stream && stream.url)
    .filter((stream) => {
      try {
        const host = new URL(stream.url).hostname.toLowerCase();
        return !NON_PLAYER_HOSTS.some((blocked) => host.endsWith(blocked));
      } catch {
        return false;
      }
    })
    .map((stream, idx) => ({
      name: stream.server?.trim() || `Server ${idx + 1}`,
      available: true,
      type: 'iframe' as const,
      url: stream.url,
    }));
}

export function nekopoiDownloadsToBoxes(
  downloads: NekopoiDownload[] | null | undefined
): DownloadBox[] {
  const qualities = (downloads || [])
    .filter((download) => download && download.quality && download.links?.length)
    .map((download) => ({
      quality: download.quality.trim(),
      links: download.links
        .filter((link) => link && link.url)
        .map((link) => ({ host: link.host?.trim() || 'Unduh', url: link.url })),
    }))
    .filter((quality) => quality.links.length > 0);

  if (qualities.length === 0) return [];
  return [{ title: 'Episode ini', qualities }];
}

/* ----------------------------------------------------------------- endpoint */

export async function getNekopoiHome(): Promise<NekopoiHomePayload> {
  const envelope = await nekopoiFetch<NekopoiHomePayload>('/home', 900);
  const data = envelope.data as NekopoiHomePayload;
  return {
    recommended: data.recommended || [],
    latest_hentai: data.latest_hentai || [],
    latest_episodes: data.latest_episodes || [],
    latest_jav: data.latest_jav || [],
  };
}

/**
 * Daftar seluruh seri hentai (1000+ judul) dikirim dalam satu halaman, jadi
 * hasilnya di-cache lama dan dipotong per halaman di sisi kita.
 */
export async function getNekopoiSeriesList(): Promise<NekopoiListItem[]> {
  const envelope = await nekopoiFetch<NekopoiListItem[]>('/hentai-list', 3600);
  return envelope.data || [];
}

export async function getNekopoiLatestEpisodes(page = 1): Promise<{
  items: NekopoiListItem[];
  pagination: PaginationInfo;
}> {
  const safePage = Math.max(1, Math.trunc(page) || 1);
  const envelope = await nekopoiFetch<NekopoiListItem[]>(
    `/latest-hentai?page=${safePage}`,
    600
  );
  return { items: envelope.data || [], pagination: toPagination(envelope.pagination, safePage) };
}

export async function getNekopoiGenres(): Promise<NekopoiGenre[]> {
  const envelope = await nekopoiFetch<NekopoiGenre[]>('/genres', 86400);
  return envelope.data || [];
}

export async function getNekopoiDetail(slug: string): Promise<NekopoiDetailPayload> {
  const clean = slug.trim();
  if (!clean) throw new UpstreamError('Slug Nekopoi kosong', { status: 400 });
  const envelope = await nekopoiFetch<NekopoiDetailPayload>(
    `/detail/${encodeURIComponent(clean)}`,
    900
  );
  const data = envelope.data as NekopoiDetailPayload;
  return {
    ...data,
    genres: data.genres || [],
    episodes: data.episodes || [],
  };
}

export async function getNekopoiEpisode(slug: string): Promise<NekopoiEpisodePayload> {
  const clean = slug.trim();
  if (!clean) throw new UpstreamError('Slug episode Nekopoi kosong', { status: 400 });
  const envelope = await nekopoiFetch<NekopoiEpisodePayload>(
    `/episode/${encodeURIComponent(clean)}`,
    900
  );
  const data = envelope.data as NekopoiEpisodePayload;
  return {
    ...data,
    streams: data.streams || [],
    downloads: data.downloads || [],
  };
}

export async function searchNekopoi(
  query: string,
  page = 1
): Promise<{ query: string; items: NekopoiListItem[]; pagination: PaginationInfo }> {
  const trimmed = query.trim();
  if (!trimmed) {
    return {
      query: '',
      items: [],
      pagination: toPagination(undefined, 1),
    };
  }
  const safePage = Math.max(1, Math.trunc(page) || 1);
  const params = new URLSearchParams({ q: trimmed, page: String(safePage) });
  const envelope = await nekopoiFetch<NekopoiListItem[]>(`/search?${params.toString()}`, 300);
  return {
    query: trimmed,
    items: envelope.data || [],
    pagination: toPagination(envelope.pagination, safePage),
  };
}
