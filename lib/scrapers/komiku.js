/**
 * komiku.org — single-file API client / scraper
 * Reverse-engineered dari situs komiku.org + api.komiku.org (htmx fragments).
 *
 * - Node 18+ : const kmk = require('./komiku.js')
 * - Browser  : <script src="komiku.js"></script> -> window.Komiku
 *
 * Read-only. Tidak menulis ke server mana pun.
 */

  // ---------------------------------------------------------------- BASE
  const BASE = 'https://komiku.org';
  const API = 'https://api.komiku.org';
  const IMG_HOST = 'img.komiku.org';
  const MIRRORS = {
    origin: 'img.komiku.org',
    s1: 'image1.komiku.to',      // cadangan
    s2: 'image2.komiku.to'      // premium
  };
  const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
             '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

  const ENDPOINTS = {
    home:      BASE + '/',
    search:    API + '/?s=%s&post_type=manga',
    searchAll: API + '/?s=%s',
    manga:     BASE + '/manga/%s/',
    chapter:   BASE + '/%s/',
    genre:     API + '/genre/%s/',
    genres:    BASE + '/p/daftar-genre/',
    pustaka:   BASE + '/pustaka/',
    ranking:   BASE + '/p/ranking/',
    trending:  BASE + '/p/trending/',
    analytics: 'https://analytics.komiku.org/api'
  };

  // -------------------------------------------------------------- helpers
  const ENTITIES = {
    amp: '&', quot: '"', apos: "'", lt: '<', gt: '>', nbsp: ' ', '#038': '&',
    '#39': "'", '#8216': '‘', '#8217': '’', '#8220': '“', '#8221': '”',
    '#8230': '…', '#8211': '–', '#8212': '—'
  };
  function decode(s) {
    return String(s == null ? '' : s)
      .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
      .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(+d))
      .replace(/&([a-z0-9#]+);/gi, (m, e) => ENTITIES[e.toLowerCase()] || m)
      .replace(/\s+/g, ' ').trim();
  }
  function stripTags(s) { return decode(String(s == null ? '' : s).replace(/<[^>]+>/g, ' ')); }
  function cleanUrl(u) {
    return u ? String(u).replace(/\\+$/, '').replace(/["']+$/, '').trim() : null;
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
  function slugify(input) {
    return decode(input)
      .normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
      .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  }
  function pathSlug(input) {
    if (!input) return null;
    let s = String(input).trim();
    if (/^https?:\/\//i.test(s)) {
      try { s = new URL(s).pathname; } catch (_) { /* noop */ }
    }
    s = s.split('?')[0].split('#')[0].replace(/\/+$/, '');
    const parts = s.split('/').filter(Boolean);
    let last = parts.length ? parts[parts.length - 1] : s;
    if (parts.includes('manga')) last = parts[parts.indexOf('manga') + 1] || last;
    try { last = decodeURIComponent(last); } catch (_) { /* noop */ }
    return slugify(last);
  }

  /** Slug manga: /manga/komik-one-piece-indo/ -> komik-one-piece-indo
   *  Slug chapter: one-piece-chapter-1199 -> one-piece (perkiraan; pakai
   *  getChapter().seriesSlug untuk slug manga yang pasti).
   */
  function getSlug(input) {
    let s = pathSlug(input);
    if (!s) return null;
    if (/-chapter-[\d.]/.test(s)) s = s.replace(/-chapter-[\d.]+.*$/, '');
    return s;
  }
  function getChapterSlug(input) { return pathSlug(input); }
  function getChapterNumber(input) {
    const s = getChapterSlug(input) || '';
    const m = s.match(/-chapter-([\d.]+)(?:-(\d+))?$/);
    if (!m) return null;
    return { number: parseFloat(m[1]), part: m[2] ? +m[2] : null };
  }

  async function req(url, opts = {}) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), opts.timeout || 25000);
    try {
      const res = await fetch(url, {
        method: opts.method || 'GET',
        headers: Object.assign({
          'User-Agent': UA,
          'Accept': 'text/html,application/json,*/*',
          'Referer': BASE + '/'
        }, opts.headers || {}),
        body: opts.body,
        signal: ctrl.signal
      });
      if (!res.ok) throw new Error('HTTP ' + res.status + ' for ' + url);
      const ct = res.headers.get('content-type') || '';
      return ct.includes('json') ? await res.json() : await res.text();
    } finally { clearTimeout(timer); }
  }

  // -------------------------------------------------- card parser (API)
  /** Parser fragmen <div class="bge"> dari api.komiku.org (search / genre). */
  function parseCards(html) {
    const chunks = String(html || '').split(/<div class="bge">/).slice(1);
    return chunks.map((chunk) => {
      const c = chunk.slice(0, chunk.indexOf('<div class="bge">') === -1
        ? chunk.length : chunk.indexOf('<div class="bge">'));
      const href = cleanUrl(tag(c, /href="([^"]*\/manga\/[^"]+")/) || tag(c, /href="([^"]+)"/));
      const news = all(c, /<div class="new1">([\s\S]*?)<\/div>/g, (m) => ({
        label: tag(m[1], /<span>([^<]*)<\/span>/),
        chapter: tag(m[1], /<span>([^<]*)<\/span>/, 1),
        title: tag(m[1], /title="([^"]*)"/),
        url: tag(m[1], /href="([^"]+)"/)
      }));
      const inf = tag(c, /<div class="tpe1_inf">([\s\S]*?)<\/div>/) || '';
      return {
        title: tag(c, /<h3>([\s\S]*?)<\/h3>/),
        slug: getSlug(href),
        url: href ? (href.startsWith('http') ? href : BASE + href) : null,
        poster: tag(c, /<img[^>]+src="([^"]+)"/),
        type: tag(inf, /<b>([^<]+)<\/b>/),
        genre: tag(inf, /<\/b>\s*([^<]*)/) || tag(c, /<span class="judul2">([^<]*?)\s*[x•]/),
        synopsis: tag(c, /<p>([\s\S]*?)<\/p>/),
        updated: tag(c, /<p>\s*Update\s*([^<]+?)\s*<\/p>/) ||
                 tag(c, /<span class="judul2">[\s\S]*?•\s*([^<]+)<\/span>/),
        first: news[0] || null,
        latest: news[news.length - 1] || null
      };
    }).filter((x) => x.title);
  }

  // --------------------------------------------------------------- SEARCH
  /** Cari manga. Sumber: api.komiku.org/?s=&post_type=manga (HTML fragment). */
  async function search(query, opts = {}) {
    if (!query) return [];
    const url = (opts.chapter ? ENDPOINTS.searchAll : ENDPOINTS.search)
      .replace('%s', encodeURIComponent(query)) +
      (opts.page ? '&page=' + (+opts.page) : '');
    const html = await req(url);
    const items = parseCards(html);
    if (items.length) return items;
    // fallback: halaman pencarian situs utama
    const page = await req(BASE + '/?s=' + encodeURIComponent(query) +
                           '&post_type=' + (opts.chapter ? 'chapter' : 'manga'));
    return parseCards(page);
  }
  function searchChapter(query, opts = {}) {
    return search(query, Object.assign({}, opts, { chapter: true }));
  }
  async function findManga(query) {
    const hits = await search(query);
    if (!hits.length) return null;
    return getManga(hits[0].slug || hits[0].url);
  }

  // --------------------------------------------------------------- MANGA
  /** Detail manga + seluruh daftar chapter dari /manga/<slug>/. */
  async function getManga(slugOrUrl) {
    const slug = getSlug(slugOrUrl);
    const url = /\/manga\//i.test(String(slugOrUrl))
      ? BASE + '/manga/' + slug + '/'
      : ENDPOINTS.manga.replace('%s', slug);
    const html = await req(url);
    if (!/<h1><span>Komik/.test(html)) throw new Error('Manga tidak ditemukan: ' + slug);

    const chapters = [];
    const chRe = /<tr itemprop="itemListElement"[\s\S]*?<a href="([^"]+)" itemprop="url" title="([^"]*)">[\s\S]*?<b>([^<]+)<\/b>[\s\S]*?<td class="tanggalseries">([\s\S]*?)<\/td>/gi;
    let m;
    while ((m = chRe.exec(html)) !== null) {
      chapters.push({
        number: getChapterNumber(m[1]),
        label: decode(m[3]),
        title: decode(m[2]),
        slug: getChapterSlug(m[1]),
        url: decode(m[1]).startsWith('http') ? decode(m[1]) : BASE + decode(m[1]),
        date: decode(m[4])
      });
    }
    const row = (label) => tag(html, new RegExp('<tr><td>' + label +
      ':</td><td[^>]*>([\\s\\S]*?)<\\/td>', 'i'));

    return {
      slug,
      url: BASE + '/manga/' + slug + '/',
      id: +(tag(html, /data-series-id="(\d+)"/) || 0) || null,
      title: tag(html, /<h1><span>Komik <span itemprop="name"[^>]*>([\s\S]*?)<\/span>/),
      altTitle: tag(html, /<span class="j2"[^>]*>([\s\S]*?)<\/span>/),
      poster: tag(html, /<img src="([^"]+)"[^>]*itemprop="image"/),
      synopsis: stripTags(tag(html, /<p class="desc" itemprop="description">([\s\S]*?)<\/p>/)),
      type: tag(html, /<meta itemprop="additionalType" content="([^"]+)"/),
      status: tag(html, /<meta itemprop="creativeWorkStatus" content="([^"]+)"/),
      genres: all(html, /<meta itemprop="genre" content="([^"]+)"/g),
      author: stripTags(row('Author')),
      theme: stripTags(row('Tema')),
      rating: stripTags(row('Rating')),
      readingDirection: stripTags(row('Cara Baca')),
      published: tag(html, /<meta itemprop="datePublished" content="([^"]+)"/),
      modified: tag(html, /<meta itemprop="dateModified" content="([^"]+)"/),
      first: chapters[0] ? chapters[chapters.length - 1] : null,
      latest: chapters[0] || null,
      chapters
    };
  }
  function getChapters(slugOrUrl) { return getManga(slugOrUrl).then((m) => m.chapters); }

  // -------------------------------------------------------------- CHAPTER
  /** Parse `var chapterData={...}` (literal JS, key tanpa tanda kutip). */
  function parseChapterData(html) {
    const m = /var\s+chapterData\s*=\s*\{([\s\S]*?)\}\s*;/.exec(html);
    if (!m) return {};
    const out = {};
    for (const part of m[1].split(',')) {
      const i = part.indexOf(':');
      if (i < 0) continue;
      const key = part.slice(0, i).trim().replace(/^["']|["']$/g, '');
      let v = part.slice(i + 1).trim();
      try {
        if (/^["']/.test(v)) v = JSON.parse(v.replace(/\\"/g, '"').replace(/\\'/g, "'").replace(/\\\//g, '/'));
        else if (/^\d+$/.test(v)) v = +v;
        else if (v === 'true') v = true;
        else if (v === 'false') v = false;
        else if (v === 'null') v = null;
      } catch (_) { /* biarkan string mentah */ }
      out[key] = v;
    }
    return out;
  }

  /** Ganti host gambar ke mirror: 'origin' | 's1' | 's2'. */
  function toMirror(url, key = 'origin') {
    if (!url || !MIRRORS[key]) return url;
    try {
      const u = new URL(url);
      if (Object.values(MIRRORS).includes(u.hostname)) u.hostname = MIRRORS[key];
      return u.href;
    } catch (_) { return url; }
  }

  /** Detail chapter: chapterData + gambar + mirror + prev/next. */
  async function getChapter(slugOrUrl, opts = {}) {
    const slug = getChapterSlug(slugOrUrl);
    const url = /^https?:\/\//i.test(String(slugOrUrl))
      ? String(slugOrUrl)
      : ENDPOINTS.chapter.replace('%s', slug);
    const html = await req(url);
    if (!/var\s+chapterData\s*=/.test(html)) {
      throw new Error('Chapter tidak ditemukan: ' + slug);
    }
    const d = parseChapterData(html);
    const images = all(html, /<img[^>]+data-src="(https?:\/\/[^"]+)"[^>]*>/gi, (m) => m[1])
      .filter((u) => Object.values(MIRRORS).some((h) => u.includes(h)))
      .filter((u, i, arr) => arr.indexOf(u) === i)
      .map((u, i) => ({
        index: i + 1,
        url: u,
        mirrors: Object.keys(MIRRORS).reduce((o, k) => (o[k] = toMirror(u, k), o), {})
      }));
    const seriesPath = d.link_series || '';
    return {
      slug,
      url: BASE + '/' + slug + '/',
      id: d.id || null,
      seriesId: d.idseries || null,
      series: d.series || null,
      seriesSlug: getSlug(seriesPath || d.series),
      seriesUrl: seriesPath ? BASE + seriesPath : null,
      chapter: d.chapter || null,
      chapterNumber: getChapterNumber(slug),
      imageCount: d.jumlahgambar || images.length,
      hasNext: !!d.hasNext,
      thumbnail: d.thumbnail || null,
      images,
      mirrors: MIRRORS,
      prev: tag(html, /<a href="(\/[^"]+-chapter-[\d.\-]+\/)"[^>]*aria-label="Prev"/i) ||
            tag(html, /<a href="(\/[^"]+-chapter-[\d.\-]+\/)"[^>]*>/i),
      next: tag(html, /<a href="(\/[^"]+-chapter-[\d.\-]+\/)"[^>]*aria-label="Next"/i)
    };
  }
  function getImages(slugOrUrl, opts) {
    return getChapter(slugOrUrl, opts).then((c) => c.images);
  }

  /** Deteksi otomatis: ada "-chapter-" -> chapter, selainnya -> manga. */
  async function getBySlug(input) {
    return /-chapter-\d+/i.test(String(input)) ? getChapter(input) : getManga(input);
  }

  // ----------------------------------------------------------------- LAIN
  /** Update terbaru di homepage (article.ls2). */
  async function getHome() {
    const html = await req(ENDPOINTS.home);
    return html.split(/<article class="ls2">/).slice(1).map((chunk) => {
      const c = chunk.slice(0, chunk.indexOf('<article') === -1 ? chunk.length : chunk.indexOf('<article'));
      return {
        title: tag(c, /<h3><a[^>]+title="([^"]+)"/),
        slug: getSlug(tag(c, /<h3><a href="([^"]+)"/)),
        url: cleanUrl(tag(c, /<h3><a href="([^"]+)"/)) ?
             BASE + cleanUrl(tag(c, /<h3><a href="([^"]+)"/)) : null,
        poster: tag(c, /data-src="([^"]+)"/),
        country: tag(c, /<img class="flag" src="\/asset\/img\/([a-z]+)\.png"/),
        meta: tag(c, /<span class="ls2t">([\s\S]*?)<\/span>/),
        latest: tag(c, /<a href="([^"]+)" class="ls2l"/),
        latestLabel: tag(c, /<a href="[^"]+" class="ls2l"[^>]*>([^<]+)/)
      };
    }).filter((x) => x.title);
  }

  /** Daftar genre (slug -> nama) dari homepage. */
  async function getGenres() {
    let html;
    try { html = await req(ENDPOINTS.genres); } catch (_) { html = await req(ENDPOINTS.home); }
    const out = {};
    all(html, /href="\/genre\/([a-z0-9-]+)\/"[^>]*title="Komik genre ([^"]+)"/gi,
        (m) => { out[decode(m[2])] = m[1]; });
    if (!Object.keys(out).length) {
      all(html, /href="\/genre\/([a-z0-9-]+)\/"[^>]*title="Komik ([^"]+)"/gi,
          (m) => { out[decode(m[2])] = m[1]; });
    }
    return out;
  }
  function getGenre(slug, opts = {}) {
    return req(ENDPOINTS.genre.replace('%s', slug) +
               (opts.page ? '?page=' + (+opts.page) : '')).then(parseCards);
  }

  // CLI

export { BASE, API, IMG_HOST, MIRRORS, ENDPOINTS, UA, decode, stripTags, slugify, pathSlug, getSlug, getChapterSlug, getChapterNumber, req, toMirror, parseCards, search, searchChapter, findManga, getManga, getChapters, getChapter, getImages, getBySlug, getHome, getGenres, getGenre };

export default { BASE, API, IMG_HOST, MIRRORS, ENDPOINTS, UA, decode, stripTags, slugify, pathSlug, getSlug, getChapterSlug, getChapterNumber, req, toMirror, parseCards, search, searchChapter, findManga, getManga, getChapters, getChapter, getImages, getBySlug, getHome, getGenres, getGenre };
