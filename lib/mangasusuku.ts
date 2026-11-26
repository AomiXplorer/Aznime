import type { ComicCard } from './comics';
import { UpstreamError } from './scraper/utils';

/**
 * Sumber keempat Aznime: MangaSusuku, dibaca lewat API publik Sanka Vollerei.
 *
 * Semua judul di sini adalah komik dewasa (manhwa/manhua 18+), jadi modul ini
 * hanya dipakai halaman di bawah /doujin: tidak pernah dipanggil beranda,
 * menu, sitemap, maupun pencarian utama.
 *
 * API-nya tidak menyediakan HTML yang perlu di-scrape, tetapi bentuk responsnya
 * tidak seragam: daftar memakai `mangaList`, pencarian memakai `results`, dan
 * hasil pencarian TIDAK membawa slug. Slug diturunkan dari judul dengan aturan
 * WordPress yang sama dipakai sumbernya (huruf kecil, apostrof dibuang, sisanya
 * jadi tanda hubung), lalu halaman detail memverifikasinya sendiri.
 */
export const MANGASUSUKU_BASE_URL = (
  process.env.MANGASUSUKU_API_BASE_URL || 'https://www.sankavollerei.web.id/comic/mangasusuku'
).replace(/\/+$/, '');

export const MANGASUSUKU_SITE_URL = 'https://mangasusuku.com';

/* ------------------------------------------------------------------ payload */

interface Pagination {
  currentPage?: number;
  hasNextPage?: boolean;
  nextPage?: number | null;
}

interface Envelope {
  success?: boolean;
  message?: string;
  pagination?: Pagination;
}

interface ListEntry {
  title?: string | null;
  slug?: string | null;
  image?: string | null;
  chapter?: string | null;
  rating?: string | null;
  type?: string | null;
  status?: string | null;
  isHot?: boolean | null;
}

interface ListPayload extends Envelope {
  mangaList?: ListEntry[];
}

interface SearchEntry {
  title?: string | null;
  image?: string | null;
  chapter?: string | null;
  rating?: string | null;
  type?: string | null;
}

interface SearchPayload extends Envelope {
  results?: SearchEntry[];
}

interface ChapterRef {
  title?: string | null;
  slug?: string | null;
  date?: string | null;
}

interface DetailPayload extends Envelope {
  title?: string | null;
  alternativeTitle?: string | null;
  image?: string | null;
  rating?: string | null;
  synopsis?: string | null;
  genres?: string[] | null;
  chapters?: ChapterRef[] | null;
}

interface ChapterPayload extends Envelope {
  title?: string | null;
  images?: string[] | null;
}

/* -------------------------------------------------------------------- fetch */

const TTL_MS = 10 * 60 * 1000;
const store = new Map<string, { at: number; value: unknown }>();
const inflight = new Map<string, Promise<unknown>>();

/** Sama seperti lib/comics.ts: hasil dibagi antar pemanggil, bukan diulang. */
async function cached<T>(key: string, load: () => Promise<T>): Promise<T> {
  const hit = store.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.value as T;

  const running = inflight.get(key);
  if (running) return running as Promise<T>;

  const task = load()
    .then((value) => {
      store.delete(key);
      const oldest = store.keys().next();
      if (store.size >= 120 && !oldest.done) store.delete(oldest.value);
      store.set(key, { at: Date.now(), value });
      return value;
    })
    .finally(() => {
      inflight.delete(key);
    });

  inflight.set(key, task);
  return task;
}

function withTimeout<T>(promise: Promise<T>, ms = 12000): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error('timeout')), ms)),
  ]);
}

/** Detektor bot API menolak permintaan tanpa User-Agent browser. */
const BROWSER_UA =
  'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36';

/**
 * `path` selalu relatif ke MANGASUSUKU_BASE_URL dan sudah di-encode pemanggil.
 * Respons yang bukan JSON atau `success: false` dianggap kegagalan sumber,
 * bukan "tidak ada hasil", supaya halaman bisa membedakan offline dan kosong.
 */
