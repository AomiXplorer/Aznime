import type {
  AnimeCardItem,
  AnimeListOptions,
  AnimeListResponse,
  BlogListResponse,
  BlogPostDetail,
  BlogPostSummary,
  FeaturedAnime,
  FilterOptionItem,
  FilterOptionsMap,
  HomeData,
  ListModeEntry,
  ListModeResponse,
  OngoingSidebarItem,
  PopularAnimeItem,
  ScheduleItem,
  ScheduleMap,
  TaxonomyResponse,
} from './types';
import { cleanGenres } from '@/lib/genres';
import {
  BASE_URL,
  cleanAnimeTitle,
  extractSlug,
  fetchHtml,
  inferLinkKind,
  normalizeUrl,
  parseAnimeCard,
  parseImgSrc,
  parsePagination,
} from './utils';

export async function getHome(page = 1): Promise<HomeData> {
  const pageNum = Math.max(1, Math.trunc(page) || 1);
  const url = pageNum > 1 ? `${BASE_URL}/page/${pageNum}/` : `${BASE_URL}/`;
  const { $ } = await fetchHtml(url, 180);

  const featured: FeaturedAnime[] = [];
  $('.slidtop .slide-item').each((_, el) => {
    const titleAnchor = $(el).find('.info-left .title a').first();
    const posterAnchor = $(el).find('.poster a').first();
    const itemUrl = normalizeUrl(titleAnchor.attr('href') || posterAnchor.attr('href'));
    const posterImg = $(el).find('.poster img').not('noscript img').first();
    const title = (
      titleAnchor.text().trim() ||
      titleAnchor.attr('title')?.trim() ||
      posterAnchor.attr('title')?.trim() ||
      posterImg.attr('title')?.trim() ||
      posterImg.attr('alt')?.trim() ||
      ''
    )
      .replace(/\s+/g, ' ')
      .trim();
    const displayTitle = cleanAnimeTitle(title);
    const releaseYear = $(el).find('.release-year').text().trim() || null;
    const genres = $(el)
      .find('.extra-category a')
      .map((_, a) => $(a).text().trim())
      .get()
      .filter(Boolean);
    const synopsis = $(el).find('.excerpt .story').text().trim() || null;
    const status =
      $(el).find('.cast .director').text().replace(/^Status:\s*/i, '').trim() || null;
    const type = $(el).find('.cast .actor').text().replace(/^Tipe:\s*/i, '').trim() || null;
    const poster = parseImgSrc($, $(el).find('.poster').get(0) || el);

    if (title && itemUrl) {
      featured.push({
        title: displayTitle,
        slug: extractSlug(itemUrl),
        url: itemUrl,
        poster,
        releaseYear,
        status,
        type,
        genres,
        synopsis,
      });
    }
  });

  const latestRelease: AnimeCardItem[] = [];
  const completedLatest: AnimeCardItem[] = [];
  const blogLatest: BlogPostSummary[] = [];

  $('.bixbox').each((_, box) => {
    const heading = $(box)
      .find('.releases h1, .releases h2, .releases h3, h3')
      .first()
      .text()
      .trim()
      .toLowerCase();

    if (heading.includes('rilisan terbaru')) {
      $(box)
        .find('.listupd article')
        .each((_, art) => {
          latestRelease.push(parseAnimeCard($, art));
        });
    } else if (heading.includes('complete')) {
      $(box)
        .find('.listupd article')
        .each((_, art) => {
          completedLatest.push(parseAnimeCard($, art));
        });
    } else if (heading.includes('blog')) {
      $(box)
        .find('article')
        .each((_, art) => {
          const a = $(art).find('h2 a, h3 a, a').first();
          const postUrl = normalizeUrl(a.attr('href'));
          const postTitle = a.text().trim() || $(art).find('.tt, h2, h3').first().text().trim();
          if (postTitle) {
            blogLatest.push({
              title: postTitle,
              slug: extractSlug(postUrl),
              url: postUrl,
              image: parseImgSrc($, art),
              excerpt: $(art).find('p, .entry-content').first().text().trim() || null,
            });
          }
        });
    }
  });

  const ongoingSidebar: OngoingSidebarItem[] = [];
  $('#sidebar .section').each((_, sec) => {
    const h = $(sec).find('.releases h3, h3').first().text().trim().toLowerCase();
    if (h.includes('ongoing')) {
      $(sec)
        .find('li a')
        .each((_, a) => {
          const itemUrl = normalizeUrl($(a).attr('href'));
          const title =
            $(a).find('.l').text().trim() || $(a).attr('title')?.trim() || $(a).text().trim();
          const episode = $(a).find('.r').text().trim() || null;
          if (title) {
            ongoingSidebar.push({
              title,
              episode,
              slug: extractSlug(itemUrl),
              url: itemUrl,
              kind: inferLinkKind(itemUrl),
            });
          }
        });
    }
  });

  const parseWpop = (selector: string): PopularAnimeItem[] => {
    const list: PopularAnimeItem[] = [];
    $(selector)
      .find('li')
      .each((_, li) => {
        const rank = parseInt($(li).find('.ctr').text().trim(), 10) || list.length + 1;
        const a = $(li).find('h4 a.series, .leftseries a').first();
        const itemUrl = normalizeUrl(a.attr('href'));
        const genres = $(li)
          .find('.leftseries span a')
          .map((_, g) => $(g).text().trim())
          .get()
          .filter(Boolean);
        const title = a.text().trim();
        if (title) {
          list.push({
            rank,
            postId: a.attr('rel') || null,
            title,
            slug: extractSlug(itemUrl),
            url: itemUrl,
            poster: parseImgSrc($, li),
            genres,
          });
        }
      });
    return list;
  };

  return {
    page: pageNum,
    pagination: parsePagination($, pageNum),
    featured,
    latestRelease,
    completedLatest,
    ongoingSidebar,
    popular: {
      weekly: parseWpop('.wpop-weekly'),
      monthly: parseWpop('.wpop-monthly'),
      alltime: parseWpop('.wpop-alltime'),
    },
    blogLatest,
  };
}

