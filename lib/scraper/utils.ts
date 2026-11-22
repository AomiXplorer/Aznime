import * as cheerio from 'cheerio';
import type { CheerioAPI } from 'cheerio';
import type { AnyNode } from 'domhandler';
import type {
  AnimeCardItem,
  DownloadBox,
  DownloadLink,
  DownloadQuality,
  LinkKind,
  MirrorServer,
  PaginationInfo,
} from './types';

export const BASE_URL =
  process.env.HIDORISTREAM_BASE_URL?.replace(/\/+$/, '') || 'https://v10.hidoristream.online';

export const DEFAULT_UA =
  'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36';

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

const MEMORY_CACHE_MAX = 250;
const memoryCache = new Map<string, CacheEntry<string>>();

function getCachedText(key: string): string | null {
  const entry = memoryCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    memoryCache.delete(key);
    return null;
  }
  return entry.value;
}

function setCachedText(key: string, value: string, ttlSeconds: number): void {
  if (ttlSeconds <= 0) return;
  if (memoryCache.size >= MEMORY_CACHE_MAX) {
    const oldestKey = memoryCache.keys().next().value;
    if (oldestKey) memoryCache.delete(oldestKey);
  }
  memoryCache.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
}

export interface RequestOptions {
  method?: 'GET' | 'POST';
  headers?: Record<string, string>;
  body?: string;
  timeoutMs?: number;
  revalidate?: number;
}

export class UpstreamError extends Error {
  status?: number;
  url?: string;
  isNotFound: boolean;

  constructor(message: string, options: { status?: number; url?: string } = {}) {
    super(message);
    this.name = 'UpstreamError';
    this.status = options.status;
    this.url = options.url;
    this.isNotFound = options.status === 404 || options.status === 410;
  }
}

export function looksLikeChallengePage(body: string): boolean {
  const sample = body.slice(0, 4096).toLowerCase();
  if (!sample.trim()) return true;
  return (
    sample.includes('<title>just a moment...</title>') ||
    sample.includes('attention required! | cloudflare') ||
    sample.includes('cf-browser-verification') ||
    sample.includes('enable javascript and cookies to continue')
  );
}

