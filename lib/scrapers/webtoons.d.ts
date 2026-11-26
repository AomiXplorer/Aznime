/**
 * Tipe untuk `lib/scrapers/webtoons.js` (scraper m.webtoons.com).
 * Bentuk data mengikuti keluaran skrip apa adanya; hanya field yang dipakai
 * situs yang diberi tipe ketat.
 */

export interface WebtoonHomeCard {
  titleNo: number;
  title: string | null;
  genre: string | null;
  slug: string | null;
  url: string;
  poster: string | null;
  rank: number | null;
}

export interface WebtoonSearchItem {
  titleNo: number;
  title: string;
  slug: string;
  group: string | null;
  genre: string | null;
  type: string;
  thumbnail: string | null;
  author: string | null;
  readCount: number;
  lastUpdate: string | null;
  url: string;
}

export interface WebtoonSearchResult {
  webtoonTotal: number;
  challengeTotal: number;
  results: WebtoonSearchItem[];
}

export interface WebtoonTrendingItem {
  rank: number | null;
  titleNo: number;
  title: string;
  slug: string;
  type: string;
  genre: string | null;
  thumbnail: string | null;
}

export interface WebtoonTitle {
  titleNo: number;
  title: string;
  slug: string;
  group: string | null;
  lang: string;
  genre: string | null;
  genreSlug: string | null;
  status: string | null;
  synopsis: string;
  author: string | null;
  tags: string[];
  thumbnail: string | null;
  thumbnailVertical: string | null;
  readCount: number;
  favoriteCount: number;
  rating: string | null;
  mature: boolean;
  lastUpdate: string | null;
  url: string;
}

export interface WebtoonEpisode {
  episodeNo: number;
  title: string;
  slug: string;
  thumb: string | null;
  viewerLink: string | null;
  date: string | null;
  up: boolean;
}

export interface WebtoonImage {
  url: string;
  width: number | null;
  height: number | null;
  order: number | null;
  spec: string | null;
}

export interface WebtoonViewer {
  titleNo: number;
  episodeNo: number;
  title: string | null;
  genre: string | null;
  lang: string;
  images: WebtoonImage[];
  count: number;
  prev: string | null;
  next: string | null;
  url: string;
}

export function getHome(opts?: { lang?: string }): Promise<WebtoonHomeCard[]>;
export function trending(opts?: { lang?: string }): Promise<WebtoonTrendingItem[]>;
export function search(
  query: string,
  opts?: { lang?: string; searchType?: string; start?: number }
): Promise<WebtoonSearchResult>;
export function searchTitles(
  query: string,
  opts?: { lang?: string; searchType?: string; start?: number }
): Promise<WebtoonSearchItem[]>;
export function getTitle(
  slugOrUrl: string,
  opts?: { lang?: string; titleNo?: number; signal?: AbortSignal }
): Promise<WebtoonTitle>;
export function getEpisodes(
  titleNoOrUrl: string | number,
  opts?: { lang?: string; type?: string; pageSize?: number; cursor?: number; maxPages?: number; signal?: AbortSignal }
): Promise<WebtoonEpisode[]>;
export function getViewer(
  titleNoOrUrl: string | number,
  opts?: { titleNo?: number; episodeNo?: number; genre?: string; slug?: string; lang?: string; signal?: AbortSignal }
): Promise<WebtoonViewer>;
export function getImages(titleNoOrUrl: string | number, opts?: object): Promise<WebtoonImage[]>;
export function findTitle(query: string, opts?: object): Promise<WebtoonTitle | null>;
export function slugify(input: string): string;
export function parseInput(input: string): {
  lang: string;
  genre: string | null;
  slug: string | null;
  titleNo: number | null;
  episodeNo: number | null;
  url: string | null;
} | null;
