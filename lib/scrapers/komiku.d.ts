/**
 * Tipe untuk `lib/scrapers/komiku.js` (scraper komiku.org).
 */

export interface KomikuCard {
  title: string | null;
  slug: string | null;
  url: string | null;
  poster: string | null;
  type: string | null;
  genre: string | null;
  synopsis: string | null;
  updated: string | null;
  first: { label: string | null; chapter: string | null; title: string | null; url: string | null } | null;
  latest: { label: string | null; chapter: string | null; title: string | null; url: string | null } | null;
}

export interface KomikuHomeCard {
  title: string | null;
  slug: string | null;
  url: string | null;
  poster: string | null;
  country: string | null;
  meta: string | null;
  latest: string | null;
  latestLabel: string | null;
}

export interface KomikuChapterRef {
  number: { number: number; part: number | null } | null;
  label: string;
  title: string;
  slug: string | null;
  url: string;
  date: string;
}

export interface KomikuManga {
  slug: string | null;
  url: string;
  id: number | null;
  title: string | null;
  altTitle: string | null;
  poster: string | null;
  synopsis: string | null;
  type: string | null;
  status: string | null;
  genres: string[];
  author: string | null;
  theme: string | null;
  rating: string | null;
  readingDirection: string | null;
  published: string | null;
  modified: string | null;
  first: KomikuChapterRef | null;
  latest: KomikuChapterRef | null;
  chapters: KomikuChapterRef[];
}

export interface KomikuChapterImage {
  index: number;
  url: string;
  mirrors: Record<string, string>;
}

export interface KomikuChapter {
  slug: string | null;
  url: string;
  id: number | null;
  seriesId: number | null;
  series: string | null;
  seriesSlug: string | null;
  seriesUrl: string | null;
  chapter: string | null;
  chapterNumber: { number: number; part: number | null } | null;
  imageCount: number;
  hasNext: boolean;
  thumbnail: string | null;
  images: KomikuChapterImage[];
  mirrors: Record<string, string>;
  prev: string | null;
  next: string | null;
}

export const BASE: string;
export const MIRRORS: Record<string, string>;
export function search(query: string, opts?: { page?: number; chapter?: boolean }): Promise<KomikuCard[]>;
export function getManga(slugOrUrl: string): Promise<KomikuManga>;
export function getChapters(slugOrUrl: string): Promise<KomikuChapterRef[]>;
export function getChapter(slugOrUrl: string, opts?: object): Promise<KomikuChapter>;
export function getImages(slugOrUrl: string, opts?: object): Promise<KomikuChapterImage[]>;
export function getHome(): Promise<KomikuHomeCard[]>;
export function getGenres(): Promise<Record<string, string>>;
export function getGenre(slug: string, opts?: { page?: number }): Promise<KomikuCard[]>;
export function getSlug(input: string): string | null;
export function getChapterSlug(input: string): string | null;
export function toMirror(url: string, key?: string): string;
