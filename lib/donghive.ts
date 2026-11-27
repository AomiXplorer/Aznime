import * as cheerio from 'cheerio';
import { UpstreamError } from '@/lib/scraper/utils';
import type { ComicCard } from '@/lib/comics';

export const DONGHIVE_BASE_URL = 'https://donghive.vip';

export interface DonghiveEpisodeRef {
  episode: string | null;
  title: string;
  date: string | null;
  slug: string;
  url: string;
}

export interface DonghiveDetail {
  title: string;
  slug: string;
  url: string;
  poster: string | null;
  rating: string | null;
  synopsis: string | null;
  metadata: Record<string, string>;
  genres: string[];
  episodes: DonghiveEpisodeRef[];
}

export interface DonghiveServer {
  name: string;
  url: string;
}

export interface DonghiveEpisode {
  title: string;
  slug: string;
  url: string;
  episodeNumber: string | null;
  releaseDate: string | null;
  thumbnail: string | null;
  series: { title: string | null; slug: string | null; url: string | null };
  navigation: { prev: string | null; next: string | null; allEpisodes: string | null };
  servers: DonghiveServer[];
}

export interface DonghiveListResult {
  items: ComicCard[];
  hasNextPage: boolean;
  page: number;
}

const HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
  Referer: `${DONGHIVE_BASE_URL}/`,
};

function cleanText(value: string | null | undefined): string {
  return (value || '').replace(/\s+/g, ' ').trim();
}

function resolveUrl(value: string | null | undefined): string {
  if (!value) return '';
  try {
    const resolved = new URL(value, DONGHIVE_BASE_URL);
    return resolved.protocol === 'http:' || resolved.protocol === 'https:' ? resolved.toString() : '';
  } catch {
    return '';
  }
}

function slugFromUrl(value: string): string {
  try {
    const path = new URL(value).pathname.replace(/\/+$/, '');
    return decodeURIComponent(path.split('/').pop() || '');
  } catch {
    return '';
  }
}

function imageFrom($: cheerio.CheerioAPI, root: cheerio.Cheerio<any>): string | null {
  const image = root.find('img').first();
  const raw =
    image.attr('data-src') ||
    image.attr('data-lazy-src') ||
    image.attr('data-original') ||
    image.attr('src');
  return resolveUrl(raw) || null;
}

function cardFrom($: cheerio.CheerioAPI, root: cheerio.Cheerio<any>): ComicCard | null {
  const link = root.find('a[href]').first();
  const url = resolveUrl(link.attr('href'));
  const slug = slugFromUrl(url);
  const title =
    cleanText(link.attr('title')) ||
    cleanText(root.find('.tt h2, h2, h3').first().text()) ||
    cleanText(root.find('img').first().attr('alt'));
  if (!url || !slug || !title) return null;

  const episode = cleanText(root.find('.epx').first().text());
  const type = cleanText(root.find('.typez').first().text());
  const subtitle = cleanText(root.find('.sb').first().text());
  const episodePost = /-episode-\d+(?:\.\d+)?/i.test(slug) || /^movie$/i.test(episode);
  return {
    id: `donghive:${slug}`,
    source: 'donghive',
    title,
    poster: imageFrom($, root),
    meta: [type, subtitle].filter(Boolean).join(' · ') || null,
    latest: episode || null,
    href: episodePost
      ? `/donghive/watch/${encodeURIComponent(slug)}`
      : `/donghive/${encodeURIComponent(slug)}`,
  };
}

async function getHtml(path: string, revalidate: number): Promise<cheerio.CheerioAPI> {
  let response: Response;
  try {
    response = await fetch(resolveUrl(path), {
      headers: HEADERS,
      signal: AbortSignal.timeout(14000),
      next: { revalidate },
    });
  } catch (error) {
    throw new UpstreamError(
      `DongHive tidak merespons${error instanceof Error ? ` (${error.message})` : ''}.`,
      { status: 503, url: resolveUrl(path) }
    );
  }

  if (!response.ok) {
    throw new UpstreamError(`DongHive merespons HTTP ${response.status}.`, {
      status: response.status,
      url: response.url,
    });
  }

  const html = await response.text();
  const sample = html.slice(0, 4096).toLowerCase();
  if (
    !html.trim() ||
    sample.includes('<title>just a moment...</title>') ||
    sample.includes('cf-browser-verification') ||
    sample.includes('attention required! | cloudflare')
  ) {
    throw new UpstreamError('DongHive mengembalikan halaman verifikasi sementara.', {
      status: 503,
      url: response.url,
    });
  }
  return cheerio.load(html);
}

function latestPath(page: number): string {
  const safePage = Math.max(1, Math.trunc(page));
  return safePage > 1 ? `/page/${safePage}/` : '/';
}

function animeListPath(page: number): string {
  const safePage = Math.max(1, Math.trunc(page));
  return safePage > 1 ? `/anime/page/${safePage}/` : '/anime/';
}

function paginationHasNext($: cheerio.CheerioAPI): boolean {
  return Boolean($('.pagination a.next, .hpage a.r, .hpage a.next, a.next.page-numbers').length);
}

function parseCards($: cheerio.CheerioAPI): ComicCard[] {
  const items: ComicCard[] = [];
  $('.listupd.normal .bs, .listupd.normal article, .listupd .bs, .listupd article').each((_, el) => {
    const item = cardFrom($, $(el));
    if (item && !items.some((existing) => existing.id === item.id)) items.push(item);
  });
  return items;
}

export async function getDonghiveHome(limit = 10): Promise<ComicCard[]> {
  const $ = await getHtml('/', 600);
  return parseCards($).slice(0, Math.max(0, limit));
}

