import type {
  AnimeCardItem,
  EpisodeSummary,
  MirrorServer,
  QuickSearchItem,
} from './scraper/types';
import { UpstreamError } from './scraper/utils';
<<<<<<< HEAD
=======
import { isBlockedPosterHost, posterUrlWithTitleFallback } from './posters';
>>>>>>> c5dfbd0 (Update maintennace)

export const MALZ_BASE_URL = (
  process.env.MALZ_API_BASE_URL || 'https://malz-official.com/api/v2'
).replace(/\/+$/, '');

export const MALZ_PROVIDER_LABEL = 'Arsip Malz';

/** Slug anime/eps Malz diberi awalan supaya satu rute bisa melayani dua sumber. */
export const MALZ_ANIME_SLUG_PATTERN = /^malz-(\d+)$/;
export const MALZ_EPISODE_SLUG_PATTERN = /^malz-ep-(\d+)$/;

export function malzAnimeSlug(id: string): string {
  return `malz-${id.trim()}`;
}

export function malzEpisodeSlug(id: string): string {
  return `malz-ep-${id.trim()}`;
}

export function malzAnimeIdFromSlug(slug: string): string | null {
  const match = decodeURIComponent(slug).match(MALZ_ANIME_SLUG_PATTERN);
  return match ? match[1] : null;
}

export function malzEpisodeIdFromSlug(slug: string): string | null {
  const match = decodeURIComponent(slug).match(MALZ_EPISODE_SLUG_PATTERN);
  return match ? match[1] : null;
}

export interface MalzAnime {
  id: string;
  judul: string;
  sinonim: string;
  sinopsis: string;
  poster: string;
  cover: string;
  tipe: string;
  tahun: string;
  hari: string;
  status: string;
  genre: string;
  rating: string;
  views: string;
  favorit: string;
  studio: string;
  tayang: string;
  selesai: string;
}

export interface MalzEpisode {
  id: string;
  episode: string;
  judul: string;
  views: string;
  id_anime: string;
  tanggal: string;
  gambar: string;
}

export interface MalzServer {
  id: string;
  nama: string;
  tipe: string;
  kualitas: string;
  ukuran_mb: string | null;
  link: string;
  host: string;
  perlu_browser: boolean;
}

export interface MalzGenre {
  id: string;
  nama: string;
  grup: string;
}

export interface MalzDetailPayload {
  anime: MalzAnime;
  genre: MalzGenre[];
  episode_terakhir: MalzEpisode | null;
  season: MalzAnime[];
}

export interface MalzEpisodePage {
  items: MalzEpisode[];
  perHalaman: number;
}

export interface MalzStreamPayload {
  episode: MalzEpisode | null;
  berikutnya: MalzEpisode | null;
  servers: MalzServer[];
  videoTersedia: boolean;
}

interface MalzEnvelope {
  status?: boolean | string;
  error?: boolean | string;
  message?: string;
  items?: MalzAnime[];
  populer?: MalzAnime[];
  hangat?: MalzAnime[];
  baru?: MalzAnime[];
  acak?: MalzAnime[];
  tunggu?: MalzAnime[];
  slider?: MalzAnime[];
}

const MEMORY_CACHE_MAX = 200;
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