export async function getAnimeList(options: AnimeListOptions = {}): Promise<AnimeListResponse> {
  const pageNum = Math.max(1, options.page || 1);
  const params = new URLSearchParams();

  if (pageNum > 1) params.set('page', String(pageNum));
  if (options.status) params.set('status', options.status);
  if (options.type) params.set('type', options.type);
  if (options.sub) params.set('sub', options.sub);
  if (options.order) params.set('order', options.order);

  const appendMulti = (key: string, val?: string | string[]) => {
    if (!val) return;
    const arr = Array.isArray(val)
      ? val
      : val
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean);
    for (const v of arr) {
      params.append(`${key}[]`, v);
    }
  };

  appendMulti('genre', options.genre);
  appendMulti('season', options.season);
  appendMulti('studio', options.studio);

  const qs = params.toString();
  const url = `${BASE_URL}/anime/${qs ? `?${qs}` : ''}`;
  const { $ } = await fetchHtml(url, 120);

  const results: AnimeCardItem[] = [];
  $('.listupd article').each((_, art) => {
    results.push(parseAnimeCard($, art));
  });

  return {
    filters: {
      status: options.status || '',
      type: options.type || '',
      sub: options.sub || '',
      order: options.order || '',
      genre: options.genre || [],
      season: options.season || [],
      studio: options.studio || [],
    },
    pagination: parsePagination($, pageNum),
    results,
  };
}

export async function getFilterOptions(): Promise<FilterOptionsMap> {
  const { $ } = await fetchHtml(`${BASE_URL}/anime/`, 3600);
  const options: FilterOptionsMap = {};

  $('.advancedsearch .filter.dropdown').each((_, el) => {
    const rawLabel = $(el).find('button').first().text().trim().replace(/\s+/g, ' ');
    const key = rawLabel.split(' ')[0].toLowerCase();
    const items: FilterOptionItem[] = [];

    $(el)
      .find('ul li')
      .each((_, li) => {
        const inp = $(li).find('input').first();
        const label = $(li).find('label').text().trim();
        const value = inp.attr('value') ?? '';
        if (label) {
          items.push({ label, value });
        }
      });

    if (key) {
      /* Genre sumber memuat judul anime; hanya genre yang benar-benar ada yang
         dipakai supaya panel filter tidak berisi pilihan aneh. */
      options[key] = key === 'genre' ? cleanGenres(items) : items;
    }
  });

  return options;
}

export async function getListMode(): Promise<ListModeResponse> {
  const { $ } = await fetchHtml(`${BASE_URL}/anime/list-mode/`, 1800);
  const groups: Record<string, ListModeEntry[]> = {};
  let total = 0;

  $('.blix').each((_, block) => {
    const letter = $(block).find('span a').first().text().trim() || '#';
    const items: ListModeEntry[] = [];
    $(block)
      .find('ul li a')
      .each((_, a) => {
        const url = normalizeUrl($(a).attr('href'));
        const title = $(a).text().trim();
        if (url && title) {
          items.push({
            title,
            slug: extractSlug(url),
            url,
          });
          total += 1;
        }
      });
    groups[letter] = items;
  });

  return { total, groups };
}

export const getLatest = (page = 1) => getAnimeList({ order: 'update', page });
export const getOngoing = (page = 1) => getAnimeList({ status: 'ongoing', order: 'update', page });
export const getCompleted = (page = 1) =>
  getAnimeList({ status: 'completed', order: 'update', page });
