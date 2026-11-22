import type {
  AnimeCardItem,
  PopularAnimeItem,
  SearchResponse,
} from './scraper/types';
import { getListMode } from './scraper/anime';
import { search as searchHidori } from './scraper/search';
import {
  getMalzHome,
  getMalzRecent,
  getMalzSearch,
  getMalzTrending,
  malzToCard,
  type MalzAnime,
} from './malz';

/**
 * Halaman katalog di atas angka ini adalah segmen arsip Malz, bukan halaman
 * Hidori. Dipakai sebagai penanda supaya satu parameter `page` bisa melayani
 * dua sumber tanpa menambah parameter baru di klien infinite scroll.
 */
export const MALZ_PAGE_BASE = 900000;

export function isMalzPoolPage(page: number): boolean {
  return Number.isFinite(page) && page >= MALZ_PAGE_BASE;
}

export function toMalzPoolPage(page: number): number {
  return page - MALZ_PAGE_BASE;
}

export function toVirtualMalzPage(poolPage: number): number {
  return MALZ_PAGE_BASE + poolPage;
}

const ORDINAL_SEASON = /\b(\d+)(?:st|nd|rd|th)\s+season\b/g;

/**
 * Kunci pembanding judul antar sumber. Kedua sisi melewati transformasi yang
 * sama, jadi cukup untuk menyamakan "Black Clover 2nd Season" dengan "Black
 * Clover Season 2" dan "Shippuuden" dengan "Shippuden" tanpa menggabungkan
 * judul yang memang berbeda.
 */
export function normalizeTitle(raw: string): string {
  if (!raw) return '';
  let text = raw.toLowerCase();
  text = text.replace(/\([^)]*\)/g, ' ').replace(/\[[^\]]*\]/g, ' ');
  text = text.replace(/subtitle\s+indonesia/g, ' ').replace(/sub\s+indo(nesia)?/g, ' ');
  text = text.replace(ORDINAL_SEASON, (_m, n: string) => `season ${n}`);
  text = text.replace(/[^a-z0-9]+/g, ' ');
  text = text.replace(/([a-z])\1+/g, '$1');
  text = text.replace(/^the\s+/, '');
  return text.replace(/\s+/g, ' ').trim();
}

/**
 * Sinonim pendek seperti "BC" atau "OP" terlalu rawan menabrak judul lain, jadi
 * hanya sinonim yang cukup panjang yang ikut dibandingkan.
 */
const ALT_TITLE_MIN_LENGTH = 6;

export function titleMatchKeys(parts: TitleBearing): string[] {
  const keys = new Set<string>();
  const push = (value: string | null | undefined, minLength: number) => {
    if (!value) return;
    const normalized = normalizeTitle(value);
    if (normalized.length >= minLength) keys.add(normalized);
  };

  push(parts.title, 2);
  push(parts.seriesTitle, 2);
  for (const alt of parts.altTitles || []) push(alt, ALT_TITLE_MIN_LENGTH);

  return [...keys];
}

export function primaryTitleKey(parts: TitleBearing): string {
  return normalizeTitle(parts.title || parts.seriesTitle || '');
}

interface TitleIndex {
  keys: Set<string>;
  expiresAt: number;
}

let hidoriIndex: TitleIndex | null = null;
const HIDORI_INDEX_TTL_MS = 30 * 60 * 1000;

/**
 * Indeks judul Hidori dipanen dari halaman daftar A-Z: satu permintaan untuk
 * seluruh katalog, jadi pemeriksaan "sudah ada di Hidori" tidak perlu mencari
 * per judul ke server sumber.
 */
export async function getHidoriTitleIndex(): Promise<Set<string>> {
  if (hidoriIndex && Date.now() < hidoriIndex.expiresAt) return hidoriIndex.keys;

  try {
    const list = await getListMode();
    const keys = new Set<string>();
    for (const entries of Object.values(list.groups)) {
      for (const entry of entries) {
        for (const key of titleMatchKeys({ title: entry.title })) keys.add(key);
      }
    }
    hidoriIndex = { keys, expiresAt: Date.now() + HIDORI_INDEX_TTL_MS };
    return keys;
  } catch {
    return new Set<string>();
  }
}

