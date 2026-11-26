import type {
  AnimeCardItem,
  EpisodeSummary,
  MirrorServer,
  QuickSearchItem,
} from './scraper/types';
import { UpstreamError } from './scraper/utils';
import { isBlockedPosterHost, posterUrlWithTitleFallback } from './posters';
import { kvGet, kvSet } from './auth/redis';

export const MALZ_BASE_URL = (
  process.env.MALZ_API_BASE_URL || 'https://malz-official.com/api/v2'
).replace(/\/+$/, '');

export const MALZ_PROVIDER_LABEL = 'Arsip Malz';

/** Slug anime/eps Malz diberi awalan supaya satu rute bisa melayani dua sumber. */
export const MALZ_ANIME_SLUG_PATTERN = /^malz-(\d+)$/;
export const MALZ_EPISODE_SLUG_PATTERN = /^malz-ep-(\d+)$/;
export const MALZ_READABLE_EPISODE_SLUG_PATTERN = /^(.+)-episode-(\d+(?:\.\d+)?)$/i;

export function malzAnimeSlug(id: string, title?: string | null): string {
  const titleSlug = title ? slugifyMalzTitle(title) : '';
  return titleSlug || `malz-${id.trim()}`;
}

export function slugifyMalzTitle(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

/**
 * Slug episode yang bisa dibaca: `black-clover-episode-136`.
 * ID episode tetap dipakai untuk lookup, tetapi tidak lagi tampil di URL.
 */
export function malzEpisodeSlug(
  id: string,
  seriesTitle?: string | null,
  episodeNumber?: string | null
): string {
  const titleSlug = seriesTitle ? slugifyMalzTitle(seriesTitle) : '';
  const number = (episodeNumber || '').trim();
  if (titleSlug && /^\d+(?:\.\d+)?$/.test(number)) {
    return `${titleSlug}-episode-${number}`;
  }
  return `malz-ep-${id.trim()}`;
}

export function malzAnimeIdFromSlug(slug: string): string | null {
  const match = decodeURIComponent(slug).match(MALZ_ANIME_SLUG_PATTERN);
  return match ? match[1] : null;
}

const MALZ_ANIME_SLUG_CACHE_PREFIX = 'malz:anime-slug:';
const MALZ_ANIME_SLUG_CACHE_TTL = 60 * 60 * 24 * 90;

/** Cari anime dari daftar katalog Malz tanpa memanggil endpoint search. */
async function findMalzAnimeBySlug(titleSlug: string): Promise<MalzAnime | null> {
  const [recent, trending, home] = await Promise.all([
    getMalzRecent(100).catch(() => []),
    getMalzTrending(100).catch(() => []),
    getMalzHome(100)
      .then((data) => data.items || [])
      .catch(() => []),
  ]);
  for (const anime of [...recent, ...trending, ...home]) {
    if (slugifyMalzTitle(anime.judul) === titleSlug) return anime;
  }
  return null;
}

/**
 * Nama anime Malz bisa dipakai sebagai slug, tapi rute tetap perlu ID asli
 * untuk mengambil detail. Pencarian hanya dilakukan sekali per slug, lalu
 * hasilnya disimpan di Redis supaya request berikutnya tidak memanggil Malz.
 */
export async function resolveMalzAnimeId(slug: string): Promise<string | null> {
  const titleSlug = slugifyMalzTitle(decodeURIComponent(slug));
  if (!titleSlug) return null;
  const cacheKey = `${MALZ_ANIME_SLUG_CACHE_PREFIX}${titleSlug}`;
  try {
    const cached = await kvGet(cacheKey);
    if (cached) return cached;
  } catch {
    // Redis opsional; pencarian langsung tetap jalan.
  }

  const direct = await findMalzAnimeBySlug(titleSlug);
  if (direct) {
    try {
      await kvSet(cacheKey, direct.id, MALZ_ANIME_SLUG_CACHE_TTL);
    } catch {
      // cache opsional
    }
    return direct.id;
  }

  const words = titleSlug.split('-').filter(Boolean);
  const queries = new Set<string>([words.join(' ')]);
  for (const n of [6, 4, 3, 2]) {
    if (words.length > n) queries.add(words.slice(0, n).join(' '));
  }

  let chosen: MalzAnime | undefined;
  for (const query of queries) {
    const candidates = await getMalzSearch(query).catch(() => []);
    chosen = candidates.find((anime) => slugifyMalzTitle(anime.judul) === titleSlug);
    if (chosen) break;
  }
  if (!chosen) return null;

  try {
    await kvSet(cacheKey, chosen.id, MALZ_ANIME_SLUG_CACHE_TTL);
  } catch {
    // abaikan kegagalan cache
  }
  return chosen.id;
}

export function malzEpisodeIdFromSlug(slug: string): string | null {
  const match = decodeURIComponent(slug).match(MALZ_EPISODE_SLUG_PATTERN);
  return match ? match[1] : null;
}

export function malzReadableEpisodeFromSlug(
  slug: string
): { titleSlug: string; number: number } | null {
  const match = decodeURIComponent(slug).match(MALZ_READABLE_EPISODE_SLUG_PATTERN);
  if (!match) return null;
  const titleSlug = match[1].replace(/-+$/g, '');
  const number = Number.parseFloat(match[2]);
  if (!titleSlug || !Number.isFinite(number)) return null;
  return { titleSlug, number };
}

const MALZ_SLUG_CACHE_TTL_SECONDS = 60 * 60 * 24 * 90;

/** Cari ID episode dari slug judul, lalu simpan pemetaannya di Redis. */
export async function resolveMalzEpisodeId(slug: string): Promise<string | null> {
  const parsed = malzReadableEpisodeFromSlug(slug);
  if (!parsed) return null;

  const cacheKey = `malz:ep-slug:${slug}`;
  try {
    const cached = await kvGet(cacheKey);
    if (cached) return cached;
  } catch {
    // Redis tidak tersedia: lanjut ke pencarian.
  }

  const direct = await findMalzAnimeBySlug(parsed.titleSlug);
  const query = parsed.titleSlug.replace(/-/g, ' ');
  const candidates = direct ? [direct] : await getMalzSearch(query).catch(() => []);
  const ranked = direct
    ? [{ anime: direct, score: 2 }]
    : candidates
        .map((anime) => {
          const animeSlug = slugifyMalzTitle(anime.judul);
          const score = animeSlug === parsed.titleSlug ? 2 : 0;
          return { anime, score };
        })
        .filter((item) => item.score > 0)
        .slice(0, 3);

  for (const { anime } of ranked) {
    const firstPage = await getMalzEpisodes(anime.id, 0).catch(() => null);
    if (!firstPage) continue;
    const perPage = firstPage.perHalaman || 30;
    const maxNumber = Number.parseFloat(firstPage.items[0]?.episode || '') || 0;
    const targetPage =
      maxNumber > 0 && maxNumber >= parsed.number
        ? Math.max(0, Math.floor((maxNumber - parsed.number) / perPage))
        : 0;

    const [pageA, pageB] = await Promise.all([
      targetPage === 0 ? Promise.resolve(firstPage) : getMalzEpisodes(anime.id, targetPage).catch(() => null),
      getMalzEpisodes(anime.id, targetPage + 1).catch(() => null),
    ]);

    for (const page of [pageA, pageB]) {
      const match = page?.items.find(
        (episode) => Number.parseFloat(episode.episode) === parsed.number
      );
      if (match) {
        try {
          await kvSet(cacheKey, match.id, MALZ_SLUG_CACHE_TTL_SECONDS);
        } catch {
          // Cache opsional; URL tetap bisa dipakai.
        }
        return match.id;
      }
    }
  }

  return null;
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

export function malzToCard(anime: MalzAnime): AnimeCardItem {
  return {
    postId: anime.id,
    title: anime.judul.trim(),
    seriesTitle: anime.judul.trim(),
    slug: malzAnimeSlug(anime.id, anime.judul),
    url: `${MALZ_BASE_URL}/detail/${anime.id}`,
    kind: 'anime',
    poster: malzPoster(anime),
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

export function malzToEpisodeSummary(
  episode: MalzEpisode,
  seriesTitle?: string | null
): EpisodeSummary {
  return {
    number: episode.episode || null,
    title: episode.judul || `Episode ${episode.episode}`,
    date: episode.tanggal || null,
    slug: malzEpisodeSlug(episode.id, seriesTitle, episode.episode),
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
/**
 * Malz menyimpan berkas video dengan garis miring di dalam nama objek, sehingga
 * tautannya memakai `%2F`. Sebagian browser menormalkannya menjadi `/` dan CDN
 * membalas 400 Bad Request. Tautan video dialihkan ke proksi /api/video supaya
 * encoding asli tetap utuh. HLS tidak diproksi karena segmennya relatif.
 */
export function proxiedVideoUrl(url: string): string {
  return `/api/video?u=${encodeURIComponent(url)}`;
}

export function proxiedVideoMirrors(mirrors: MirrorServer[]): MirrorServer[] {
  return mirrors.map((mirror) =>
    mirror.type === 'video' && mirror.url ? { ...mirror, url: proxiedVideoUrl(mirror.url) } : mirror
  );
}

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

export async function getMalzMinimumEpisode(
  id: string,
  highestEpisode: number,
  perPage: number
): Promise<number | null> {
  if (!Number.isFinite(highestEpisode) || highestEpisode <= 0 || perPage <= 0) return null;

  const expectedLastPage = Math.max(0, Math.ceil(highestEpisode / perPage) - 1);
  let low = 0;
  let high = expectedLastPage;
  let lastPage = 0;

  if (expectedLastPage > 0) {
    const expectedPage = await getMalzEpisodes(id, expectedLastPage);
    if (expectedPage.items.length > 0) {
      lastPage = expectedLastPage;
      if (expectedPage.items.length >= perPage) {
        low = expectedLastPage;
        high = Math.max(expectedLastPage + 1, expectedLastPage * 2);
        let upperPage = await getMalzEpisodes(id, high);
        while (upperPage.items.length >= perPage && high < 100_000) {
          low = high;
          high *= 2;
          upperPage = await getMalzEpisodes(id, high);
        }
        if (upperPage.items.length > 0) lastPage = high;
        else {
          while (low + 1 < high) {
            const middle = Math.floor((low + high) / 2);
            const middlePage = await getMalzEpisodes(id, middle);
            if (middlePage.items.length > 0) {
              low = middle;
              lastPage = middle;
            } else {
              high = middle;
            }
          }
        }
      }
    } else {
      high = expectedLastPage;
      while (low + 1 < high) {
        const middle = Math.floor((low + high) / 2);
        const middlePage = await getMalzEpisodes(id, middle);
        if (middlePage.items.length > 0) {
          low = middle;
          lastPage = middle;
        } else {
          high = middle;
        }
      }
    }
  }

  const last = await getMalzEpisodes(id, lastPage);
  const numbers = last.items
    .map((episode) => Number(episode.episode))
    .filter((number) => Number.isFinite(number) && number > 0);
  return numbers.length > 0 ? Math.min(...numbers) : null;
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