export const getUpcoming = (page = 1) => getAnimeList({ status: 'upcoming', page });
export const getMovie = (page = 1) => getAnimeList({ type: 'movie', order: 'update', page });
export const getPopular = (page = 1) => getAnimeList({ order: 'popular', page });
export const getTopRated = (page = 1) => getAnimeList({ order: 'rating', page });

export async function getSchedule(): Promise<ScheduleMap> {
  const { $ } = await fetchHtml(`${BASE_URL}/schedule/`, 300);
  const schedule: ScheduleMap = {};

  $('.schedulepage .bixbox, .bixbox').each((_, box) => {
    const day = $(box).find('.releases h3, h3').first().text().trim();
    const items: ScheduleItem[] = [];

    $(box)
      .find('.bsx')
      .each((_, bsx) => {
        const a = $(bsx).find('a').first();
        const url = normalizeUrl(a.attr('href'));
        const title = (a.attr('title') || $(bsx).find('.tt').text()).trim();
        const epx = $(bsx).find('.epx');
        const releaseTime = epx.text().trim() || null;
        const countdownRaw = epx.attr('data-cndwn');
        const parsedCountdown =
          countdownRaw !== undefined ? parseInt(countdownRaw, 10) : Number.NaN;
        const episode = $(bsx).find('.sb').text().trim() || null;

        if (url && title) {
          items.push({
            title,
            slug: extractSlug(url),
            url,
            poster: parseImgSrc($, bsx),
            releaseTime,
            countdownSeconds: Number.isNaN(parsedCountdown) ? null : parsedCountdown,
            episode,
          });
        }
      });

    if (day && items.length > 0) {
      schedule[day] = items;
    }
  });

  return schedule;
}

export async function getByTaxonomy(
  type: string,
  slug: string,
  page = 1
): Promise<TaxonomyResponse> {
  if (!type || !slug) throw new Error('Taxonomy type and slug are required');
  const pageNum = Math.max(1, page || 1);
  const cleanType = type.replace(/^\/+|\/+$/g, '');
  const cleanSlug = slug.replace(/^\/+|\/+$/g, '');
  const url =
    pageNum > 1
      ? `${BASE_URL}/${cleanType}/${cleanSlug}/page/${pageNum}/`
      : `${BASE_URL}/${cleanType}/${cleanSlug}/`;
  const { $ } = await fetchHtml(url, 180);

  const results: AnimeCardItem[] = [];
  $('.listupd article').each((_, art) => {
    results.push(parseAnimeCard($, art));
  });

  return {
    taxonomy: cleanType,
    slug: cleanSlug,
    title: $('.releases h1, .releases h3').first().text().trim() || cleanSlug,
    pagination: parsePagination($, pageNum),
    results,
  };
}

export const getByGenre = (genreSlug: string, page = 1) =>
  getByTaxonomy('genres', genreSlug, page);

export async function getPopularWeekly() {
  const home = await getHome(1);
  return home.popular;
}

export async function getBlog(page = 1): Promise<BlogListResponse> {
  const pageNum = Math.max(1, Math.trunc(page) || 1);
  const url = pageNum > 1 ? `${BASE_URL}/blog/page/${pageNum}/` : `${BASE_URL}/blog/`;
  const { $ } = await fetchHtml(url, 300);

  const posts: BlogPostSummary[] = [];
  $('article').each((_, art) => {
    const a = $(art).find('h2 a, h3 a, .tt a, a').first();
    const postUrl = normalizeUrl(a.attr('href'));
    const title = a.text().trim() || $(art).find('h2, h3, .tt').first().text().trim();
    if (postUrl && title) {
      posts.push({
        title,
        slug: extractSlug(postUrl),
        url: postUrl,
        image: parseImgSrc($, art),
        excerpt: $(art).find('p, .entry-content').first().text().trim() || null,
      });
    }
  });

  return {
    pagination: parsePagination($, pageNum),
    posts,
  };
}

export async function getBlogDetail(slugOrUrl: string): Promise<BlogPostDetail> {
  if (!slugOrUrl) throw new Error('Blog slug or URL is required');
  let targetUrl = slugOrUrl;
  if (!slugOrUrl.startsWith('http')) {
    const clean = slugOrUrl.replace(/^\/+|\/+$/g, '').replace(/^blog\//, '');
    targetUrl = `${BASE_URL}/blog/${encodeURIComponent(clean)}/`;
  }
  const { $, url } = await fetchHtml(targetUrl, 300);

  return {
    title: $('h1.entry-title').first().text().trim(),
    slug: extractSlug(url),
    url,
    date: $('.updated, .post-date, time').first().text().trim() || null,
    contentText: $('.entry-content').first().text().trim(),
    contentHtml: $('.entry-content').first().html(),
  };
}