async function malzFetch<T>(path: string, revalidate: number): Promise<T> {
  const url = `${MALZ_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;
  const cacheKey = `malz:${url}`;
  const cached = readCache<T>(cacheKey);
  if (cached !== null) return cached;

  let res: Response;
  try {
    res = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(12000),
      next: { revalidate },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Network error';
    throw new UpstreamError(`Gagal terhubung ke arsip Malz (${msg})`, { url });
  }

  if (!res.ok) {
    throw new UpstreamError(`Arsip Malz membalas HTTP ${res.status}`, { status: res.status, url });
  }

  let json: unknown;
  try {
    json = await res.json();
  } catch {
    throw new UpstreamError('Arsip Malz mengirim respons yang bukan JSON', { status: 502, url });
  }

  const envelope = json as MalzEnvelope;
  if (envelope && typeof envelope === 'object' && (envelope.error === true || envelope.error === 'True')) {
    throw new UpstreamError(envelope.message || 'Arsip Malz menolak permintaan', {
      status: 502,
      url,
    });
  }

  writeCache(cacheKey, json, revalidate);
  return json as T;
}

/** Poster/cover Malz kadang ditulis dengan garis miring ganda setelah host. */
export function normalizeMalzAsset(url: string | null | undefined): string | null {
  if (!url) return null;
  const trimmed = url.trim();
  if (!trimmed) return null;
  const collapsed = trimmed.replace(/([^:/])\/{2,}/g, '$1/');
  try {
    const parsed = new URL(collapsed);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

/**
 * CDN gambar animein menolak hotlink dari domain lain, jadi poster dikirim
 * lewat /api/img yang menyamar sebagai permintaan dari situsnya sendiri.
 */
export function malzImageUrl(url: string | null | undefined): string | null {
  const normalized = normalizeMalzAsset(url);
  if (!normalized) return null;
  return `/api/img?u=${encodeURIComponent(normalized)}`;
}

export function splitMalzList(raw: string | null | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
}

const STATUS_LABEL: Record<string, string> = {
  ONGOING: 'Ongoing',
  FINISHED: 'Completed',
  WAITING: 'Upcoming',
  UNKNOWN: 'Unknown',
};

const TYPE_LABEL: Record<string, string> = {
  SERIES: 'TV',
  MOVIE: 'Movie',
  OVA: 'OVA',
  ONA: 'ONA',
  SPECIAL: 'Special',
};

export function malzStatusLabel(status: string): string {
  return STATUS_LABEL[status.trim().toUpperCase()] || status.trim();
}

export function malzTypeLabel(tipe: string): string {
  return TYPE_LABEL[tipe.trim().toUpperCase()] || tipe.trim();
}

export function malzSinonimList(anime: Pick<MalzAnime, 'judul' | 'sinonim'>): string[] {
  return splitMalzList(anime.sinonim).filter(
    (name) => name.toLowerCase() !== anime.judul.trim().toLowerCase()
  );
}

<<<<<<< HEAD
=======
/**
 * Poster Malz lewat /api/img karena CDN-nya menolak hotlink. Host yang kini
 * diblokir Cloudflare ditukar dengan cover AniList pada judul yang sama,
 * sehingga kartunya tetap punya gambar.
 */
function malzPoster(anime: MalzAnime): string | null {
  const raw = normalizeMalzAsset(anime.poster) || normalizeMalzAsset(anime.cover);
  if (raw && isBlockedPosterHost(raw)) {
    return posterUrlWithTitleFallback(raw, anime.judul.trim(), malzSinonimList(anime)[0] || null);
  }
  return malzImageUrl(anime.poster) || malzImageUrl(anime.cover);
}

>>>>>>> c5dfbd0 (Update maintennace)
export function malzToCard(anime: MalzAnime): AnimeCardItem {
  return {
    postId: anime.id,
    title: anime.judul.trim(),
    seriesTitle: anime.judul.trim(),
    slug: malzAnimeSlug(anime.id),
    url: `${MALZ_BASE_URL}/detail/${anime.id}`,
    kind: 'anime',
<<<<<<< HEAD
    poster: malzImageUrl(anime.poster) || malzImageUrl(anime.cover),
=======
    poster: malzPoster(anime),
>>>>>>> c5dfbd0 (Update maintennace)
    type: anime.tipe ? malzTypeLabel(anime.tipe) : null,
    status: anime.status ? malzStatusLabel(anime.status) : null,
    sub: 'Sub',
    episode: null,
    episodeNumber: null,
    isHot: false,
    source: 'malz',
    altTitles: malzSinonimList(anime),
    genres: splitMalzList(anime.genre),
  };
}

export function malzToQuickItem(anime: MalzAnime): QuickSearchItem {
  const card = malzToCard(anime);
  return {
    postId: anime.id,
    title: card.title,
    slug: card.slug,
    url: card.url,
    kind: 'anime',
    poster: card.poster,
    genres: splitMalzList(anime.genre),
    type: card.type,
    latestEpisode: null,
    sub: 'Sub',
    source: 'malz',
    altTitles: card.altTitles,
  };
}

export function malzToEpisodeSummary(episode: MalzEpisode): EpisodeSummary {
  return {
    number: episode.episode || null,
    title: episode.judul || `Episode ${episode.episode}`,
    date: episode.tanggal || null,
    slug: malzEpisodeSlug(episode.id),
    url: `${MALZ_BASE_URL}/stream/${episode.id}`,
  };
}

function qualityWeight(quality: string): number {
  const match = quality.match(/(\d{3,4})/);
  return match ? Number(match[1]) : 0;
}

/**
 * Server direct Malz adalah MP4 di storages.animein.net yang hanya bisa diambil
 * browser pengunjung (Cloudflare menolak permintaan server). Urutan sengaja
 * diturunkan dari kualitas tertinggi supaya pemutar memilih 1080p/720p lebih dulu.
 */
export function malzServersToMirrors(servers: MalzServer[]): MirrorServer[] {
  const usable = servers
    .filter((server) => server && server.link)
    .map((server) => {
      const label = [server.nama, server.kualitas].filter(Boolean).join(' ').trim();
      const isDirect = server.tipe === 'direct';
      const mirror: MirrorServer = {
        name: label || (isDirect ? 'Direct' : 'Embed'),
        available: true,
        type: isDirect ? (/\.m3u8(\?|$)/i.test(server.link) ? 'hls' : 'video') : 'iframe',
        url: server.link,
      };
      return { mirror, quality: qualityWeight(server.kualitas), direct: isDirect };
    });

  usable.sort((a, b) => {
    if (a.direct !== b.direct) return a.direct ? -1 : 1;
    return b.quality - a.quality;
  });

  return usable.map((entry) => entry.mirror);
}

export async function getMalzHome(limit = 24): Promise<MalzEnvelope> {
  return malzFetch<MalzEnvelope>(`/?limit=${limit}`, 600);
}

export async function getMalzRecent(limit = 60): Promise<MalzAnime[]> {
  const data = await malzFetch<MalzEnvelope>(`/recent?limit=${limit}`, 600);
  return data.items || [];
}

export async function getMalzTrending(limit = 60): Promise<MalzAnime[]> {
  const data = await malzFetch<MalzEnvelope>(`/trending?limit=${limit}`, 600);
  return data.items || [];
}

export async function getMalzSearch(
  query: string,
  page = 0,
  sort: 'views' | 'latest' | 'rating' | 'title' = 'views'
): Promise<MalzAnime[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];
  const safePage = Math.max(0, Math.trunc(page) || 0);
  const params = new URLSearchParams({ q: trimmed, page: String(safePage), sort });
  const data = await malzFetch<MalzEnvelope>(`/search?${params.toString()}`, 300);
  return data.items || [];
}

export async function getMalzDetail(id: string): Promise<MalzDetailPayload> {
  const clean = id.trim();
  if (!clean) throw new UpstreamError('ID anime Malz kosong', { status: 400 });
  const data = await malzFetch<MalzDetailPayload>(`/detail/${encodeURIComponent(clean)}`, 900);
  if (!data || !data.anime) {
    throw new UpstreamError('Anime tidak ditemukan di arsip Malz', { status: 404 });
  }
  return data;
}

export async function getMalzEpisodes(id: string, page = 0): Promise<MalzEpisodePage> {
  const clean = id.trim();
  if (!clean) throw new UpstreamError('ID anime Malz kosong', { status: 400 });
  const safePage = Math.max(0, Math.trunc(page) || 0);
  const data = await malzFetch<{ items?: MalzEpisode[]; per_halaman?: string }>(
    `/episodes/${encodeURIComponent(clean)}?page=${safePage}`,
    900
  );
  const perHalaman = Number(data.per_halaman) || 30;
  return { items: data.items || [], perHalaman };
}

export async function getMalzStream(episodeId: string): Promise<MalzStreamPayload> {
  const clean = episodeId.trim();
  if (!clean) throw new UpstreamError('ID episode Malz kosong', { status: 400 });
  const data = await malzFetch<{
    episode?: MalzEpisode | null;
    berikutnya?: MalzEpisode | null;
    servers?: MalzServer[];
    video_tersedia?: boolean;
  }>(`/stream/${encodeURIComponent(clean)}`, 600);

  return {
    episode: data.episode || null,
    berikutnya: data.berikutnya || null,
    servers: data.servers || [],
    videoTersedia: Boolean(data.video_tersedia),
  };
}
