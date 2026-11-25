import type {
  AnimeCardItem,
  PopularAnimeItem,
  QuickSearchItem,
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
 * Sebagian arsip menulis musim dengan angka Romawi ("Mushoku Tensei III")
 * sementara Hidori memakai "Season 3". Huruf tunggal (I, V, X) sengaja tidak
 * diubah karena sering muncul sebagai bagian judul, bukan angka musim.
 */
const ROMAN_SEASON: Record<string, string> = {
  ii: '2',
  iii: '3',
  iv: '4',
  vi: '6',
  vii: '7',
  viii: '8',
  ix: '9',
  xi: '11',
  xii: '12',
};

const ROMAN_SEASON_PATTERN = /\b(ii|iii|iv|vi|vii|viii|ix|xi|xii)\b/g;

/**
 * Penanda rilis/pencarian yang ditempel situs sumber di judul. Kalau tidak
 * dibuang, "BATCH Gachiakuta Subtitle Indonesia" dianggap judul berbeda dari
 * "Gachiakuta" milik arsip Malz, sehingga anime yang sama tampil dua kali
 * sebagai dua kartu (clone).
 */
const RELEASE_NOISE_TOKENS = [
  'subtitle bahasa indonesia',
  'subtitle indonesia',
  'subtitle indo',
  'sub indonesia',
  'sub indonesian',
  'sub indo',
  'batch',
  'lengkap',
  'uncensored',
  'uncut',
  'blu ray',
  'bluray',
  'bd',
  'web dl',
  'webdl',
  'web rip',
  'webrip',
  'softsub',
  'hardsub',
  'multi sub',
  '2160p',
  '1080p',
  '720p',
  '540p',
  '480p',
  '4k',
  'fhd',
];

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const RELEASE_NOISE_PATTERN = new RegExp(
  `(?:^|\\s)(?:${RELEASE_NOISE_TOKENS.map(escapeRegExp).join('|')})(?=\\s|$)`,
  'g'
);

/** Judul sumber kadang menumpuk penanda ("BATCH BATCH ..."), jadi disapu berulang. */
function stripReleaseNoise(text: string): string {
  let current = text;
  for (let pass = 0; pass < 4; pass += 1) {
    const next = current.replace(RELEASE_NOISE_PATTERN, ' ');
    if (next === current) break;
    current = next;
  }
  return current;
}

function normalize(raw: string, keepParenthetical: boolean): string {
  if (!raw) return '';
  let text = raw.toLowerCase();
  text = text.replace(/\[[^\]]*\]/g, ' ');
  text = keepParenthetical ? text.replace(/[()]/g, ' ') : text.replace(/\([^)]*\)/g, ' ');
  // Pemisah diubah jadi spasi lebih dulu supaya penanda seperti "Web-DL"
  // terbaca sebagai dua kata dan ikut tersapu.
  text = text.replace(/[^a-z0-9]+/g, ' ');
  text = stripReleaseNoise(text);
  text = text.replace(ROMAN_SEASON_PATTERN, (match) => ROMAN_SEASON[match] || match);
  text = text.replace(ORDINAL_SEASON, (_m, n: string) => `season ${n}`);
  text = text.replace(/([a-z])\1+/g, '$1');
  text = text.replace(/^the\s+/, '');
  return text.replace(/\s+/g, ' ').trim();
}

/**
 * Kunci pembanding judul antar sumber. Kedua sisi melewati transformasi yang
 * sama, jadi "Black Clover 2nd Season" sama dengan "Black Clover Season 2" dan
 * "Shippuuden" sama dengan "Shippuden". Tahun di dalam tanda kurung tetap
 * dipertahankan supaya "Berserk (1997)" tidak menelan "Berserk" (2016).
 */
export function normalizeTitle(raw: string): string {
  return normalize(raw, true);
}

/**
 * Versi longgar: isi tanda kurung dibuang. Dipakai hanya untuk mencocokkan
 * judul antar sumber, karena satu sumber sering menambahkan "(TV)" atau tahun
 * yang tidak dipakai sumber lain.
 */