export function buildTitleKeySet(items: TitleBearing[], index: Set<string>): Set<string> {
  const keys = new Set(index);
  for (const item of items) {
    for (const key of titleMatchKeys(item)) keys.add(key);
  }
  return keys;
}

export interface TitleBearing {
  title?: string | null;
  seriesTitle?: string | null;
  altTitles?: string[] | null;
}

export function isKnownTitle(item: TitleBearing, keys: Set<string>): boolean {
  return titleMatchKeys(item).some((key) => keys.has(key));
}

/**
 * Aturan penggabungan: entri Hidori selalu menang. Entri Malz hanya muncul
 * kalau judulnya belum ada di Hidori, sehingga Naruto dari Malz tidak
 * menghasilkan dua kartu Naruto.
 */
export function mergeAnimeCards(
  hidoriItems: AnimeCardItem[],
  malzItems: AnimeCardItem[],
  index: Set<string>,
  limit?: number
): AnimeCardItem[] {
  const hidoriKeys = buildTitleKeySet(hidoriItems, index);
  const merged = [...hidoriItems];

  // Hanya judul utama yang diingat dari hasil gabungan. Sinonim ikut dipakai
  // untuk mencocokkan Hidori, tapi tidak untuk saling menghapus sesama entri
  // arsip (mis. "Naruto" pada sinonim beberapa film Naruto).
  const addedPrimary = new Set<string>();
  for (const item of merged) addedPrimary.add(primaryTitleKey(item));

  for (const item of malzItems) {
    if (isKnownTitle(item, hidoriKeys)) continue;
    const primary = primaryTitleKey(item);
    if (addedPrimary.has(primary)) continue;
    addedPrimary.add(primary);
    merged.push(item);
    if (limit && merged.length >= limit) break;
  }

  return limit ? merged.slice(0, limit) : merged;
}

let archivePool: { value: AnimeCardItem[]; expiresAt: number } | null = null;
const ARCHIVE_POOL_TTL_MS = 10 * 60 * 1000;

async function collectMalzCandidates(): Promise<MalzAnime[]> {
  const byId = new Map<string, MalzAnime>();
  const add = (items: MalzAnime[] | undefined) => {
    for (const item of items || []) {
      if (item?.id && !byId.has(item.id)) byId.set(item.id, item);
    }
  };

  const [home, recent, trending] = await Promise.allSettled([
    getMalzHome(60),
    getMalzRecent(60),
    getMalzTrending(60),
  ]);

  if (home.status === 'fulfilled') {
    const payload = home.value;
    add(payload.populer);
    add(payload.hangat);
    add(payload.baru);
    add(payload.acak);
    add(payload.tunggu);
    add(payload.items);
  }
  if (recent.status === 'fulfilled') add(recent.value);
  if (trending.status === 'fulfilled') add(trending.value);

  return [...byId.values()];
}

/**
 * Kumpulan judul Malz yang belum ada di Hidori. Dipakai halaman beranda dan
 * sebagai segmen terakhir katalog, karena API Malz tidak punya endpoint
 * "jelajahi semua" yang berhalaman.
 */
export async function getMalzArchivePool(): Promise<AnimeCardItem[]> {
  if (archivePool && Date.now() < archivePool.expiresAt) return archivePool.value;

  try {
    const [candidates, index] = await Promise.all([collectMalzCandidates(), getHidoriTitleIndex()]);
    const cards = candidates.map(malzToCard);
    const hidoriKeys = new Set(index);
    const addedPrimary = new Set<string>();
    const pool: AnimeCardItem[] = [];

    for (const card of cards) {
      if (isKnownTitle(card, hidoriKeys)) continue;
      const primary = primaryTitleKey(card);
      if (addedPrimary.has(primary)) continue;
      addedPrimary.add(primary);
      pool.push(card);
    }

    archivePool = { value: pool, expiresAt: Date.now() + ARCHIVE_POOL_TTL_MS };
    return pool;
  } catch {
    return [];
  }
}

export async function getMalzTrendingCards(limit = 20): Promise<AnimeCardItem[]> {
  try {
    const items = await getMalzTrending(Math.max(limit, 20));
    return items.map(malzToCard);
  } catch {
    return [];
  }
}

export async function searchMalzCards(query: string, page = 0): Promise<AnimeCardItem[]> {
  try {
    const items = await getMalzSearch(query, page, 'views');
    return items.map(malzToCard);
  } catch {
    return [];
  }
}