export async function requestText(
  targetUrl: string,
  options: RequestOptions = {}
): Promise<{ status: number; url: string; body: string }> {
  const fullUrl = targetUrl.startsWith('http')
    ? targetUrl
    : `${BASE_URL}${targetUrl.startsWith('/') ? '' : '/'}${targetUrl}`;

  const method = options.method || 'GET';
  const ttl = options.revalidate ?? (method === 'GET' ? 180 : 0);
  const cacheKey = `${method}:${fullUrl}:${options.body || ''}`;

  if (ttl > 0 && method === 'GET') {
    const cached = getCachedText(cacheKey);
    if (cached !== null) {
      return { status: 200, url: fullUrl, body: cached };
    }
  }

  const headers: Record<string, string> = {
    'User-Agent': DEFAULT_UA,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,application/json,*/*;q=0.8',
    'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
    Referer: `${BASE_URL}/`,
    ...options.headers,
  };

  let res: Response;
  try {
    res = await fetch(fullUrl, {
      method,
      headers,
      body: options.body,
      redirect: 'follow',
      signal: AbortSignal.timeout(options.timeoutMs ?? 15000),
      next: ttl > 0 ? { revalidate: ttl } : { revalidate: 0 },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Network error';
    throw new UpstreamError(`Gagal terhubung ke server sumber (${msg})`, { url: fullUrl });
  }

  const body = await res.text();
  if (res.status >= 400) {
    throw new UpstreamError(`Upstream HTTP ${res.status} fetching ${res.url || fullUrl}`, {
      status: res.status,
      url: res.url || fullUrl,
    });
  }

  if (ttl > 0 && method === 'GET' && body.length > 0 && !looksLikeChallengePage(body)) {
    setCachedText(cacheKey, body, ttl);
  }

  return {
    status: res.status,
    url: res.url || fullUrl,
    body,
  };
}

export async function fetchHtml(
  urlOrPath: string,
  revalidate = 180
): Promise<{ $: CheerioAPI; url: string }> {
  const res = await requestText(urlOrPath, { method: 'GET', revalidate });
  if (looksLikeChallengePage(res.body)) {
    throw new UpstreamError(
      'Server sumber mengembalikan halaman verifikasi atau respons kosong sementara.',
      { status: 503, url: res.url }
    );
  }
  return { $: cheerio.load(res.body), url: res.url };
}

export function isSafeHttpUrl(url: string | null | undefined): url is string {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

const BASE_HOST = (() => {
  try {
    return new URL(BASE_URL).hostname;
  } catch {
    return 'v10.hidoristream.online';
  }
})();

export function normalizeUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  let clean = url.trim();
  if (!clean) return null;
  if (clean.startsWith('//')) clean = `https:${clean}`;
  if (
    clean.startsWith('http://v10.hidoristream.online') ||
    clean.startsWith(`http://${BASE_HOST}`)
  ) {
    clean = clean.replace('http://', 'https://');
  }
  if (!isSafeHttpUrl(clean)) return null;
  return clean;
}

export function extractSlug(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const pathname = new URL(url, BASE_URL).pathname.replace(/^\/+|\/+$/g, '');
    const parts = pathname.split('/').filter(Boolean);
    if (!parts.length) return null;
    const raw = parts[parts.length - 1];
    try {
      return decodeURIComponent(raw);
    } catch {
      return raw;
    }
  } catch {
    return url.replace(/^\/+|\/+$/g, '') || null;
  }
}

export function inferLinkKind(url: string | null | undefined): LinkKind {
  if (!url) return 'anime';
  return url.includes('/anime/') ? 'anime' : 'episode';
}

export function resolveAnimeUrl(slugOrUrl: string): string {
  if (!slugOrUrl) throw new Error('Anime slug or URL is required');
  if (slugOrUrl.startsWith('http')) return slugOrUrl;
  const decoded = safeDecodeSlug(slugOrUrl);
  const clean = decoded.replace(/^\/+|\/+$/g, '').replace(/^anime\//, '');
  return `${BASE_URL}/anime/${encodeURIComponent(clean)}/`;
}

export function resolvePostUrl(slugOrUrl: string): string {
  if (!slugOrUrl) throw new Error('Episode slug or URL is required');
  if (slugOrUrl.startsWith('http')) return slugOrUrl;
  const decoded = safeDecodeSlug(slugOrUrl);
  const clean = decoded.replace(/^\/+|\/+$/g, '');
  return `${BASE_URL}/${encodeURIComponent(clean)}/`;
}

function safeDecodeSlug(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export function parseImgSrc($: CheerioAPI, container: AnyNode | string): string | null {
  const root = $(container);
  const img = root.find('img').not('noscript img').first();
  const candidates = [img.attr('data-src'), img.attr('data-lazy-src'), img.attr('src')];

  for (const candidate of candidates) {
    if (candidate && !candidate.startsWith('data:image/svg+xml')) {
      const normalized = normalizeUrl(candidate);
      if (normalized) return normalized;
    }
  }

  const noscriptHtml = root.find('noscript').first().html();
  if (noscriptHtml) {
    const $ns = cheerio.load(noscriptHtml);
    const nsSrc = $ns('img').attr('src');
    if (nsSrc) {
      const normalized = normalizeUrl(nsSrc);
      if (normalized) return normalized;
    }
  }

  return null;
}

/**
 * Judul Hidori membawa penanda rilis di teksnya ("BATCH Gachiakuta Subtitle
 * Indonesia"). Penanda itu tidak berguna di UI dan membuat anime yang sama
 * terlihat berbeda dari sumber lain, jadi dibuang dari judul tampilan.
 */
export function cleanAnimeTitle(raw: string): string {
  if (!raw) return '';
  let text = raw.replace(/\s+/g, ' ').trim();
  text = text.replace(/^(?:batch|full\s+batch|batch\s+anime)\s+/i, '');
  text = text.replace(/\s*[-–—]\s*batch$/i, '');
  return text.replace(/\s+/g, ' ').trim();
}

export function parseAnimeCard($: CheerioAPI, article: AnyNode): AnimeCardItem {
  const $article = $(article);
  const $a = $article.find('.bsx > a').first();
  const url = normalizeUrl($a.attr('href'));
  const rawTitle = ($a.attr('title') || $article.find('.tt, .eggtitle').first().text()).trim();
  const seriesTitle =
    $article.find('.eggtitle').text().trim() ||
    $article.find('.tt').clone().children().remove().end().text().trim() ||
    rawTitle;
  const episodeText = $article.find('.eggepisode, .bt .epx').first().text().trim() || null;
  const epMatch = episodeText ? episodeText.match(/(\d+(?:\.\d+)?)/) : null;
  const type = $article.find('.eggtype, .typez').first().text().trim() || null;
  const status = $article.find('.status').first().text().trim() || null;
  const sub = $article.find('.sb').first().text().trim() || null;
  const isHot = $article.find('.hotbadge').length > 0;
  const postId = $a.attr('rel') || null;
  const poster = parseImgSrc($, article);
  const isBatch = /^batch\b/i.test(rawTitle);

  return {
    postId,
    title: cleanAnimeTitle(rawTitle),
    seriesTitle: cleanAnimeTitle(seriesTitle),
    slug: extractSlug(url),
    url,
    kind: inferLinkKind(url),
    poster,
    type,
    status,
    sub,
    episode: episodeText,
    episodeNumber: epMatch ? parseFloat(epMatch[1]) : null,
    isHot,
    source: 'hidori',
    isBatch,
  };
}

export function parsePagination($: CheerioAPI, currentPage = 1): PaginationInfo {
  const nextHref = $('.hpage a.r, .pagination a.next').first().attr('href') || null;
  const prevHref = $('.hpage a.l, .pagination a.prev').first().attr('href') || null;

  let totalPages: number | null = null;
  $('.pagination .page-numbers').each((_, el) => {
    const n = parseInt($(el).text().trim(), 10);
    if (!Number.isNaN(n) && (totalPages === null || n > totalPages)) {
      totalPages = n;
    }
  });

  const extractPageNum = (href: string | null): number | null => {
    if (!href) return null;
    const m1 = href.match(/\/page\/(\d+)/);
    if (m1) return parseInt(m1[1], 10);
    const m2 = href.match(/[?&]page=(\d+)/);
    if (m2) return parseInt(m2[1], 10);
    return null;
  };

  return {
    currentPage,
    totalPages,
    hasNextPage: Boolean(nextHref),
    hasPrevPage: Boolean(prevHref),
    nextPage: extractPageNum(nextHref) || (nextHref ? currentPage + 1 : null),
    prevPage: extractPageNum(prevHref) || (prevHref && currentPage > 1 ? currentPage - 1 : null),
  };
}

export function parseDownloadBoxes($: CheerioAPI): DownloadBox[] {
  const boxes: DownloadBox[] = [];

  $('.soraddlx').each((_, box) => {
    const title = $(box).find('.sorattlx h3, .sorattlx').first().text().trim();
    const qualities: DownloadQuality[] = [];

    $(box)
      .find('.soraurlx')
      .each((_, row) => {
        const quality = $(row).find('strong').first().text().trim();
        const links: DownloadLink[] = [];

        $(row)
          .find('a')
          .each((_, a) => {
            const host = $(a).text().trim();
            const href = normalizeUrl($(a).attr('href'));
            if (href) {
              links.push({ host: host || 'Download', url: href });
            }
          });

        if (quality || links.length) {
          qualities.push({ quality: quality || 'Unknown', links });
        }
      });

    if (title || qualities.length) {
      boxes.push({ title: title || 'Unduh Episode', qualities });
    }
  });

  return boxes;
}

export function decodeMirrorOption(name: string, encodedValue: string): MirrorServer {
  let decodedHtml = '';
  try {
    decodedHtml = Buffer.from(encodedValue, 'base64').toString('utf8').trim();
  } catch {
    decodedHtml = encodedValue;
  }

  const $m = cheerio.load(decodedHtml);
  const iframeSrc = normalizeUrl($m('iframe').attr('src') || $m('iframe').attr('data-src'));
  const videoSrc = normalizeUrl($m('video source').attr('src') || $m('video').attr('src'));

  if (iframeSrc) {
    return {
      name: name.trim(),
      available: true,
      type: 'iframe',
      url: iframeSrc,
    };
  }

  if (videoSrc) {
    const isHls = /\.m3u8(\?|$)/i.test(videoSrc);
    return {
      name: name.trim(),
      available: true,
      type: isHls ? 'hls' : 'video',
      url: videoSrc,
    };
  }

  const msg = $m.text().trim() || 'Server tidak tersedia';
  return {
    name: name.trim(),
    available: false,
    type: 'unavailable',
    url: null,
    message: msg,
  };
}
