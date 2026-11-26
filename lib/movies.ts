import { load } from 'cheerio';

export const MOVIE_SOURCES = {
  kitanonton: { name: 'Kitanonton', origin: 'https://kitanonton2.cv' },
  rebahin: { name: 'Rebahin', origin: 'https://rebahinxxi3.mom' },
} as const;

export type MovieSource = keyof typeof MOVIE_SOURCES;

export interface MovieCard {
  source: 'movie';
  id: string;
  title: string;
  poster: string | null;
  meta: string | null;
  latest: string | null;
  href: string;
}

export interface MovieDetail extends MovieCard {
  synopsis: string | null;
  sourceUrl: string;
  video: string | null;
  embed: string | null;
}

export function isMovieSource(value: string): value is MovieSource {
  return Object.hasOwn(MOVIE_SOURCES, value);
}

export function moviePath(segments: string[]): string | null {
  if (segments.length === 1 && /^(?:nonton|film|movie|watch)-[a-z0-9][a-z0-9-]{0,180}$/.test(segments[0])) {
    return '/' + segments[0] + '/';
  }
  if (segments.length === 2 && /^(?:film|movie|movies)$/.test(segments[0]) &&
      /^[a-z0-9][a-z0-9-]{0,180}$/.test(segments[1])) {
    return '/' + segments.join('/') + '/';
  }
  return null;
}

function httpsUrl(raw: string | undefined, origin: string): URL | null {
  if (!raw?.trim()) return null;
  try {
    const url = new URL(raw, origin);
    return url.protocol === 'https:' && !url.username && !url.password ? url : null;
  } catch {
    return null;
  }
}

function clean(value: string) {
  return value.replace(/\s+/g, ' ').trim();
}

function movieCard(source: MovieSource, path: string, title: string, poster: URL | null, meta: string, latest: string): MovieCard {
  const href = '/movie/' + source + path.slice(0, -1);
  return { source: 'movie', id: href, title, poster: poster?.href ?? null, meta: meta || null, latest: latest || null, href };
}

export function parseMovieCatalog(html: string, source: MovieSource): MovieCard[] {
  const $ = load(html);
  const origin = MOVIE_SOURCES[source].origin;
  const items = new Map<string, MovieCard>();
  $('.movie-item, .film-item, .ml-item, article, .item').each((_, element) => {
    const card = $(element);
    const heading = card.find('h2, h3, .movie-title, .title').first();
    const linkedHeading = heading.is('a[href]') ? heading : heading.find('a[href]').first();
    const link = linkedHeading.length ? linkedHeading : card.find('a[href]').first();
    const url = httpsUrl(link.attr('href'), origin);
    if (!url || url.origin !== origin) return;
    const path = moviePath(url.pathname.split('/').filter(Boolean));
    if (!path || /\/(?:series|serial|drakor)|(?:^|-)episode-\d|(?:^|-)season-\d/i.test(path)) return;
    const title = clean(heading.text() || link.attr('title') || link.attr('oldtitle') || '');
    if (!title || items.has(path)) return;
    const img = card.find('img').first();
    const poster = httpsUrl(img.attr('data-src') || img.attr('data-original') || img.attr('data-lazy-src') || img.attr('src'), origin);
    const year = clean(card.find('.year').first().text()) || /\((\d{4})\)/.exec(title)?.[1] || '';
    const quality = clean(card.find('.quality, .qtag').first().text());
    items.set(path, movieCard(source, path, title, poster, year, quality));
  });
  return [...items.values()];
}

export function parseMovieDetail(html: string, source: MovieSource, path: string): MovieDetail | null {
  const $ = load(html);
  const origin = MOVIE_SOURCES[source].origin;
  const title = clean($('h1').first().text());
  if (!title) return null;
  const synopsis = clean($('.description, .synopsis, .storyline, [itemprop="description"]').first().text()) ||
    clean($('meta[property="og:description"]').attr('content') || '');
  const poster = httpsUrl($('meta[property="og:image"]').attr('content') || $('.poster img, .movie-poster img').first().attr('src'), origin);
  const videoTag = $('video').first();
  const video = httpsUrl(videoTag.attr('src') || videoTag.find('source[src]').first().attr('src'), origin);
  const iframe = $('iframe#iframe-embed, #player iframe, .player iframe, #pembed iframe, .video-container iframe').first();
  const embed = httpsUrl(iframe.attr('src') || iframe.attr('data-src'), origin);
  return {
    ...movieCard(source, path, title, poster, /\((\d{4})\)/.exec(title)?.[1] || '', ''),
    synopsis: synopsis || null,
    sourceUrl: origin + path,
    video: video && /\.(?:mp4|webm|mov)$/i.test(video.pathname) ? video.href : null,
    embed: embed?.href ?? null,
  };
}

async function getMovieHtml(source: MovieSource, path: string): Promise<string | null> {
  const response = await fetch(MOVIE_SOURCES[source].origin + path, {
    headers: { Accept: 'text/html' },
    redirect: 'error',
    signal: AbortSignal.timeout(4500),
    next: { revalidate: 900 },
  }).catch(() => null);
  if (!response?.ok || !response.headers.get('content-type')?.includes('text/html')) return null;
  const html = await response.text().catch(() => null);
  if (!html || /<title>\s*(?:Just a moment|Attention Required)/i.test(html)) return null;
  return html;
}

export async function getMovieCatalog(source: MovieSource) {
  const html = await getMovieHtml(source, '/movies/');
  return html ? parseMovieCatalog(html, source) : [];
}

export async function getMovie(source: MovieSource, path: string[]) {
  const validatedPath = moviePath(path);
  if (!validatedPath) return null;
  const html = await getMovieHtml(source, validatedPath);
  return html ? parseMovieDetail(html, source, validatedPath) : null;
}
