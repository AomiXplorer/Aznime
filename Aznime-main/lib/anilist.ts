import { createHash } from 'node:crypto';
import type { AniListTrailer } from './scraper/types';
import { isRedisConfigured, redisCommand } from './auth/redis';

const ANILIST_ENDPOINT = 'https://graphql.anilist.co';

interface AniListGraphQLResponse {
  data?: {
    Media?: {
      id?: number;
      title?: {
        romaji?: string | null;
        english?: string | null;
        native?: string | null;
      } | null;
      bannerImage?: string | null;
      trailer?: {
        id?: string | null;
        site?: string | null;
        thumbnail?: string | null;
      } | null;
    } | null;
  };
}

const trailerCache = new Map<string, { value: AniListTrailer | null; expiresAt: number }>();

export function cleanAnimeTitleForMatch(rawTitle: string): string {
  return rawTitle
    .replace(/\bsubtitle\s+indonesia\b/gi, '')
    .replace(/\bsub\s+indo\b/gi, '')
    .replace(/\[[^\]]*\]/g, '')
    .replace(/\(\s*(tv|movie|special|dub|sub|bd|bluray|uncensored|ova|ona)\s*\)/gi, '')
    .replace(/\b(bd|bluray|uncensored)\b/gi, '')
    .replace(/\(\s*\)/g, '')
    .replace(/\s+episode\s+\d+.*$/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function buildTitleCandidates(title: string, altTitle?: string | null): string[] {
  const candidates: string[] = [];
  const pushUnique = (val: string | null | undefined) => {
    if (!val) return;
    const cleaned = cleanAnimeTitleForMatch(val);
    if (cleaned.length >= 2 && !candidates.includes(cleaned)) {
      candidates.push(cleaned);
    }
  };

  pushUnique(title);
  if (altTitle) {
    for (const part of altTitle.split(/[,/|;]/)) {
      pushUnique(part);
    }
  }
  // Fallback without "Season X" suffix if needed
  const baseCleaned = cleanAnimeTitleForMatch(title);
  const withoutSeason = baseCleaned.replace(/\bseason\s+\d+\b/gi, '').replace(/\s+/g, ' ').trim();
  if (withoutSeason.length >= 2 && !candidates.includes(withoutSeason)) {
    candidates.push(withoutSeason);
  }

  // Fallback stripping "Movie:" / "-hen" (e.g., "Chainsaw Man Movie: Reze-hen" -> "Chainsaw Man Reze")
  const movieNormalized = baseCleaned
    .replace(/\bmovie\b\s*:?/gi, ' ')
    .replace(/-hen\b/gi, '')
    .replace(/[:–—-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (movieNormalized.length >= 2 && !candidates.includes(movieNormalized)) {
    candidates.push(movieNormalized);
  }

  return candidates;
}

const MEDIA_TRAILER_QUERY = `
query ($search: String) {
  Media(search: $search, type: ANIME, sort: SEARCH_MATCH) {
    id
    title {
      romaji
      english
      native
    }
    bannerImage
    trailer {
      id
      site
      thumbnail
    }
  }
}
`;

async function queryAniListMedia(searchTerm: string): Promise<AniListTrailer | null> {
  try {
    const res = await fetch(ANILIST_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        query: MEDIA_TRAILER_QUERY,
        variables: { search: searchTerm },
      }),
      signal: AbortSignal.timeout(5000),
      next: { revalidate: 43200 },
    });

    if (!res.ok) return null;
    const json = (await res.json()) as AniListGraphQLResponse;
    const media = json.data?.Media;
    if (!media) return null;

    const trailer = media.trailer;
    if (!trailer?.id || !trailer?.site) {
      if (!media.bannerImage) return null;
      return {
        id: '',
        site: '',
        thumbnail: null,
        bannerImage: media.bannerImage,
        matchedTitle: media.title?.english || media.title?.romaji || null,
      };
    }

    const site = trailer.site.toLowerCase();
    const thumbnail =
      trailer.thumbnail ||
      (site === 'youtube' ? `https://i.ytimg.com/vi/${trailer.id}/hqdefault.jpg` : null);

    return {
      id: trailer.id,
      site,
      thumbnail,
      bannerImage: media.bannerImage || null,
      matchedTitle: media.title?.english || media.title?.romaji || null,
    };
  } catch {
    return null;
  }
}

