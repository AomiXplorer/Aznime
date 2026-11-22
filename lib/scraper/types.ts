export type LinkKind = 'anime' | 'episode';

/** Sumber data: Hidori (utama) atau arsip Malz (pelengkap judul lama). */
export type AnimeSource = 'hidori' | 'malz';

export interface AnimeCardItem {
  postId: string | null;
  title: string;
  seriesTitle: string;
  slug: string | null;
  url: string | null;
  kind: LinkKind;
  poster: string | null;
  type: string | null;
  status: string | null;
  sub: string | null;
  episode: string | null;
  episodeNumber: number | null;
  isHot: boolean;
  source: AnimeSource;
  /** Judul alternatif dari sumber, dipakai untuk dedupe dan pencocokan trailer. */
  altTitles?: string[];
  genres?: string[];
}

export interface FeaturedAnime {
  title: string;
  slug: string | null;
  url: string;
  poster: string | null;
  releaseYear: string | null;
  status: string | null;
  type: string | null;
  genres: string[];
  synopsis: string | null;
}

export interface OngoingSidebarItem {
  title: string;
  episode: string | null;
  slug: string | null;
  url: string | null;
  kind: LinkKind;
}

export interface PopularAnimeItem {
  rank: number;
  source?: AnimeSource;
  postId: string | null;
  title: string;
  slug: string | null;
  url: string | null;
  poster: string | null;
  genres: string[];
}

export interface BlogPostSummary {
  title: string;
  slug: string | null;
  url: string | null;
  image: string | null;
  excerpt: string | null;
}

export interface PaginationInfo {
  currentPage: number;
  totalPages: number | null;
  hasNextPage: boolean;
  hasPrevPage: boolean;
  nextPage: number | null;
  prevPage: number | null;
}

export interface HomeData {
  page: number;
  pagination: PaginationInfo;
  featured: FeaturedAnime[];
  latestRelease: AnimeCardItem[];
  completedLatest: AnimeCardItem[];
  ongoingSidebar: OngoingSidebarItem[];
  popular: {
    weekly: PopularAnimeItem[];
    monthly: PopularAnimeItem[];
    alltime: PopularAnimeItem[];
  };
  blogLatest: BlogPostSummary[];
}

export interface AnimeListOptions {
  page?: number;
  status?: string;
  type?: string;
  sub?: string;
  order?: string;
  genre?: string | string[];
  season?: string | string[];
  studio?: string | string[];
}

export interface AnimeListResponse {
  filters: {
    status: string;
    type: string;
    sub: string;
    order: string;
    genre: string | string[];
    season: string | string[];
    studio: string | string[];
  };
  pagination: PaginationInfo;
  results: AnimeCardItem[];
}

export interface FilterOptionItem {
  label: string;
  value: string;
}

export type FilterOptionsMap = Record<string, FilterOptionItem[]>;

export interface ListModeEntry {
  title: string;
  slug: string | null;
  url: string;
}

export interface ListModeResponse {
  total: number;
  groups: Record<string, ListModeEntry[]>;
}

export interface ScheduleItem {
  title: string;
  slug: string | null;
  url: string;
  poster: string | null;
  releaseTime: string | null;
  countdownSeconds: number | null;
  episode: string | null;
}

export type ScheduleMap = Record<string, ScheduleItem[]>;

export interface TaxonomyResponse {
  taxonomy: string;
  slug: string;
  title: string;
  pagination: PaginationInfo;
  results: AnimeCardItem[];
}

export interface GenreRef {
  name: string;
  slug: string | null;
  url: string | null;
}

export interface EpisodeSummary {
  number: string | null;
  title: string;
  date: string | null;
  slug: string | null;
  url: string;
}

export interface DownloadLink {
  host: string;
  url: string;
}

export interface DownloadQuality {
  quality: string;
  links: DownloadLink[];
}

export interface DownloadBox {
  title: string;
  qualities: DownloadQuality[];
}

export interface AnimeDetail {
  title: string;
  altTitle: string | null;
  slug: string | null;
  url: string;
  poster: string | null;
  rating: string | null;
  synopsis: string | null;
  info: Record<string, string>;
  genres: GenreRef[];
  totalEpisodes: number;
  episodes: EpisodeSummary[];
  batchDownloads: DownloadBox[];
  recommendations: AnimeCardItem[];
}

export type MirrorServerType = 'iframe' | 'video' | 'hls' | 'unavailable';

export interface MirrorServer {
  name: string;
  available: boolean;
  type: MirrorServerType;
  url: string | null;
  message?: string;
}

export interface EpisodeNavLink {
  title: string;
  slug: string | null;
  url: string;
  /** Nomor episode kalau bisa dibaca dari daftar seri. */
  number?: string | null;
}

export interface EpisodeData {
  title: string;
  slug: string | null;
  url: string;
  series: {
    title: string | null;
    slug: string | null;
    url: string;
  } | null;
  defaultEmbed: string | null;
  servers: MirrorServer[];
  downloads: DownloadBox[];
  navigation: {
    prev: EpisodeNavLink | null;
    all: EpisodeNavLink | null;
    next: EpisodeNavLink | null;
  };
}

export interface SearchResponse {
  query: string;
  pagination: PaginationInfo;
  results: AnimeCardItem[];
}

export interface QuickSearchItem {
  postId: string;
  title: string;
  slug: string | null;
  url: string | null;
  kind: LinkKind;
  poster: string | null;
  genres: string[];
  type: string | null;
  latestEpisode?: string | null;
  sub?: string | null;
  source: AnimeSource;
  altTitles?: string[];
}

export interface BlogListResponse {
  pagination: PaginationInfo;
  posts: BlogPostSummary[];
}

export interface BlogPostDetail {
  title: string;
  slug: string | null;
  url: string;
  date: string | null;
  contentText: string;
  contentHtml: string | null;
}

export interface AniListTrailer {
  id: string;
  site: string;
  thumbnail: string | null;
  bannerImage: string | null;
  matchedTitle: string | null;
}
