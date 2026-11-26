import type { AnimeCardItem, AnimeDetail, EpisodeSummary, GenreRef } from './types';
import {
  extractSlug,
  fetchHtml,
  normalizeUrl,
  parseAnimeCard,
  parseDownloadBoxes,
  parseImgSrc,
  resolveAnimeUrl,
  resolvePostUrl,
} from './utils';

export async function getDetail(slugOrUrl: string): Promise<AnimeDetail> {
  const targetUrl = resolveAnimeUrl(slugOrUrl);
  const { $, url } = await fetchHtml(targetUrl, 300);

  const title = $('h1.entry-title').first().text().trim();
  const altTitle = $('.alter').first().text().trim() || null;
  const ratingText = $('.rating strong').first().text().replace(/Rating/i, '').trim() || null;
  const poster = parseImgSrc($, '.thumb');
  const synopsis =
    $('.entry-content[itemprop="description"], .synp .entry-content').first().text().trim() ||
    null;

  const info: Record<string, string> = {};
  $('.infox .spe span').each((_, span) => {
    const fullText = $(span).text().trim();
    const colonIdx = fullText.indexOf(':');
    if (colonIdx !== -1) {
      const key = fullText.slice(0, colonIdx).trim();
      const val = fullText.slice(colonIdx + 1).trim();
      if (key && val) info[key] = val;
    }
  });

  const genres: GenreRef[] = [];
  $('.genxed a').each((_, a) => {
    const gUrl = normalizeUrl($(a).attr('href'));
    const name = $(a).text().trim();
    if (name) {
      genres.push({
        name,
        slug: extractSlug(gUrl),
        url: gUrl,
      });
    }
  });

  const episodes: EpisodeSummary[] = [];
  $('.eplister ul li').each((_, li) => {
    const a = $(li).find('a').first();
    const epUrl = normalizeUrl(a.attr('href'));
    const number = $(li).find('.epl-num').text().trim() || null;
    const epTitle = $(li).find('.epl-title').text().trim() || a.text().trim();
    const date = $(li).find('.epl-date').text().trim() || null;

    if (epUrl) {
      episodes.push({
        number,
        title: epTitle,
        date,
        slug: extractSlug(epUrl),
        url: epUrl,
      });
    }
  });

  if (/^movie$/i.test(info.Tipe || info.Type || '') && episodes.length <= 1) {
    if (episodes[0]) {
      if (!episodes[0].number || /^movie$/i.test(episodes[0].number)) episodes[0].number = '1';
    } else {
      const slug = extractSlug(url);
      if (slug) episodes.push({ title, slug, url: resolvePostUrl(slug), number: '1', date: null });
    }
  }

  const batchDownloads = parseDownloadBoxes($);

  const recommendations: AnimeCardItem[] = [];
  $('.bixbox .listupd article').each((_, art) => {
    recommendations.push(parseAnimeCard($, art));
  });

  return {
    title,
    altTitle,
    slug: extractSlug(url),
    url,
    poster,
    rating: ratingText,
    synopsis,
    info,
    genres,
    totalEpisodes: episodes.length,
    episodes,
    batchDownloads,
    recommendations,
  };
}
