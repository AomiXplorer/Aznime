import * as cheerio from 'cheerio';
import type { CheerioAPI } from 'cheerio';
import type { AnyNode } from 'domhandler';
import type { PaginationInfo } from '@/lib/scraper/types';
import {
  isNonMovieSectionHeading,
  isNonMovieUrl,
  isRestrictedMovie,
  isRestrictedText,
  isRestrictedUrl,
} from './filter';
import type { RumahFilmDetail, RumahFilmMovie, RumahFilmStreamSource } from './types';

function cleanText(value: string | null | undefined): string {
  return (value || '').replace(/\s+/g, ' ').trim();
}

export function normalizeMovieUrl(
  rawUrl: string | null | undefined,
  baseUrl: string
): string | null {
  if (!rawUrl) return null;
  const trimmed = rawUrl.trim();
  if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('javascript:')) return null;

  const withProto = trimmed.startsWith('//') ? `https:${trimmed}` : trimmed;
  try {
    const parsed = new URL(withProto, baseUrl);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return null;
    parsed.hash = '';
    return parsed.toString();
  } catch {
    return null;
  }
}

function canonicalUrlKey(rawUrl: string): string {
  try {
    const parsed = new URL(rawUrl);
    const pathname = parsed.pathname.replace(/\/+$/, '').toLowerCase() || '/';
    return `${parsed.hostname.toLowerCase()}${pathname}${parsed.search}`;
  } catch {
    return rawUrl.replace(/\/+$/, '').toLowerCase();
  }
}

export function extractMovieSlug(urlOrPath: string, baseUrl: string): string | null {
  try {
    const parsed = new URL(urlOrPath, baseUrl);
    const segments = parsed.pathname.replace(/^\/+|\/+$/g, '').split('/').filter(Boolean);
    if (segments.length === 0) return null;

    const last = segments[segments.length - 1];
    if (
      last === 'movies' ||
      last === 'movie' ||
      last === 'film' ||
      last === 'page' ||
      /^\d+$/.test(last)
    ) {
      return null;
    }

    try {
      return decodeURIComponent(last).trim() || null;
    } catch {
      return last.trim() || null;
    }
  } catch {
    const clean = urlOrPath.replace(/^\/+|\/+$/g, '').trim();
    return clean || null;
  }
}

export function parseYear(value: string | null | undefined): number | undefined {
  if (!value) return undefined;
  const match = /\b(19\d{2}|20\d{2})\b/.exec(value);
  if (!match) return undefined;
  const year = Number(match[1]);
  const maxYear = new Date().getFullYear() + 2;
  return year >= 1900 && year <= maxYear ? year : undefined;
}

export function parseRating(value: string | null | undefined): number | undefined {
  if (!value) return undefined;
  const match = /\b(\d(?:\.\d{1,2})?|10(?:\.0)?)\b/.exec(value.replace(',', '.'));
  if (!match) return undefined;
  const num = Number(match[1]);
  return Number.isFinite(num) && num > 0 && num <= 10 ? Math.round(num * 10) / 10 : undefined;
}

function stripTrailingYearFromTitle(rawTitle: string): { title: string; extractedYear?: number } {
  const cleaned = cleanText(rawTitle)
    .replace(/\s*\((19\d{2}|20\d{2})\)\s*$/i, '')
    .trim();
  const yearMatch = /\((19\d{2}|20\d{2})\)\s*$/i.exec(rawTitle);
  const extractedYear = yearMatch ? Number(yearMatch[1]) : undefined;
  return {
    title: cleaned || cleanText(rawTitle),
    extractedYear,
  };
}