export async function getAniListTrailer(
  title: string,
  altTitle?: string | null
): Promise<AniListTrailer | null> {
  const candidates = buildTitleCandidates(title, altTitle);
  if (candidates.length === 0) return null;

  const cacheKey = candidates[0].toLowerCase();
  const cached = trailerCache.get(cacheKey);
  if (cached && Date.now() < cached.expiresAt) {
    return cached.value;
  }

  let bestBannerOnly: AniListTrailer | null = null;

  for (const candidate of candidates.slice(0, 3)) {
    const result = await queryAniListMedia(candidate);
    if (result?.id && result.site === 'youtube') {
      trailerCache.set(cacheKey, {
        value: result,
        expiresAt: Date.now() + 12 * 60 * 60 * 1000,
      });
      return result;
    }
    if (result?.id && !bestBannerOnly) {
      bestBannerOnly = result;
    } else if (result?.bannerImage && !bestBannerOnly) {
      bestBannerOnly = result;
    }
  }

  trailerCache.set(cacheKey, {
    value: bestBannerOnly,
    expiresAt: Date.now() + 6 * 60 * 60 * 1000,
  });
  return bestBannerOnly;
}

/* ------------------------------------------------------------------ *
 * Cover art                                                          *
 *                                                                    *
 * Poster arsip Malz dilayani Cloudflare dengan blokir bot, jadi      *
 * server tidak bisa mengambilnya dan browser hanya menerima halaman  *
 * "Sorry, you have been blocked". AniList menyediakan cover resmi    *
 * yang bisa diambil dari mana saja, dan sudah dipakai untuk trailer. *
 * ------------------------------------------------------------------ */

interface AniListCoverResponse {
  data?: {
    Media?: {
      title?: {
        romaji?: string | null;
        english?: string | null;
        native?: string | null;
      } | null;
      coverImage?: {
        extraLarge?: string | null;
        large?: string | null;
        color?: string | null;
      } | null;
    } | null;
  };
}

const MEDIA_COVER_QUERY = `
query ($search: String) {
  Media(search: $search, type: ANIME, sort: SEARCH_MATCH) {
    title {
      romaji
      english
      native
    }
    coverImage {
      extraLarge
      large
    }
  }
}
`;

const coverCache = new Map<string, { value: string | null; expiresAt: number }>();
const COVER_TTL_MS = 12 * 60 * 60 * 1000;
/** Judul tanpa padanan di-cache sebentar: jangan kunci selamanya karena satu kali 429. */
const COVER_MISS_TTL_MS = 3 * 60 * 1000;

/** Huruf kecil, tanpa tanda baca, spasi tunggal: "Re:Zero 2nd Season" -> "re zero 2 season". */
export function normalizeTitleForMatch(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\b(\d+)(?:st|nd|rd|th)\b/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

function titleWords(raw: string): string[] {
  const normalized = normalizeTitleForMatch(raw);
  return normalized ? normalized.split(' ') : [];
}

function withoutSeasonWord(words: string[]): string[] {
  return words.filter((word) => word !== 'season' && word !== 'seasons');
}

/**
 * AniList selalu menjawab pencarian dengan sesuatu, jadi hasilnya harus
 * dibandingkan dulu. Tanpa ini, "One Piece" bisa berakhir dengan cover
 * anime lain yang kebetulan paling dekat.
 *
 * Tiga bentuk diterima: judul sama persis, judul sumber adalah awalan judul
 * AniList (AniList sering menambahkan subjudul panjang pada seri yang sama),
 * atau kemiripan kata cukup tinggi.
 */
export function titlesMatch(requested: string, candidate: string): boolean {
  const requestedWords = titleWords(requested);
  const candidateWords = titleWords(candidate);
  if (requestedWords.length === 0 || candidateWords.length === 0) return false;

  if (requestedWords.join(' ') === candidateWords.join(' ')) return true;

  const left = withoutSeasonWord(requestedWords);
  const right = withoutSeasonWord(candidateWords);
  if (
    left.length >= 2 &&
    left.length <= right.length &&
    left.every((word, index) => word === right[index])
  ) {
    return true;
  }

  const wordsA = new Set(requestedWords.filter((word) => word.length > 1));
  const wordsB = new Set(candidateWords.filter((word) => word.length > 1));
  if (wordsA.size === 0 || wordsB.size === 0) return false;

  let shared = 0;
  for (const word of wordsA) {
    if (wordsB.has(word)) shared += 1;
  }
  const union = wordsA.size + wordsB.size - shared;
  return union > 0 && shared / union >= 0.6;
}

/* AniList membatasi 90 permintaan per menit per IP, dan satu kunjungan katalog
   bisa meminta puluhan cover sekaligus. Antrean ini menjaga jarak antar
   permintaan supaya tidak ada burst yang dijawab 429. */
const ANILIST_MIN_GAP_MS = 90;
let anilistChain: Promise<unknown> = Promise.resolve();
let anilistLastCall = 0;

function pacedAniList<T>(run: () => Promise<T>): Promise<T> {
  const next = anilistChain.then(async () => {
    const wait = ANILIST_MIN_GAP_MS - (Date.now() - anilistLastCall);
    if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
    anilistLastCall = Date.now();
    return run();
  });
  anilistChain = next.catch(() => undefined);
  return next;
}

async function queryAniListCover(searchTerm: string, attempt = 0): Promise<string | null> {
  try {
    const res = await pacedAniList(() =>
      fetch(ANILIST_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          query: MEDIA_COVER_QUERY,
          variables: { search: searchTerm },
        }),
        signal: AbortSignal.timeout(5000),
        next: { revalidate: 604800 },
      })
    );

    /* AniList membatasi 90 permintaan per menit. Satu halaman katalog bisa
       meminta puluhan cover sekaligus, jadi 429 diulang sekali setelah jeda
       yang diminta server, bukan langsung dianggap "tidak ada cover". */
    if (res.status === 429 && attempt < 3) {
      const retryAfter = Number(res.headers.get('retry-after'));
      const base = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 800;
      await new Promise((resolve) => setTimeout(resolve, Math.min(2500, base * (attempt + 1))));
      return queryAniListCover(searchTerm, attempt + 1);
    }

    if (!res.ok) return null;
    const json = (await res.json()) as AniListCoverResponse;
    const media = json.data?.Media;
    if (!media) return null;

    const titles = [media.title?.english, media.title?.romaji, media.title?.native].filter(
      (value): value is string => Boolean(value)
    );
    const accepted = titles.some((title) => titlesMatch(searchTerm, title));
    if (!accepted) return null;

    return media.coverImage?.extraLarge || media.coverImage?.large || null;
  } catch {
    return null;
  }
}