async function api<T extends Envelope>(path: string): Promise<T> {
  const url = `${MANGASUSUKU_BASE_URL}${path}`;

  let res: Response;
  try {
    res = await fetch(url, {
      headers: { Accept: 'application/json', 'User-Agent': BROWSER_UA },
      signal: AbortSignal.timeout(15000),
      next: { revalidate: 600 },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Network error';
    throw new UpstreamError(`Gagal terhubung ke MangaSusuku (${msg})`, { url });
  }

  if (res.status === 404 || res.status === 410) {
    throw new UpstreamError('Konten tidak ditemukan di MangaSusuku', { status: 404, url });
  }
  if (!res.ok) {
    throw new UpstreamError(`MangaSusuku membalas HTTP ${res.status}`, { status: res.status, url });
  }

  let json: unknown;
  try {
    json = await res.json();
  } catch {
    throw new UpstreamError('MangaSusuku mengirim respons yang bukan JSON', { status: 502, url });
  }

  const envelope = json as T;
  if (!envelope || envelope.success === false) {
    throw new UpstreamError(envelope?.message || 'MangaSusuku menolak permintaan', {
      status: 502,
      url,
    });
  }
  return envelope;
}

/* --------------------------------------------------------------------- teks */

function trim(value: string | null | undefined): string | null {
  const text = (value || '').replace(/\s+/g, ' ').trim();
  return text || null;
}

const APOSTROPHE = /['\u2018\u2019\u02bc\u201c\u201d"]/g;

/**
 * Slug sumber mengikuti aturan WordPress: huruf kecil, apostrof dibuang
 * (bukan diganti tanda hubung), tanda baca lain jadi tanda hubung. Judul yang
 * tidak menyisakan huruf Latin sama sekali (mis. judul Korea) mengembalikan
 * null: kartunya dilewati daripada menautkan halaman yang pasti 404.
 */
export function mangasusukuSlug(title: string): string | null {
  const slug = title
    .toLowerCase()
    .replace(APOSTROPHE, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || null;
}

/** Slug chapter dari sumber berakhiran garis miring ("judul-chapter-3/"). */
export function cleanChapterSlug(value: string): string {
  return value.trim().replace(/^\/+|\/+$/g, '');
}

/** "judul-serinya-chapter-12" -> "judul-serinya" (null untuk judul aneh). */
export function seriesSlugFromChapter(chapterSlug: string): string | null {
  const match = cleanChapterSlug(chapterSlug).match(/^(.*)-chapter-[0-9]+(?:\.[0-9]+)?$/i);
  return match && match[1] ? match[1] : null;
}

/**
 * Judul chapter dari sumber panjang ("Secret class chapter 324"). Label yang
 * dipakai halaman diambil dari daftar chapter detail ("Chapter 324") bila ada;
 * fungsi ini hanya cadangan.
 */
export function chapterLabel(raw: string | null | undefined, chapterSlug: string): string {
  const text = trim(raw);
  if (text) {
    const match = text.match(/chapter\s*([0-9]+(?:\.[0-9]+)?)/i);
    if (match) return `Chapter ${match[1]}`;
    return text;
  }
  const fromSlug = cleanChapterSlug(chapterSlug).match(/chapter-([0-9]+(?:\.[0-9]+)?)$/i);
  return fromSlug ? `Chapter ${fromSlug[1]}` : cleanChapterSlug(chapterSlug);
}

/* --------------------------------------------------------------------- kartu */

export function doujinHref(slug: string): string {
  return `/doujin/${encodeURIComponent(slug)}`;
}

export function doujinChapterHref(seriesSlug: string, chapterSlug: string): string {
  return `/doujin/${encodeURIComponent(seriesSlug)}/${encodeURIComponent(cleanChapterSlug(chapterSlug))}`;
}

function ratingMeta(rating: string | null | undefined, type: string | null | undefined): string | null {
  const value = trim(rating);
  if (value) return `Rating ${value}`;
  return trim(type);
}

function cardFromList(entry: ListEntry): ComicCard | null {
  const slug = trim(entry.slug);
  if (!slug) return null;
  return {
    id: `mangasusuku:${slug}`,
    source: 'mangasusuku',
    title: trim(entry.title) || slug.replaceAll('-', ' '),
    poster: trim(entry.image),
    meta: ratingMeta(entry.rating, entry.type),
    latest: trim(entry.chapter),
    href: doujinHref(slug),
  };
}

function cardFromSearch(entry: SearchEntry): ComicCard | null {
  const title = trim(entry.title);
  if (!title) return null;
  const slug = mangasusukuSlug(title);
  if (!slug) return null;
  return {
    id: `mangasusuku:${slug}`,
    source: 'mangasusuku',
    title,
    poster: trim(entry.image),
    meta: ratingMeta(entry.rating, entry.type),
    latest: trim(entry.chapter),
    href: doujinHref(slug),
  };
}

function dedupe(cards: (ComicCard | null)[]): ComicCard[] {
  const seen = new Set<string>();
  const result: ComicCard[] = [];
  for (const card of cards) {
    if (!card || seen.has(card.id)) continue;
    seen.add(card.id);
    result.push(card);
  }
  return result;
}

/* ------------------------------------------------------------------ katalog */

export interface DoujinFeed {
  items: ComicCard[];
  offline: boolean;
}

/** Satu halaman daftar hanya berisi 10 judul; enam halaman pertama cukup untuk katalog. */
const CATALOG_PAGES = 6;
/** Hasil pencarian 10 per halaman dan tanpa slug, jadi tiga halaman sudah banyak. */
const SEARCH_PAGES = 3;

export function getDoujinCatalog(query = '', limit = 60): Promise<DoujinFeed> {
  const q = query.trim();
  return cached(`doujin:list:${q}:${limit}`, async () => {
    try {
      if (q) {
        const pages = await Promise.all(
          Array.from({ length: SEARCH_PAGES }, (_, index) =>
            withTimeout(
              api<SearchPayload>(
                index === 0
                  ? `/search/${encodeURIComponent(q)}`
                  : `/search/${encodeURIComponent(q)}/${index + 1}`
              )
            ).catch(() => null)
          )
        );
        const answered = pages.some((page) => page !== null);
        const cards = dedupe(pages.flatMap((page) => page?.results ?? []).map(cardFromSearch));
        /* Sumber menjawab dengan baik tetapi tidak ada judul yang cocok: itu
           bukan gangguan, halaman harus bilang "tidak ditemukan". */
        return { items: cards.slice(0, limit), offline: !answered };
      }

      const pages = await Promise.all(
        Array.from({ length: CATALOG_PAGES }, (_, index) =>
          withTimeout(api<ListPayload>(`/list/${index + 1}`)).catch(() => null)
        )
      );
      const cards = dedupe(pages.flatMap((page) => page?.mangaList ?? []).map(cardFromList));
      return { items: cards.slice(0, limit), offline: cards.length === 0 };
    } catch {
      return { items: [], offline: true };
    }
  });
}

/* ------------------------------------------------------------------- detail */

export interface DoujinDetail {
  slug: string;
  title: string;
  altTitle: string | null;
  poster: string | null;
  rating: string | null;
  synopsis: string | null;
  genres: string[];
  chapters: { slug: string; label: string; date: string }[];
}

export async function getDoujinDetail(slug: string): Promise<DoujinDetail | null> {
  const key = `doujin:detail:${slug}`;
  try {
    return await cached(key, async () => {
      const data = await withTimeout(api<DetailPayload>(`/detail/${encodeURIComponent(slug)}`));
      const chapters = (data.chapters ?? [])
        .map((chapter) => {
          const chapterSlug = cleanChapterSlug(chapter.slug || '');
          if (!chapterSlug) return null;
          return {
            slug: chapterSlug,
            label: chapterLabel(chapter.title, chapterSlug),
            date: trim(chapter.date) || '',
          };
        })
        .filter((chapter): chapter is { slug: string; label: string; date: string } => chapter !== null);

      return {
        slug,
        title: trim(data.title) || slug.replaceAll('-', ' '),
        altTitle: trim(data.alternativeTitle),
        poster: trim(data.image),
        rating: trim(data.rating),
        synopsis: trim(data.synopsis),
        genres: (data.genres ?? []).map((genre) => trim(genre) || '').filter(Boolean),
        chapters,
      };
    });
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ chapter */

export interface DoujinChapterView {
  seriesSlug: string | null;
  seriesTitle: string | null;
  label: string;
  images: string[];
  /** Chapter lebih lama (nomor mengecil). */
  prev: string | null;
  /** Chapter lebih baru (nomor membesar). */
  next: string | null;
}

/** Sumber mengirim URL gambar http://; halaman situs berjalan di https. */
function upgradeImageUrl(value: string): string | null {
  const text = trim(value);
  if (!text) return null;
  if (text.startsWith('http://')) return `https://${text.slice('http://'.length)}`;
  if (text.startsWith('https://')) return text;
  return null;
}

/**
 * Navigasi chapter tidak diambil dari `navigation` respons sumber: isinya masih
 * placeholder ("#/prev/"). Urutan chapter diambil dari daftar di halaman detail,
 * yang tersusun dari nomor terbesar ke terkecil.
 */
export async function getDoujinChapter(
  seriesSlug: string | null,
  chapterSlug: string
): Promise<DoujinChapterView | null> {
  const slug = cleanChapterSlug(chapterSlug);
  if (!slug) return null;
  const series = (seriesSlug && seriesSlug.trim()) || seriesSlugFromChapter(slug);

  try {
    return await cached(`doujin:chapter:${slug}`, async () => {
      const [chapter, detail] = await Promise.all([
        withTimeout(api<ChapterPayload>(`/chapter/${encodeURIComponent(slug)}`)),
        series ? getDoujinDetail(series).catch(() => null) : Promise.resolve(null),
      ]);

      const images = (chapter.images ?? [])
        .map(upgradeImageUrl)
        .filter((image): image is string => image !== null);
      if (images.length === 0) return null;

      const list = detail?.chapters ?? [];
      const index = list.findIndex((entry) => entry.slug === slug);
      const newer = index > 0 ? list[index - 1].slug : null;
      const older = index >= 0 && index + 1 < list.length ? list[index + 1].slug : null;

      return {
        seriesSlug: series,
        seriesTitle: detail?.title ?? null,
        label: (index >= 0 ? list[index].label : null) || chapterLabel(chapter.title, slug),
        images,
        prev: older,
        next: newer,
      };
    });
  } catch {
    return null;
  }
}