function normalizeTitleKey(title: string): string {
  return cleanText(title)
    .toLowerCase()
    .replace(/\((?:19|20)\d{2}\)\s*$/i, '')
    .replace(/[^\p{L}\p{N}\s]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractImageUrl($: CheerioAPI, root: AnyNode, baseUrl: string): string | undefined {
  const $img = $(root).find('img').not('noscript img').first();
  const candidates = [
    $img.attr('data-src'),
    $img.attr('data-lazy-src'),
    $img.attr('data-original'),
    $img.attr('src'),
  ];

  for (const candidate of candidates) {
    if (!candidate || candidate.startsWith('data:')) continue;
    const normalized = normalizeMovieUrl(candidate, baseUrl);
    if (normalized) return normalized;
  }

  const noscriptHtml = $(root).find('noscript').first().html();
  if (noscriptHtml) {
    const $ns = cheerio.load(noscriptHtml);
    const nsSrc = $ns('img').attr('src');
    const normalized = normalizeMovieUrl(nsSrc, baseUrl);
    if (normalized) return normalized;
  }

  return undefined;
}

function extractSourceId($card: cheerio.Cheerio<AnyNode>): string | undefined {
  const attrId =
    $card.attr('data-movie-id') ||
    $card.attr('data-post-id') ||
    $card.attr('data-id') ||
    $card.find('[data-id], [data-post-id], [data-movie-id]').first().attr('data-id') ||
    $card.attr('id');

  if (!attrId) return undefined;
  const postMatch = /^post-(\d+)$/i.exec(attrId.trim());
  if (postMatch) return postMatch[1];
  const cleaned = attrId.trim();
  return cleaned || undefined;
}

export function dedupeMovies<
  T extends Pick<RumahFilmMovie, 'sourceId' | 'slug' | 'sourceUrl' | 'url' | 'title' | 'year'>,
>(items: T[]): T[] {
  const seenIds = new Set<string>();
  const seenSlugs = new Set<string>();
  const seenUrls = new Set<string>();
  const seenTitleYears = new Set<string>();
  const output: T[] = [];

  for (const item of items) {
    const idKey = item.sourceId ? item.sourceId.trim().toLowerCase() : '';
    const slugKey = item.slug ? item.slug.trim().toLowerCase() : '';
    const urlKey = canonicalUrlKey(item.sourceUrl || item.url);
    const titleKey = normalizeTitleKey(item.title);
    const titleYearKey = titleKey ? `${titleKey}|${item.year ?? ''}` : '';

    if (idKey && seenIds.has(idKey)) continue;
    if (slugKey && seenSlugs.has(slugKey)) continue;
    if (urlKey && seenUrls.has(urlKey)) continue;
    if (titleYearKey && seenTitleYears.has(titleYearKey)) continue;

    if (idKey) seenIds.add(idKey);
    if (slugKey) seenSlugs.add(slugKey);
    if (urlKey) seenUrls.add(urlKey);
    if (titleYearKey) seenTitleYears.add(titleYearKey);
    output.push(item);
  }

  return output;
}

function isInsideExcludedSection($: CheerioAPI, el: AnyNode): boolean {
  const $parents = $(el).parents('section, div, aside, nav, header, footer');
  for (const parent of $parents.toArray()) {
    const $parent = $(parent);
    if ($parent.is('nav, header, footer')) return true;

    const idClass = `${$parent.attr('id') || ''} ${$parent.attr('class') || ''}`;
    if (isRestrictedText(idClass)) return true;

    if ($parent.is('section')) {
      const heading = $parent.find('h1, h2, h3, .section-title, .widget-title').first().text();
      if (isRestrictedText(heading) || isNonMovieSectionHeading(heading)) {
        return true;
      }
    }
  }
  return false;
}

function parseCardNode($: CheerioAPI, card: AnyNode, baseUrl: string): RumahFilmMovie | null {
  if (isInsideExcludedSection($, card)) return null;

  const $card = $(card);
  const $link = $card
    .find(
      'h2 a, h3 a, .entry-title a, .title a, .data h3 a, a.ml-mask, a.poster, a[itemprop="url"], a[href]'
    )
    .first();

  const rawHref = $link.attr('href') || $card.find('a[href]').first().attr('href');
  const sourceUrl = normalizeMovieUrl(rawHref, baseUrl);
  if (!sourceUrl || isRestrictedUrl(sourceUrl) || isNonMovieUrl(sourceUrl)) return null;

  const baseHost = (() => {
    try {
      return new URL(baseUrl).hostname.toLowerCase();
    } catch {
      return '';
    }
  })();

  try {
    const parsed = new URL(sourceUrl);
    if (baseHost && parsed.hostname.toLowerCase() !== baseHost) return null;
  } catch {
    return null;
  }

  const slug = extractMovieSlug(sourceUrl, baseUrl);
  if (!slug) return null;

  const rawTitle = cleanText(
    $card.find('.entry-title, .title, h2, h3, .data h3, .mli-info h2, .name').first().text() ||
      $link.attr('title') ||
      $card.find('img').first().attr('alt') ||
      $link.text()
  );
  if (!rawTitle) return null;

  const { title, extractedYear } = stripTrailingYearFromTitle(rawTitle);

  const yearText = cleanText(
    $card
      .find('.year, .gmr-year, [itemprop="datePublished"], .metadata span, .data span, .date')
      .first()
      .text()
  );
  const year = parseYear(yearText) ?? extractedYear;

  const ratingText = cleanText(
    $card
      .find('.rating, .imdb, .gmr-rating-item, [itemprop="ratingValue"], .vote')
      .first()
      .text() || $card.attr('data-rating')
  );
  const rating = parseRating(ratingText);

  const genres = $card
    .find('.genre a, .genres a, .gmr-genre a, a[rel="tag"], a[href*="/genre/"], .category a')
    .map((_, el) => cleanText($(el).text()))
    .get()
    .filter(Boolean);

  const categories = $card
    .find('.gmr-category a, a[href*="/category/"]')
    .map((_, el) => cleanText($(el).text()))
    .get()
    .filter(Boolean);

  const ratingBadge = cleanText($card.find('.age-rating, .mpaa, .quality, .badge').text());

  if (
    isRestrictedMovie({
      title,
      url: sourceUrl,
      sourceUrl,
      genres,
      categories,
      ratingLabel: ratingBadge,
    })
  ) {
    return null;
  }

  const poster = extractImageUrl($, card, baseUrl);
  const sourceId = extractSourceId($card);

  return {
    sourceId,
    title,
    slug,
    url: `/film/${encodeURIComponent(slug)}`,
    sourceUrl,
    ...(poster ? { poster } : {}),
    ...(year !== undefined ? { year } : {}),
    ...(rating !== undefined ? { rating } : {}),
    ...(genres.length > 0 ? { genres: Array.from(new Set(genres)) } : {}),
    type: 'movie',
  };
}

export function extractPageNumberFromUrl(href: string | null | undefined): number | null {
  if (!href) return null;
  const pathMatch = /\/page\/(\d+)(?:\/|$|\?)/i.exec(href);
  if (pathMatch) return Number(pathMatch[1]);
  const queryMatch = /[?&](?:paged|page)=(\d+)/i.exec(href);
  if (queryMatch) return Number(queryMatch[1]);
  return null;
}

export function parseRumahFilmPagination(
  $: CheerioAPI,
  currentPage: number,
  baseUrl: string
): { pagination: PaginationInfo; nextUrl: string | null } {
  const nextHref =
    $('link[rel="next"]').attr('href') ||
    $('.pagination a.next, .nav-links a.next, a.next.page-numbers, a[rel="next"]')
      .first()
      .attr('href') ||
    null;

  const prevHref =
    $('link[rel="prev"]').attr('href') ||
    $('.pagination a.prev, .nav-links a.prev, a.prev.page-numbers, a[rel="prev"]')
      .first()
      .attr('href') ||
    null;

  let totalPages: number | null = null;
  $('.pagination .page-numbers, .nav-links .page-numbers, .wp-pagenavi a, .wp-pagenavi span').each(
    (_, el) => {
      const n = Number.parseInt(cleanText($(el).text()), 10);
      if (Number.isFinite(n) && n > 0 && (totalPages === null || n > totalPages)) {
        totalPages = n;
      }
    }
  );

  const normalizedNext = normalizeMovieUrl(nextHref, baseUrl);
  const nextPage =
    extractPageNumberFromUrl(normalizedNext) ?? (normalizedNext ? currentPage + 1 : null);
  const prevPage =
    extractPageNumberFromUrl(prevHref) ?? (prevHref && currentPage > 1 ? currentPage - 1 : null);

  return {
    pagination: {
      currentPage,
      totalPages,
      hasNextPage: Boolean(normalizedNext),
      hasPrevPage: currentPage > 1 || Boolean(prevHref),
      nextPage,
      prevPage,
    },
    nextUrl: normalizedNext,
  };
}

export function parseRumahFilmListing(
  html: string,
  page: number,
  baseUrl: string
): { items: RumahFilmMovie[]; pagination: PaginationInfo; nextUrl: string | null } {
  const $ = cheerio.load(html);
  const rawItems: RumahFilmMovie[] = [];

  const cardSelectors = [
    'article.item',
    'article.movies',
    'article.gmr-box-content',
    'article.post',
    '.ml-item',
    '.movie-item',
    '.film-card',
    '.gmr-box-content',
    'main article',
  ];

  const matchedNodes = $(cardSelectors.join(', '));
  matchedNodes.each((_, el) => {
    const parsed = parseCardNode($, el, baseUrl);
    if (parsed) rawItems.push(parsed);
  });

  const items = dedupeMovies(rawItems);
  const { pagination, nextUrl } = parseRumahFilmPagination($, page, baseUrl);

  return {
    items,
    pagination: items.length > 0 ? pagination : { ...pagination, hasNextPage: false, nextPage: null },
    nextUrl: items.length > 0 ? nextUrl : null,
  };
}

interface JsonLdMovie {
  '@type'?: string | string[];
  name?: string;
  alternateName?: string;
  description?: string;
  image?: string | { url?: string };
  datePublished?: string;
  genre?: string | string[];
  duration?: string;
  countryOfOrigin?: { name?: string } | string;
  director?: { name?: string } | Array<{ name?: string }> | string;
  actor?: Array<{ name?: string } | string>;
  aggregateRating?: { ratingValue?: string | number };
}

function parseJsonLdMovie($: CheerioAPI): JsonLdMovie | null {
  const scripts = $('script[type="application/ld+json"]');
  for (const script of scripts.toArray()) {
    const raw = $(script).html();
    if (!raw) continue;
    try {
      const parsed = JSON.parse(raw) as Record<string, unknown> | Array<Record<string, unknown>>;
      const queue: Array<Record<string, unknown>> = Array.isArray(parsed)
        ? [...parsed]
        : Array.isArray(parsed['@graph'])
          ? [...(parsed['@graph'] as Array<Record<string, unknown>>)]
          : [parsed];

      for (const node of queue) {
        const type = node['@type'];
        const isMovie =
          type === 'Movie' || (Array.isArray(type) && type.includes('Movie'));
        if (isMovie) {
          return node as JsonLdMovie;
        }
      }
    } catch {
      continue;
    }
  }
  return null;
}

function extractMetaMap($: CheerioAPI): Map<string, string> {
  const map = new Map<string, string>();
  $(
    '.custom_fields, .mvici-left p, .mvici-right p, .gmr-moviedata tr, .gmr-moviedata div, .sheader .extra span, .movie-info li'
  ).each((_, el) => {
    const $el = $(el);
    const label = cleanText(
      $el.find('b, strong, th, .vari, .meta-label').first().text()
    )
      .replace(/:$/, '')
      .toLowerCase();
    if (!label) return;
    const clone = $el.clone();
    clone.find('b, strong, th, .vari, .meta-label').first().remove();
    const val = cleanText(clone.text());
    if (val) map.set(label, val);
  });
  return map;
}

function isValidStreamUrl(url: string): boolean {
  const lower = url.toLowerCase();
  if (lower.includes('about:blank')) return false;
  if (/doubleclick|googlesyndication|facebook\.com\/plugins|recaptcha/i.test(lower)) return false;
  return true;
}

export function parseRumahFilmDetail(
  html: string,
  fallbackSlug: string,
  pageUrl: string,
  baseUrl: string
): RumahFilmDetail | null {
  const $ = cheerio.load(html);
  const ld = parseJsonLdMovie($);
  const metaMap = extractMetaMap($);

  const rawTitle = cleanText(
    $('h1.entry-title, .sheader .data h1, article h1, h1').first().text() ||
      ld?.name ||
      $('meta[property="og:title"]').attr('content')
  );
  if (!rawTitle) return null;

  const { title, extractedYear } = stripTrailingYearFromTitle(rawTitle);

  const originalTitleRaw = cleanText(
    metaMap.get('original title') ||
      metaMap.get('judul asli') ||
      $('.sheader .data .original-title, .original-title').first().text() ||
      ld?.alternateName
  );
  const originalTitle =
    originalTitleRaw && originalTitleRaw.toLowerCase() !== title.toLowerCase()
      ? originalTitleRaw
      : undefined;

  const genres = Array.from(
    new Set(
      [
        ...$(
          '.sgeneros a, .gmr-movie-genre a, .genres a, [itemprop="genre"], a[href*="/genre/"]'
        )
          .map((_, el) => cleanText($(el).text()))
          .get(),
        ...(Array.isArray(ld?.genre) ? ld.genre : ld?.genre ? [ld.genre] : []).map(cleanText),
      ].filter(Boolean)
    )
  );

  const categories = $(
    '.cat-links a, .breadcrumb a, a[href*="/category/"]'
  )
    .map((_, el) => cleanText($(el).text()))
    .get()
    .filter(Boolean);

  const ratingLabel = cleanText(
    metaMap.get('rating') ||
      metaMap.get('age rating') ||
      metaMap.get('mpa') ||
      $('.mpaa, .age-rating').first().text()
  );

  const synopsisRaw = cleanText(
    $('[itemprop="description"], .wp-content .synopsis, .entry-content > p, .synopsis')
      .map((_, el) => cleanText($(el).text()))
      .get()
      .filter((p) => p.length > 20)
      .join('\n\n') ||
      ld?.description ||
      $('meta[name="description"]').attr('content')
  );
  const synopsis = synopsisRaw || undefined;

  if (
    isRestrictedMovie({
      title,
      originalTitle,
      url: pageUrl,
      sourceUrl: pageUrl,
      genres,
      categories,
      ratingLabel,
      synopsis,
    })
  ) {
    return null;
  }

  const ldImage =
    typeof ld?.image === 'string' ? ld.image : ld?.image?.url;
  const poster =
    extractImageUrl($, $('.poster, .gmr-movie-data-top, article, main').first()[0] || $('body')[0], baseUrl) ||
    normalizeMovieUrl(ldImage, baseUrl) ||
    normalizeMovieUrl($('meta[property="og:image"]').attr('content'), baseUrl) ||
    undefined;

  const backdropCandidate = normalizeMovieUrl(
    $('.backdrop img, .gmr-movie-backdrop img').first().attr('src') ||
      $('meta[property="og:image"]').attr('content'),
    baseUrl
  );
  const backdrop =
    backdropCandidate && backdropCandidate !== poster ? backdropCandidate : undefined;

  const releaseDateRaw = cleanText(
    metaMap.get('release') ||
      metaMap.get('released') ||
      metaMap.get('rilis') ||
      metaMap.get('tanggal rilis') ||
      $('[itemprop="datePublished"]').first().text() ||
      ld?.datePublished
  );
  const releaseDate = releaseDateRaw || undefined;
  const year =
    parseYear(
      metaMap.get('year') || metaMap.get('tahun') || $('.year, .date').first().text()
    ) ??
    parseYear(releaseDate) ??
    extractedYear;

  const rating = parseRating(
    cleanText(
      $('[itemprop="ratingValue"], .dt_rating_vgs, .rating-value, .imdb-rating').first().text()
    ) ||
      (ld?.aggregateRating?.ratingValue !== undefined
        ? String(ld.aggregateRating.ratingValue)
        : undefined)
  );

  const durationRaw = cleanText(
    metaMap.get('duration') ||
      metaMap.get('durasi') ||
      metaMap.get('runtime') ||
      $('[itemprop="duration"], .runtime').first().text() ||
      ld?.duration
  );
  const duration = durationRaw || undefined;

  const countryRaw = cleanText(
    metaMap.get('country') ||
      metaMap.get('negara') ||
      $('[itemprop="countryOfOrigin"]').first().text() ||
      (typeof ld?.countryOfOrigin === 'string'
        ? ld.countryOfOrigin
        : ld?.countryOfOrigin?.name)
  );
  const country = countryRaw || undefined;

  const directorRaw = cleanText(
    metaMap.get('director') ||
      metaMap.get('sutradara') ||
      $('[itemprop="director"]').first().text() ||
      (typeof ld?.director === 'string'
        ? ld.director
        : Array.isArray(ld?.director)
          ? ld.director.map((d) => d.name).filter(Boolean).join(', ')
          : ld?.director?.name)
  );
  const director = directorRaw || undefined;

  const castFromDom = $(
    '[itemprop="actor"], .gmr-movie-cast a, .cast a, a[href*="/actor/"], a[href*="/cast/"]'
  )
    .map((_, el) => cleanText($(el).text()))
    .get()
    .filter(Boolean);
  const castFromMeta = (metaMap.get('cast') || metaMap.get('pemain') || metaMap.get('actors') || '')
    .split(',')
    .map(cleanText)
    .filter(Boolean);
  const castFromLd = (ld?.actor || [])
    .map((actor) => cleanText(typeof actor === 'string' ? actor : actor?.name))
    .filter(Boolean);
  const cast = Array.from(new Set([...castFromDom, ...castFromMeta, ...castFromLd]));

  const streamUrls: RumahFilmStreamSource[] = [];
  const seenStreams = new Set<string>();

  $('iframe[src], iframe[data-src]').each((idx, el) => {
    const src = normalizeMovieUrl($(el).attr('src') || $(el).attr('data-src'), baseUrl);
    if (!src || !isValidStreamUrl(src) || seenStreams.has(src)) return;
    seenStreams.add(src);
    streamUrls.push({
      label: cleanText($(el).attr('title')) || `Server ${idx + 1}`,
      url: src,
      kind: 'iframe',
    });
  });

  $('video source[src], video[src]').each((idx, el) => {
    const src = normalizeMovieUrl($(el).attr('src'), baseUrl);
    if (!src || !isValidStreamUrl(src) || seenStreams.has(src)) return;
    seenStreams.add(src);
    streamUrls.push({
      label: `Video ${idx + 1}`,
      url: src,
      kind: 'video',
    });
  });

  const slug = extractMovieSlug(pageUrl, baseUrl) || fallbackSlug;
  const sourceId = extractSourceId($('article').first());

  return {
    sourceId,
    title,
    slug,
    url: `/film/${encodeURIComponent(slug)}`,
    sourceUrl: pageUrl,
    ...(poster ? { poster } : {}),
    ...(backdrop ? { backdrop } : {}),
    ...(originalTitle ? { originalTitle } : {}),
    ...(year !== undefined ? { year } : {}),
    ...(rating !== undefined ? { rating } : {}),
    ...(genres.length > 0 ? { genres } : {}),
    ...(synopsis ? { synopsis } : {}),
    ...(director ? { director } : {}),
    ...(cast.length > 0 ? { cast } : {}),
    ...(duration ? { duration } : {}),
    ...(country ? { country } : {}),
    ...(releaseDate ? { releaseDate } : {}),
    ...(streamUrls.length > 0 ? { streamUrls } : {}),
    type: 'movie',
  };
}
