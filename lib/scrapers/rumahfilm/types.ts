import type { PaginationInfo } from '@/lib/scraper/types';

export interface RumahFilmMovie {
  sourceId?: string | null;
  title: string;
  slug: string;
  url: string;
  sourceUrl: string;
  poster?: string;
  year?: number;
  rating?: number;
  genres?: string[];
  type: 'movie';
}

export interface RumahFilmStreamSource {
  label: string;
  url: string;
  kind: 'iframe' | 'video';
}

export interface RumahFilmDetail extends RumahFilmMovie {
  originalTitle?: string;
  backdrop?: string;
  synopsis?: string;
  director?: string;
  cast?: string[];
  duration?: string;
  country?: string;
  releaseDate?: string;
  streamUrls?: RumahFilmStreamSource[];
}

export interface RumahFilmCatalogResult {
  items: RumahFilmMovie[];
  pagination: PaginationInfo;
  offline: boolean;
  error?: string;
}

export interface RumahFilmDetailResult {
  detail: RumahFilmDetail | null;
  offline: boolean;
  notFound: boolean;
  error?: string;
}