export function looseTitleKey(raw: string): string {
  return normalize(raw, false);
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
    for (const normalized of [normalizeTitle(value), looseTitleKey(value)]) {
      if (normalized && normalized.length >= minLength) keys.add(normalized);
    }
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
 * Judul Hidori sering menempelkan judul Inggris di depan judul aslinya
 * ("Solo Leveling Ore dake Level Up na Ken Season 2 ...") atau menulis musim
 * yang tidak disebut arsip ("Kimetsu no Yaiba Season 4 Hashira Geiko-hen").
 *
 * Aturan pencocokan:
 * - seluruh kata judul arsip harus muncul di judul Hidori,
 * - kata tambahan tidak boleh menandai isi berbeda (part/cour/movie/special),
 * - kata tambahan hanya boleh seputar musim, dan hanya kalau arsip memang tidak
 *   menyebut angka musim sama sekali,
 * - selain itu, kata tambahan harus tercakup sinonim arsip (judul bilingual).
 *
 * Dengan begitu "Sword Art Online II" tidak ikut menelan
 * "Sword Art Online Alternative: Gun Gale Online Season 2".
 */
const SPLIT_MARKERS = new Set(['part', 'cour', 'movie', 'film', 'special', 'ova', 'ona', 'recap']);

function tokenCounts(text: string): Map<string, number> {
  const counts = new Map<string, number>();
  for (const token of text.split(' ')) {
    if (!token) continue;
    counts.set(token, (counts.get(token) || 0) + 1);
  }
  return counts;
}

function totalTokens(counts: Map<string, number>): number {
  let total = 0;
  for (const value of counts.values()) total += value;
  return total;
}

function isSameSeriesAcrossSources(item: TitleBearing, hidoriKey: string): boolean {
  const own = tokenCounts(normalizeTitle(item.title || ''));
  const hidori = tokenCounts(hidoriKey);
  const ownTotal = totalTokens(own);
  if (ownTotal < 4) return false;
  if (totalTokens(hidori) <= ownTotal) return false;

  for (const [token, count] of own) {
    if ((hidori.get(token) || 0) < count) return false;
  }

  const extra: string[] = [];
  for (const [token, count] of hidori) {
    const surplus = count - (own.get(token) || 0);
    for (let i = 0; i < surplus; i += 1) extra.push(token);
  }
  if (extra.some((token) => SPLIT_MARKERS.has(token))) return false;

  const extraDigits = extra.filter((token) => /^\d+$/.test(token));
  const extraOnlySeason = extra.every((token) => token === 'season' || /^\d+$/.test(token));
  if (extraOnlySeason) {
    if (extraDigits.length === 0) return true;
    const ownHasDigit = [...own.keys()].some((token) => /^\d+$/.test(token));
    if (!ownHasDigit) return true;
  }

  // Judul bilingual: kata tambahan harus muncul di sinonim arsip.
  const covered = new Map(own);
  for (const alt of item.altTitles || []) {
    for (const [token, count] of tokenCounts(normalizeTitle(alt))) {
      covered.set(token, Math.max(covered.get(token) || 0, count));
    }
  }
  for (const [token, count] of hidori) {
    if ((covered.get(token) || 0) < count) return false;
  }
  return true;
}

function matchesKnownAcrossSources(item: MergeableItem, keys: Set<string>): boolean {
  const primary = normalizeTitle(item.title || '');
  if (!primary) return false;
  for (const known of keys) {
    if (isSameSeriesAcrossSources(item, known)) return true;
  }
  return false;
}

interface MergeableItem extends TitleBearing {
  title: string;
  kind?: string;
  isBatch?: boolean;
}

/**
 * Postingan "BATCH ..." adalah halaman unduhan untuk seri yang sama, bukan
 * anime lain. Kalau ada kartu lain dengan judul bersih, kartu BATCH itulah
 * yang dibuang; kartu BATCH hanya dipakai kalau memang tidak ada penggantinya.
 */
function isBatchItem(item: MergeableItem): boolean {
  if (typeof item.isBatch === 'boolean') return item.isBatch;
  return /^batch\b/i.test(item.title);
}

function prefersItem<T extends MergeableItem>(candidate: T, current: T): boolean {
  const candidateBatch = isBatchItem(candidate);
  const currentBatch = isBatchItem(current);
  if (candidateBatch !== currentBatch) return !candidateBatch;
  if (candidate.kind !== current.kind) return candidate.kind === 'anime';
  return false;
}

function dedupeByTitle<T extends { title: string }>(
  items: T[],
  prefer?: (candidate: T, current: T) => boolean
): T[] {
  const slotByKey = new Map<string, number>();
  const result: T[] = [];

  for (const item of items) {
    const key = normalizeTitle(item.title);
    if (!key) {
      result.push(item);
      continue;
    }
    const slot = slotByKey.get(key);
    if (slot === undefined) {
      slotByKey.set(key, result.length);
      result.push(item);
      continue;
    }
    if (prefer && prefer(item, result[slot])) result[slot] = item;
  }

  return result;
}

/**
 * Satu sumber pun bisa memuat anime yang sama dua kali (posting seri dan
 * posting "BATCH ..."). Duplikat di dalam satu daftar dibuang lebih dulu, jadi
 * tidak ada dua kartu untuk judul yang sama.
 */
export function dedupeCards(items: AnimeCardItem[]): AnimeCardItem[] {
  return dedupeByTitle(items, prefersItem);
}

/**
 * Aturan penggabungan: entri Hidori selalu menang, kecuali saat entri itu
 * berupa posting "BATCH ..." dan arsip punya judul yang bersih. Dalam kasus
 * itu kartu BATCH dibuang dan diganti kartu arsip, karena isinya anime yang
 * sama (clone). Entri arsip yang tidak punya padanan di Hidori tetap masuk.
 */
function mergeWithArchive<T extends MergeableItem>(
  primaryItems: T[],
  archiveItems: T[],
  index: Set<string>,
  options: { limit?: number; archiveLimit?: number } = {}
): T[] {
  const merged = dedupeByTitle(primaryItems, prefersItem);
  const slotByKey = new Map<string, number>();
  merged.forEach((item, position) => {
    const key = primaryTitleKey(item);
    if (key) slotByKey.set(key, position);
  });

  // Sinonim ikut dipakai untuk mencocokkan arsip, tapi tidak untuk saling
  // menghapus sesama entri arsip (mis. "Naruto" pada sinonim film Naruto).
  const blockingKeys = buildTitleKeySet(merged, index);
  const addedPrimary = new Set<string>();
  for (const item of merged) {
    const primary = primaryTitleKey(item);
    if (primary) addedPrimary.add(primary);
  }

  let added = 0;

  for (const item of archiveItems) {
    if (options.archiveLimit !== undefined && added >= options.archiveLimit) break;

    const primary = primaryTitleKey(item);
    const slot = primary ? slotByKey.get(primary) : undefined;

    if (slot !== undefined) {
      if (isBatchItem(merged[slot]) && !isBatchItem(item)) merged[slot] = item;
      continue;
    }

    if (primary && addedPrimary.has(primary)) continue;
    if (isKnownTitle(item, blockingKeys)) continue;
    if (matchesKnownAcrossSources(item, blockingKeys)) continue;

    if (primary) {
      slotByKey.set(primary, merged.length);
      addedPrimary.add(primary);
    }
    merged.push(item);
    added += 1;
    if (options.limit && merged.length >= options.limit) break;
  }

  return options.limit ? merged.slice(0, options.limit) : merged;
}

export function mergeAnimeCards(
  hidoriItems: AnimeCardItem[],
  malzItems: AnimeCardItem[],
  index: Set<string>,
  limit?: number
): AnimeCardItem[] {
  return mergeWithArchive(hidoriItems, malzItems, index, { limit });
}

/**
 * Penggabungan untuk dropdown pencarian cepat. Bedanya, jumlah entri arsip
 * dibatasi supaya saran tetap ringkas, dan setiap entri yang lolos menandai
 * judulnya agar arsip tidak mengulang anime yang sama dua kali.
 */
export function mergeQuickSearchResults(
  hidoriItems: QuickSearchItem[],
  malzItems: QuickSearchItem[],
  index: Set<string>,
  malzLimit = 8
): QuickSearchItem[] {
  return mergeWithArchive(hidoriItems, malzItems, index, { archiveLimit: malzLimit });
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

/** Angka views/favorit Malz datang sebagai string ("39486"), kadang bertitik. */
function malzMetric(value: unknown): number {
  const n = Number(String(value ?? '').replace(/[^\d.]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

export interface MalzPopularRanking {
  /** Urutan trending dari arsip Malz, apa adanya. */
  trending: PopularAnimeItem[];
  /** Diurutkan dari jumlah favorit terbanyak. */
  favorite: PopularAnimeItem[];
  /** Diurutkan dari jumlah tontonan terbanyak. */
  mostViewed: PopularAnimeItem[];
}

/**
 * Peringkat "Top 5 populer" di beranda diambil dari arsip Malz, bukan dari
 * daftar populer Hidori. Daftar Hidori sering memuat judul yang tidak cocok
 * dengan katalog Aznime (judul salah, entri duplikat, atau anime yang tidak
 * ada di sumber lain), sedangkan Malz membawa angka views dan favorit yang
 * bisa diverifikasi. Kalau Malz tidak bisa dihubungi, pemanggil memakai
 * daftar Hidori sebagai cadangan supaya bagian ini tidak kosong.
 */
export async function getMalzPopularRanking(limit = 5): Promise<MalzPopularRanking> {
  const items = await getMalzTrending(40);
  const usable = items.filter((anime) => anime.id && (anime.judul || '').trim());

  const build = (list: MalzAnime[]): PopularAnimeItem[] =>
    list.slice(0, limit).map((anime, i) => cardToPopularItem(malzToCard(anime), i + 1));

  return {
    trending: build(usable),
    favorite: build([...usable].sort((a, b) => malzMetric(b.favorit) - malzMetric(a.favorit))),
    mostViewed: build([...usable].sort((a, b) => malzMetric(b.views) - malzMetric(a.views))),
  };
}

/**
 * Cadangan: peringkat Hidori. Kalau suatu periode belum sampai 5 judul, sisa
 * slot diisi trending Malz yang belum ada di Hidori supaya komponennya tidak
 * pernah kosong.
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
    const cards = dedupeCards(await searchMalzCards(query, toMalzPoolPage(page)));
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