export interface SupplementFilters {
  status?: string;
  type?: string;
  genres?: string[];
}

function matchesFilters(card: AnimeCardItem, filters: SupplementFilters): boolean {
  if (filters.status && (card.status || '').toLowerCase() !== filters.status.toLowerCase()) {
    return false;
  }
  if (filters.type && (card.type || '').toLowerCase() !== filters.type.toLowerCase()) {
    return false;
  }
  return true;
}

/**
 * Halaman berstatus (ongoing/completed) hanya berisi Hidori karena arsip Malz
 * tidak punya endpoint filter. Judul arsip yang statusnya cocok ditambahkan di
 * halaman pertama saja supaya daftar tetap terasa lengkap tanpa mengubah
 * paginasi Hidori.
 */
export async function supplementWithArchive(
  items: AnimeCardItem[],
  filters: SupplementFilters,
  limit = 24
): Promise<AnimeCardItem[]> {
  if (filters.genres && filters.genres.length > 0) return items;

  const pool = await getMalzArchivePool();
  if (pool.length === 0) return items;

  const index = await getHidoriTitleIndex();
  const candidates = pool.filter((card) => matchesFilters(card, filters)).slice(0, limit);
  return mergeAnimeCards(items, candidates, index);
}

export function archiveByStatus(
  pool: AnimeCardItem[],
  status: string,
  limit = 14
): AnimeCardItem[] {
  return pool
    .filter((card) => (card.status || '').toLowerCase() === status.toLowerCase())
    .slice(0, limit);
}

export function cardToPopularItem(card: AnimeCardItem, rank: number): PopularAnimeItem {
  return {
    rank,
    source: card.source,
    postId: card.postId,
    title: card.title,
    slug: card.slug,
    url: card.url,
    poster: card.poster,
    genres: card.genres || [],
  };
}

/**
 * Peringkat populer tetap milik Hidori karena angkanya berasal dari sana. Kalau
 * suatu periode belum sampai 5 judul, sisa slot diisi trending Malz yang belum
 * ada di Hidori supaya komponennya tidak pernah kosong.
 */
export async function topUpPopularRanking(periods: PopularAnimeItem[]): Promise<PopularAnimeItem[]> {
  if (periods.length >= 5) return periods.slice(0, 5);

  const trending = await getMalzTrendingCards(30);
  const keys = buildTitleKeySet(periods, new Set());
  const result = [...periods];

  for (const card of trending) {
    if (result.length >= 5) break;
    if (isKnownTitle(card, keys)) continue;
    keys.add(primaryTitleKey(card));
    result.push(cardToPopularItem(card, result.length + 1));
  }

  return result;
}

const MALZ_SEARCH_PAGE_SIZE = 60;

/**
 * Pencarian lintas sumber: hasil Hidori selalu di depan, lalu judul arsip yang
 * belum ada di Hidori. Kalau Hidori kehabisan halaman tapi arsip masih punya
 * hasil, penanda halaman virtual dipakai supaya infinite scroll berlanjut.
 */
export async function searchAcrossSources(query: string, page = 1): Promise<SearchResponse> {
  if (isMalzPoolPage(page)) {
    const cards = await searchMalzCards(query, toMalzPoolPage(page));
    const hasNextPage = cards.length >= MALZ_SEARCH_PAGE_SIZE;
    return {
      query,
      pagination: {
        currentPage: page,
        totalPages: null,
        hasNextPage,
        hasPrevPage: true,
        nextPage: hasNextPage ? page + 1 : null,
        prevPage: page - 1,
      },
      results: cards,
    };
  }

  const data = await searchHidori(query, page);
  const archiveCards = page === 1 ? await searchMalzCards(query, 0) : [];
  const index = await getHidoriTitleIndex();
  const results = mergeAnimeCards(data.results, archiveCards, index);

  if (data.pagination.hasNextPage) {
    return { query, pagination: data.pagination, results };
  }

  const archiveHasMore = archiveCards.length >= MALZ_SEARCH_PAGE_SIZE;
  return {
    query,
    pagination: archiveHasMore
      ? { ...data.pagination, hasNextPage: true, nextPage: toVirtualMalzPage(1) }
      : data.pagination,
    results,
  };
}