/**
 * Cover AniList untuk satu judul. Null berarti tidak ada yang cukup mirip,
 * bukan berarti AniList sedang mati: pemanggil sebaiknya mempertahankan
 * poster aslinya sebagai jalan terakhir.
 */
export async function getAniListCover(
  title: string,
  altTitle?: string | null
): Promise<string | null> {
  const candidates = buildTitleCandidates(title, altTitle);
  if (candidates.length === 0) return null;

  const cacheKey = candidates[0].toLowerCase();
  const cached = coverCache.get(cacheKey);
  if (cached && Date.now() < cached.expiresAt) return cached.value;

  /* Cache di Redis membuat cover hanya dicari sekali untuk semua instance
     server, bukan sekali per instance setelah cold start. */
  const stored = await readStoredCover(cacheKey);
  if (stored !== undefined) {
    coverCache.set(cacheKey, {
      value: stored,
      expiresAt: Date.now() + (stored ? COVER_TTL_MS : COVER_MISS_TTL_MS),
    });
    return stored;
  }

  let cover: string | null = null;
  for (const candidate of candidates.slice(0, 3)) {
    cover = await queryAniListCover(candidate);
    if (cover) break;
  }

  coverCache.set(cacheKey, {
    value: cover,
    expiresAt: Date.now() + (cover ? COVER_TTL_MS : COVER_MISS_TTL_MS),
  });
  await storeCover(cacheKey, cover);
  return cover;
}

function coverRedisKey(cacheKey: string): string {
  return `aznime:cover:${createHash('sha1').update(cacheKey).digest('hex')}`;
}

/** undefined = belum pernah disimpan; null = sudah dicari dan tidak ada. */
async function readStoredCover(cacheKey: string): Promise<string | null | undefined> {
  if (!isRedisConfigured()) return undefined;
  try {
    const value = await redisCommand<string | null>('GET', coverRedisKey(cacheKey));
    if (value === null || value === undefined) return undefined;
    return value === '-' ? null : value;
  } catch {
    return undefined;
  }
}

async function storeCover(cacheKey: string, cover: string | null): Promise<void> {
  if (!isRedisConfigured()) return;
  try {
    await redisCommand(
      'SET',
      coverRedisKey(cacheKey),
      cover || '-',
      'EX',
      cover ? 60 * 60 * 24 * 30 : 60 * 60 * 6
    );
  } catch {
    // Cache bersama bersifat bonus: kegagalannya tidak boleh memecahkan poster.
  }
}