export async function getDonghiveList(page = 1, query = ''): Promise<DonghiveListResult> {
  const path = query.trim() ? latestPath(page) : animeListPath(page);
  const url = new URL(path, DONGHIVE_BASE_URL);
  if (query.trim()) url.searchParams.set('s', query.trim().slice(0, 100));
  const $ = await getHtml(`${url.pathname}${url.search}`, 600);
  return { items: parseCards($), hasNextPage: paginationHasNext($), page: Math.max(1, Math.trunc(page)) };
}

export async function getDonghiveDetail(slug: string): Promise<DonghiveDetail> {
  const safeSlug = slug.trim().replace(/^\/+|\/+$/g, '');
  if (!safeSlug || safeSlug.includes('..')) throw new UpstreamError('Slug DongHive tidak valid.', { status: 404 });
  const fullUrl = resolveUrl(`/${encodeURIComponent(safeSlug)}/`);
  const $ = await getHtml(fullUrl, 1800);

  const title = cleanText($('.infox h1.entry-title, h1.entry-title').first().text());
  if (!title) throw new UpstreamError('Judul tidak ditemukan di DongHive.', { status: 404, url: fullUrl });

  const rawPoster =
    $('.thumbook .thumb img').attr('data-src') ||
    $('.thumbook .thumb img').attr('data-lazy-src') ||
    $('.thumbook .thumb img').attr('src');
  const metadata: Record<string, string> = {};
  $('.spe span').each((_, el) => {
    const text = cleanText($(el).text());
    const colon = text.indexOf(':');
    if (colon > 0) metadata[text.slice(0, colon).trim()] = text.slice(colon + 1).trim();
  });

  const genres: string[] = [];
  $('.genxed a').each((_, el) => {
    const value = cleanText($(el).text());
    if (value) genres.push(value);
  });

  const episodes: DonghiveEpisodeRef[] = [];
  $('.eplister ul li').each((_, el) => {
    const row = $(el);
    const url = resolveUrl(row.find('a').first().attr('href'));
    const episode = cleanText(row.find('.epl-num').text()) || null;
    const episodeTitle = cleanText(row.find('.epl-title').text()) || title;
    const date = cleanText(row.find('.epl-date').text()) || null;
    const slugValue = slugFromUrl(url);
    if (url && slugValue) episodes.push({ episode, title: episodeTitle, date, slug: slugValue, url });
  });

  return {
    title,
    slug: safeSlug,
    url: fullUrl,
    poster: resolveUrl(rawPoster) || null,
    rating: cleanText($('.rating strong').first().text()).replace(/^Rating\s*/i, '') || null,
    synopsis: cleanText($('.desc').text()) || cleanText($('.mindesc').text()) || cleanText($('.entry-content').first().text()) || null,
    metadata,
    genres: [...new Set(genres)],
    episodes,
  };
}

function decodeServer(value: string): string {
  try {
    const decoded = Buffer.from(value, 'base64').toString('utf8');
    const $ = cheerio.load(decoded);
    return resolveUrl($('iframe').first().attr('src')) || '';
  } catch {
    return '';
  }
}

export async function getDonghiveEpisode(slug: string): Promise<DonghiveEpisode> {
  const safeSlug = slug.trim().replace(/^\/+|\/+$/g, '');
  if (!safeSlug || safeSlug.includes('..')) throw new UpstreamError('Slug episode DongHive tidak valid.', { status: 404 });
  const fullUrl = resolveUrl(`/${encodeURIComponent(safeSlug)}/`);
  const $ = await getHtml(fullUrl, 300);

  const title = cleanText($('.title-section h1.entry-title, h1.entry-title').first().text());
  if (!title) throw new UpstreamError('Episode tidak ditemukan di DongHive.', { status: 404, url: fullUrl });
  const seriesLink = $('.year a, .naveps .nvsc a').first();
  const seriesUrl = resolveUrl(seriesLink.attr('href')) || null;
  const serverMap = new Map<string, DonghiveServer>();
  $('select.mirror option').each((_, el) => {
    const option = $(el);
    const name = cleanText(option.text());
    const url = decodeServer(option.attr('value') || '');
    if (name && url) serverMap.set(url, { name, url });
  });

  const defaultEmbed = resolveUrl($('#pembed iframe').first().attr('src'));
  if (defaultEmbed && ![...serverMap.values()].some((server) => server.url === defaultEmbed)) {
    serverMap.set(defaultEmbed, { name: 'Server utama', url: defaultEmbed });
  }

  return {
    title,
    slug: safeSlug,
    url: fullUrl,
    episodeNumber:
      cleanText($('meta[itemprop="episodeNumber"]').attr('content')) || cleanText($('.lm .epx').text()) || null,
    releaseDate: cleanText($('.year .updated').text()) || null,
    thumbnail:
      resolveUrl(
        $('#pembed iframe').attr('data-poster') ||
          $('.thumbook img').attr('data-src') ||
          $('.thumbook img').attr('src')
      ) || null,
    series: {
      title: cleanText(seriesLink.text()) || null,
      slug: seriesUrl ? slugFromUrl(seriesUrl) : null,
      url: seriesUrl,
    },
    navigation: {
      prev: resolveUrl($('.naveps .nvs a[rel="prev"]').attr('href')) || null,
      next: resolveUrl($('.naveps .nvs a[rel="next"]').attr('href')) || null,
      allEpisodes: resolveUrl($('.naveps .nvsc a').attr('href')) || null,
    },
    servers: [...serverMap.values()],
  };
}

export function donghiveEpisodeSummary(episode: DonghiveEpisodeRef) {
  return {
    number: episode.episode,
    title: episode.title,
    date: episode.date,
    slug: episode.slug,
    url: episode.url,
  };
}
