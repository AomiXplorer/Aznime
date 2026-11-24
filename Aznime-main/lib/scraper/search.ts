import * as cheerio from 'cheerio';
import type { AnimeCardItem, QuickSearchItem, SearchResponse } from './types';
import {
  BASE_URL,
  UpstreamError,
  extractSlug,
  fetchHtml,
  inferLinkKind,
  normalizeUrl,
  cleanAnimeTitle,
  parseAnimeCard,
  parsePagination,
  requestText,
} from './utils';

interface RawQuickSearchRow {
  ID?: number | string;
  post_title?: string;
  post_link?: string;
  post_image?: string;
  post_image_html?: string;
  post_genres?: string;
  post_type?: string;
  post_latest?: string;
  post_sub?: string;
}

interface RawQuickSearchGroup {
  all?: RawQuickSearchRow[];
}

interface RawQuickSearchPayload {
  anime?: RawQuickSearchGroup[] | RawQuickSearchGroup;
}

export function parseQuickSearchPayload(rawBody: string): QuickSearchItem[] {
  const trimmed = rawBody.trim();
  if (!trimmed || trimmed === '0' || trimmed === '-1' || trimmed === '[]') {
    return [];
  }

  let data: RawQuickSearchPayload | RawQuickSearchRow[];
  try {
    data = JSON.parse(trimmed) as RawQuickSearchPayload | RawQuickSearchRow[];
  } catch {
    throw new UpstreamError('Respons pencarian cepat bukan JSON yang valid dari server sumber.', {
      status: 502,
    });
  }

  let rawItems: RawQuickSearchRow[] = [];
  if (Array.isArray(data)) {
    rawItems = data;
  } else if (data && typeof data === 'object') {
    const animeField = data.anime;
    if (Array.isArray(animeField)) {
      for (const group of animeField) {
        if (group && Array.isArray(group.all)) {
          rawItems.push(...group.all);
        }
      }
    } else if (animeField && typeof animeField === 'object' && Array.isArray(animeField.all)) {
      rawItems = animeField.all;
    }
  }

  const items: QuickSearchItem[] = [];
  for (const item of rawItems) {
    if (!item || typeof item !== 'object') continue;
    const rawTitle = (item.post_title || '').replace(/\s+/g, ' ').trim();
    const title = cleanAnimeTitle(rawTitle);
    const link = normalizeUrl(item.post_link);
    if (!title || !link) continue;

    let poster = normalizeUrl(item.post_image);
    if (!poster && item.post_image_html) {
      const $img = cheerio.load(item.post_image_html);
      const htmlSrc =
        $img('img').attr('data-src') ||
        $img('img').attr('data-lazy-src') ||
        $img('img').attr('src');
      poster = normalizeUrl(htmlSrc);
    }

    items.push({
      postId: String(item.ID ?? ''),
      title,
      slug: extractSlug(link),
      url: link,
      kind: inferLinkKind(link),
      poster,
      genres: item.post_genres
        ? item.post_genres
            .split(',')
            .map((g) => g.trim())
            .filter(Boolean)
        : [],
      type: item.post_type?.trim() || null,
      latestEpisode: item.post_latest?.trim() || null,
      sub: item.post_sub?.trim() || null,
      source: 'hidori',
      isBatch: /^batch\b/i.test(rawTitle),
    });
  }

  return items;
}

export async function search(query: string, page = 1): Promise<SearchResponse> {
  const trimmed = query.trim();
  if (!trimmed) {
    throw new Error('Kata kunci pencarian wajib diisi');
  }

  const pageNum = Math.max(1, page || 1);
  const q = encodeURIComponent(trimmed);
  const url = pageNum > 1 ? `${BASE_URL}/page/${pageNum}/?s=${q}` : `${BASE_URL}/?s=${q}`;
  const { $ } = await fetchHtml(url, 60);

  const results: AnimeCardItem[] = [];
  $('.listupd article').each((_, art) => {
    results.push(parseAnimeCard($, art));
  });

  return {
    query: trimmed,
    pagination: parsePagination($, pageNum),
    results,
  };
}

export async function quickSearch(query: string): Promise<QuickSearchItem[]> {
  const trimmed = query.trim();
  if (!trimmed) {
    return [];
  }

  const body = `action=ts_ac_do_search&ts_ac_query=${encodeURIComponent(trimmed)}`;
  const res = await requestText(`${BASE_URL}/wp-admin/admin-ajax.php`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      'X-Requested-With': 'XMLHttpRequest',
    },
    body,
    revalidate: 0,
  });

  return parseQuickSearchPayload(res.body);
}
