/**
 * m.webtoons.com — single-file scraper / API client
 * Reverse-engineered dari halaman + bundle JS (search.js, titleHome.js).
 * - Node 18+ : const wt = require('./webtoons.js')
 * - Browser  : <script src="webtoons.js"></script> -> window.WebToons
 * Read-only, tidak login, tidak mengubah apa pun.
 */

  // ---------------------------------------------------------------- BASE
  const BASE = 'https://m.webtoons.com';
  const API = BASE + '/api/v1';
  const IMG = 'https://webtoon-phinf.pstatic.net';
  const UA = 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 ' +
             '(KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36';
  const LANGS = ['en', 'id', 'th', 'zh', 'ja', 'ko', 'fr', 'de', 'es', 'pt', 'ru'];

  const ENDPOINTS = {
    home:      BASE + '/',
    homeLang:  BASE + '/%s/',
    searchPage:BASE + '/%s/search?keyword=%s',
    search:    BASE + '/%s/search/result',
    trending:  BASE + '/%s/search/trending-titles',
    titleList: BASE + '/%s/%s/%s/list?title_no=%s',
    viewer:    BASE + '/%s/%s/%s/episode-%s/viewer?title_no=%s&episode_no=%s',
    episodes:  API + '/%s/%s/episodes',      // webtoon|canvas / titleNo
    titleInfo: API + '/title/%s'              // (tidak dipakai; dari HTML)
  };

  // -------------------------------------------------------------- helpers
  function decode(s) {
    return String(s == null ? '' : s)
      .replace(/&#039;|&#39;/g, "'").replace(/&#038;/g, '&')
      .replace(/&quot;/g, '"').replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
      .replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
  }
  function tag(html, re, group = 1) {
    const m = re.exec(html);
    return m ? decode(m[group]) : null;
  }
  function all(html, re, fn) {
    if (!re.global) re = new RegExp(re.source, re.flags + 'g');
    const out = []; let m;
    while ((m = re.exec(html)) !== null) {
      if (!m[0]) { re.lastIndex++; continue; }
      out.push(fn ? fn(m) : decode(m[1]));
    }
    return out;
  }
  /**
   * src gambar pertama di satu potongan HTML.
   *
   * WEBTOON menyisipkan `loading="lazy"` sebelum `src` pada kartu yang lebih
   * jauh dari layar, jadi mencocokkan `<img src="` secara harfiah melewatkan
   * separuh sampul. Atributnya dicari tanpa peduli urutan, termasuk data-src
   * dan srcset sebagai cadangan.
   */
  function firstImageSrc(fragment) {
    const img = /<img\b[^>]*>/i.exec(fragment || '');
    if (!img) return null;
    const attrs = img[0];
    const match = /\ssrc="([^"]+)"/i.exec(attrs) ||
                  /\sdata-src="([^"]+)"/i.exec(attrs) ||
                  /\ssrcset="([^",\s]+)/i.exec(attrs);
    return match ? imageUrl(decode(match[1])) : null;
  }
  function slugify(s) {
    return decode(s).normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
      .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  }
  function imageUrl(path, domain) {
    if (!path) return null;
    if (/^https?:\/\//i.test(path)) return path;
    if (path.startsWith('//')) return 'https:' + path;
    return (domain || IMG).replace(/\/$/, '') + (path.startsWith('/') ? path : '/' + path);
  }
  function extractBalanced(text, from, openCh = '{', closeCh = '}') {
    const start = text.indexOf(openCh, from);
    if (start < 0) return null;
    let depth = 0, inStr = false, esc = false, quote = '';
    for (let i = start; i < text.length; i++) {
      const c = text[i];
      if (inStr) {
        if (esc) { esc = false; continue; }
        if (c === '\\') { esc = true; continue; }
        if (c === quote) inStr = false;
        continue;
      }
      if (c === '"' || c === "'") { inStr = true; quote = c; continue; }
      if (c === openCh) depth++;
      else if (c === closeCh) { depth--; if (depth === 0) return text.slice(start, i + 1); }
    }
    return null;
  }
  function parseJsonObject(text, marker) {
    const i = text.indexOf(marker);
    if (i < 0) return null;
    const raw = extractBalanced(text, i + marker.length - 1, '{', '}');
    if (!raw) return null;
    try { return JSON.parse(raw); } catch (_) {
      try { return JSON.parse(raw.replace(/'/g, '"')); } catch (_) { return null; }
    }
  }

  /** URL/slug/judul -> info. Contoh:
   *  https://m.webtoons.com/en/action/eleceed/list?title_no=1571
   *  https://m.webtoons.com/en/action/eleceed/episode-300/viewer?title_no=1571&episode_no=300
   */
  function parseInput(input) {
    if (!input) return null;
    let url = String(input).trim();
    let lang = 'en', genre = null, slug = null, titleNo = null, episodeNo = null;
    let parsed = null;
    try { parsed = new URL(/^https?:\/\//i.test(url) ? url : BASE + '/' + url.replace(/^\//, '')); } catch (_) { /* noop */ }
    if (parsed) {
      const parts = parsed.pathname.split('/').filter(Boolean);
      lang = parts[0] || 'en';
      if (LANGS.indexOf(lang) === -1) { lang = 'en'; }
      if (parts[1] && parts[1] !== 'search' && parts[1] !== 'canvas') genre = parts[1];
      if (parts[2] && parts[2] !== 'list' && parts[2] !== 'viewer') slug = parts[2];
      titleNo = parsed.searchParams.get('title_no') || parsed.searchParams.get('titleNo') || null;
      episodeNo = parsed.searchParams.get('episode_no') || parsed.searchParams.get('episodeNo') || null;
      if (!episodeNo && parts[2] && /^episode-\d+$/.test(parts[2])) {
        episodeNo = parts[2].replace('episode-', '');
      }
    } else {
      slug = slugify(url);
    }
    return {
      lang, genre, slug,
      titleNo: titleNo ? +titleNo : null,
      episodeNo: episodeNo ? +episodeNo : null,
      url: parsed ? parsed.href : null
    };
  }
  function getSlug(input) {
    const p = parseInput(input);
    return p && (p.slug || slugify(String(input).split('?')[0].split('/').filter(Boolean).pop() || ''));
  }
  function getTitleNo(input) { const p = parseInput(input); return p && p.titleNo; }
  function getEpisodeNo(input) { const p = parseInput(input); return p && p.episodeNo; }

  async function req(url, opts = {}) {
    const res = await fetch(url, {
      headers: Object.assign({ 'User-Agent': UA, 'Accept': 'application/json, text/html;q=0.9, */*;q=0.8' },
                             opts.headers || {}),
      signal: opts.signal || AbortSignal.timeout(opts.timeout || 25000)
    });
    if (!res.ok && opts.strict !== false) throw new Error('HTTP ' + res.status + ' for ' + url);
    const ct = res.headers.get('content-type') || '';
    return ct.includes('json') ? res.json() : res.text();
  }

  // --------------------------------------------------------------- SEARCH
  /** searchType: ALL | WEBTOON | CHALLENGE. start = halaman (1-based). */
  async function search(query, opts = {}) {
    if (!query) return [];
    const lang = opts.lang || 'en';
    const type = opts.searchType || 'ALL';
    const url = ENDPOINTS.search.replace('%s', lang) +
      '?keyword=' + encodeURIComponent(query) +
      '&searchType=' + encodeURIComponent(type) +
      '&start=' + (+opts.start || 1);
    const j = await req(url, { headers: { 'X-Requested-With': 'XMLHttpRequest', 'Referer': BASE + '/' + lang } });
    if (!j.success) return [];
    const r = j.result || {};
    const domain = r.imageDomain || IMG;
    const normalize = (x, kind) => ({
      titleNo: x.titleNo,
      title: decode(x.title),
      slug: x.titleGroupName ? slugify(x.titleGroupName) : slugify(x.title),
      group: x.titleGroupName || null,
      genre: x.representGenre ? (x.representGenre.displayName || x.representGenre.seoCode) : null,
      type: kind,
      thumbnail: x.thumbnailMobile ? imageUrl(x.thumbnailMobile, domain) :
                 (x.thumbnail ? imageUrl(x.thumbnail, domain) : null),
      author: x.writingAuthorName || x.pictureAuthorName || null,
      readCount: x.readCount || 0,
      lastUpdate: x.lastEpisodeRegisterYmdt ? new Date(+x.lastEpisodeRegisterYmdt).toISOString() : null,
      url: (kind === 'CHALLENGE' ? BASE + '/en/canvas/' : BASE + '/en/') +
           (x.titleGroupName ? slugify(x.titleGroupName) : slugify(x.title)) +
           '/list?title_no=' + x.titleNo
    });
    const web = (r.webtoonResult && r.webtoonResult.titleList || []).map((x) => normalize(x, 'WEBTOON'));
    const ch = (r.challengeResult && r.challengeResult.titleList || []).map((x) => normalize(x, 'CHALLENGE'));
    return {
      webtoonTotal: (r.webtoonResult && r.webtoonResult.totalCount) || 0,
      challengeTotal: (r.challengeResult && r.challengeResult.totalCount) || 0,
      results: web.concat(ch)
    };
  }
  async function searchTitles(query, opts) { return (await search(query, opts)).results; }
  function trending(opts = {}) {
    return req(ENDPOINTS.trending.replace('%s', opts.lang || 'en'), {
      headers: { 'X-Requested-With': 'XMLHttpRequest' }
    }).then((j) => ((j.result && j.result.trendingTitles) || []).map((x) => ({
      rank: x.trendingNo,
      titleNo: x.titleNo,
      title: decode(x.title),
      slug: x.titleGroupName || slugify(x.title),
      type: x.webtoonType,
      genre: x.representGenre || null,
      thumbnail: imageUrl(x.thumbnail)
    })));
  }

  // --------------------------------------------------------------- TITLE
  /** Detail series dari halaman /list (inline __titleHomeState__.dto). */
  async function getTitle(slugOrUrl, opts = {}) {
    const info = parseInput(slugOrUrl);
    const lang = opts.lang || info.lang || 'en';
    const genre = info.genre || 'action';
    const slug = info.slug || slugify(String(slugOrUrl).split('?')[0].split('/').pop());
    const titleNo = info.titleNo || opts.titleNo;
    if (!titleNo) throw new Error('titleNo tidak ditemukan. Kasih URL /list?title_no=... atau opts.titleNo');
    const url = ENDPOINTS.titleList.replace('%s', lang).replace('%s', genre)
      .replace('%s', slug).replace('%s', titleNo);
    const html = await req(url, { strict: false, signal: opts.signal });
    if (typeof html !== 'string') throw new Error('Gagal ambil halaman title');
    const idx = html.indexOf('__titleHomeState__');
    if (idx < 0) throw new Error('__titleHomeState__ tidak ditemukan');
    const statePart = html.slice(idx);
    const dto = parseJsonObject(statePart, 'dto:');
    if (!dto || !dto.title) throw new Error('__titleHomeState__.dto tidak ditemukan');
    const t = dto.title;
    const domain = tag(statePart, /imageDomain:\s*'([^']+)'/) || IMG;
    return {
      titleNo: t.titleNo,
      title: decode(t.title),
      slug: slugify(t.titleGroupName || t.title),
      group: t.titleGroupName || null,
      lang,
      genre: t.representGenre ? (t.representGenre.displayName || t.representGenre.seoCode) : genre,
      genreSlug: t.representGenre ? t.representGenre.seoCode : genre,
      status: t.titleStatusString || null,
      synopsis: decode(t.synopsis),
      author: dto.tag && dto.tag.authorList ? dto.tag.authorList.join(' / ') :
              (tag(html, /property=":webtoon:author" content="([^"]+)"/)),
      tags: (dto.tag && dto.tag.tagList) || [],
      thumbnail: imageUrl(t.posterThumbnail, domain),
      thumbnailVertical: imageUrl(t.thumbnailVertical, domain),
      readCount: t.readCount || 0,
      favoriteCount: t.favoriteCount || 0,
      rating: t.contentRating || null,
      mature: !!t.mature,
      lastUpdate: t.lastEpisodeRegisterEpochMillis ?
                  new Date(+t.lastEpisodeRegisterEpochMillis).toISOString() : null,
      url: BASE + (t.titleHomePcUrl || '/' + lang + '/' + genre + '/' + slug + '/list?title_no=' + titleNo)
    };
  }

  /** Daftar episode via /api/v1/<webtoon|canvas>/<titleNo>/episodes (pagination cursor). */
  async function getEpisodes(titleNoOrUrl, opts = {}) {
    const info = parseInput(titleNoOrUrl);
    const titleNo = info.titleNo || +titleNoOrUrl;
    if (!titleNo) throw new Error('titleNo wajib');
    const type = opts.type || (/canvas/i.test(String(titleNoOrUrl)) ? 'canvas' : 'webtoon');
    const lang = opts.lang || info.lang || 'en';
    const pageSize = +opts.pageSize || 30;
    let cursor = opts.cursor == null ? 0 : +opts.cursor;
    const out = [];
    const maxPages = +opts.maxPages || 50;
    for (let page = 0; page < maxPages; page++) {
      const url = ENDPOINTS.episodes.replace('%s', type).replace('%s', titleNo) +
        '?pageSize=' + pageSize + '&cursor=' + cursor + '&readingLanguageCode=' + lang;
      const j = await req(url, { headers: { 'X-Requested-With': 'XMLHttpRequest', 'Referer': BASE + '/' + lang }, signal: opts.signal });
      const r = j.result || {};
      (r.episodeList || []).forEach((e) => out.push({
        episodeNo: e.episodeNo,
        title: decode(e.episodeTitle),
        slug: slugify(e.episodeTitle),
        thumb: imageUrl(e.thumbnail),
        viewerLink: e.viewerLink ? (e.viewerLink.startsWith('http') ? e.viewerLink : BASE + e.viewerLink) : null,
        date: e.exposureDateMillis ? new Date(+e.exposureDateMillis).toISOString() : null,
        up: !!e.displayUp
      }));
      cursor = +r.nextCursor || 0;
      if (!cursor || !(r.episodeList || []).length) break;
    }
    return out;
  }

  // --------------------------------------------------------------- VIEWER
  /** Gambar episode dari halaman viewer (var imageList = [...]). */
  async function getViewer(titleNoOrUrl, opts = {}) {
    const info = parseInput(titleNoOrUrl);
    const titleNo = info.titleNo || opts.titleNo;
    const episodeNo = info.episodeNo || opts.episodeNo;
    if (!titleNo || !episodeNo) throw new Error('butuh titleNo + episodeNo (atau URL viewer)');
    const genre = info.genre || opts.genre || 'action';
    const slug = info.slug || opts.slug || 'title';
    const lang = opts.lang || info.lang || 'en';
    const url = ENDPOINTS.viewer.replace('%s', lang).replace('%s', genre)
      .replace('%s', slug).replace(/%s/g, String(episodeNo))
      .replace('title_no=' + episodeNo, 'title_no=' + titleNo);
    const html = await req(url, { strict: false, signal: opts.signal });
    if (typeof html !== 'string') throw new Error('Gagal ambil viewer');
    const start = html.indexOf('var imageList');
    const block = start >= 0 ? extractBalanced(html, start, '[', ']') : null;
    const images = block ? all(block, /\{\s*url:\s*"([^"]+)"([\s\S]*?)\}/g, (m) => ({
      url: m[1],
      width: +(tag(m[2], /width:\s*(\d+)/) || 0) || null,
      height: +(tag(m[2], /height:\s*(\d+)/) || 0) || null,
      order: +(tag(m[2], /sortOrder:\s*(\d+)/) || 0) || null,
      spec: tag(m[2], /spec:\s*"([^"]+)"/)
    })) : [];
    return {
      titleNo: +titleNo,
      episodeNo: +episodeNo,
      title: tag(html, /titleName:\s*"([^"]+)"/) || tag(html, /<title>([\s\S]*?)<\/title>/i),
      genre: tag(html, /genreName:\s*"([^"]+)"/),
      lang,
      images,
      count: images.length,
      prev: tag(html, /prevEpisodeUrl:\s*"([^"]+)"/),
      next: tag(html, /nextEpisodeUrl:\s*"([^"]+)"/),
      url
    };
  }
  function getImages(titleNoOrUrl, opts) { return getViewer(titleNoOrUrl, opts).then((v) => v.images); }

  // ---------------------------------------------------------------- HOME
  /** Kartu update terbaru / ranking di homepage. */
  async function getHome(opts = {}) {
    const html = await req(ENDPOINTS.homeLang.replace('%s', opts.lang || 'en'), { strict: false });
    if (typeof html !== 'string') return [];
    const out = [];
    const re = /<a href="([^"]*\/list\?title_no=\d+)"[^>]*data-title-no="(\d+)"[^>]*>([\s\S]*?)<\/a>/g;
    let m;
    while ((m = re.exec(html)) !== null) {
      const body = m[3];
      out.push({
        titleNo: +m[2],
        title: tag(body, /<strong class="title">([\s\S]*?)<\/strong>/),
        genre: tag(body, /<div class="genre">([\s\S]*?)<\/div>/),
        slug: getSlug(m[1]),
        url: m[1].startsWith('http') ? m[1] : BASE + m[1],
        poster: firstImageSrc(body),
        rank: +(tag(body, /data-rank="(\d+)"/) || 0) || null
      });
    }
    return out.filter((x) => x.title);
  }

  /** Shortcut: cari judul lalu ambil detail + episode. */
  async function findTitle(query, opts = {}) {
    const r = await search(query, opts);
    if (!r.results.length) return null;
    const first = r.results[0];
    return getTitle(first.url, opts);
  }

  // CLI

export { BASE, API, IMG, UA, ENDPOINTS, decode, slugify, imageUrl, firstImageSrc, parseInput, getSlug, getTitleNo, getEpisodeNo, req, search, searchTitles, trending, getTitle, getEpisodes, getViewer, getImages, getHome, findTitle };

export default { BASE, API, IMG, UA, ENDPOINTS, decode, slugify, imageUrl, firstImageSrc, parseInput, getSlug, getTitleNo, getEpisodeNo, req, search, searchTitles, trending, getTitle, getEpisodes, getViewer, getImages, getHome, findTitle };
