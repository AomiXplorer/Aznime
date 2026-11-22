import type { EpisodeData, EpisodeNavLink, MirrorServer } from './types';
import {
  decodeMirrorOption,
  extractSlug,
  fetchHtml,
  normalizeUrl,
  parseDownloadBoxes,
  resolvePostUrl,
} from './utils';

export async function getEpisode(slugOrUrl: string): Promise<EpisodeData> {
  const targetUrl = resolvePostUrl(slugOrUrl);
  const { $, url } = await fetchHtml(targetUrl, 120);

  const title = $('h1.entry-title').first().text().trim();
  const defaultEmbed = normalizeUrl(
    $('#embed_holder iframe, .player-embed iframe').first().attr('src') ||
      $('#embed_holder iframe, .player-embed iframe').first().attr('data-src')
  );

  const servers: MirrorServer[] = [];
  $('select.mirror option').each((_, opt) => {
    const name = $(opt).text().trim();
    const val = $(opt).attr('value');
    if (!val) return;
    servers.push(decodeMirrorOption(name, val));
  });

  const downloads = parseDownloadBoxes($);

  const nav: {
    prev: EpisodeNavLink | null;
    all: EpisodeNavLink | null;
    next: EpisodeNavLink | null;
  } = { prev: null, all: null, next: null };

  $('.naveps a').each((_, a) => {
    const href = normalizeUrl($(a).attr('href'));
    const txt = $(a).text().trim().toLowerCase();
    if (!href) return;

    const item: EpisodeNavLink = {
      title: $(a).text().trim(),
      slug: extractSlug(href),
      url: href,
    };

    if (txt.includes('prev') || $(a).attr('rel') === 'prev') {
      nav.prev = item;
    } else if (txt.includes('next') || $(a).attr('rel') === 'next') {
      nav.next = item;
    } else if (txt.includes('semua') || href.includes('/anime/')) {
      nav.all = item;
    }
  });

  const seriesLink = $('.headpost a[href*="/anime/"], .detpost a[href*="/anime/"]').first();
  const seriesUrl = normalizeUrl(seriesLink.attr('href')) || nav.all?.url || null;

  return {
    title,
    slug: extractSlug(url),
    url,
    series: seriesUrl
      ? {
          title: seriesLink.text().trim() || null,
          slug: extractSlug(seriesUrl),
          url: seriesUrl,
        }
      : null,
    defaultEmbed,
    servers,
    downloads,
    navigation: nav,
  };
}
