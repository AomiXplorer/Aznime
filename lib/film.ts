import * as cheerio from 'cheerio';

/**
 * Sumber film & bioskop: Juraganfilm.
 *
 * Alurnya sama dengan sumber lain di situs ini: HTML diambil di server, lalu
 * diurai dengan cheerio. Bedanya, sumber film TIDAK memberi berkas video
 * langsung. Setiap judul hanya menyediakan iframe pemutar pihak ketiga
 * (umumnya vidhide.org) plus tautan unduhan kalau ada, jadi halaman /film
 * memutar iframe itu apa adanya dan menyerahkan sisanya ke host pemutar.
 *
 * Sumber sebelumnya (nontonfilm.digital) sudah mati: origin-nya menjawab 502
 * dari Cloudflare sehingga seluruh katalog film kosong. Juraganfilm dipakai
 * karena halaman katalognya dirender di server (bisa diurai tanpa browser),
 * pemutarnya iframe HTTPS yang sah, dan judulnya masih diperbarui.
 *
 * Catatan operasional: domain publik juraganfilm.com saat ini di belakang
 * Cloudflare dengan sertifikat origin tidak sah (error 526), jadi yang dipakai
 * adalah origin langsung lewat HTTP. Semua sampul karena itu diproksi melalui
 * /api/img supaya halaman HTTPS tidak memuat gambar HTTP (mixed content).
 * Ganti alamat sumber lewat FILM_SOURCE_BASE_URL tanpa mengubah kode.
 */

export const FILM_SOURCE_NAME = 'Juraganfilm';

export const FILM_BASE = (process.env.FILM_SOURCE_BASE_URL || 'http://165.227.239.151').replace(
  /\/+$/,
  ''
);

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

const HEADERS = {
  'User-Agent': USER_AGENT,
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'id-ID,id;q=0.9,en;q=0.8',
};

export class FilmUnavailable extends Error {
  constructor(message = 'Sumber film sedang tidak bisa dihubungi.') {
    super(message);
    this.name = 'FilmUnavailable';
  }
}

export interface FilmCard {
  id: string;
  title: string;
  /** Jalur internal, mis. /film/queen-of-chess-2026 */
  href: string;
  /** Alamat asli di sumber, dipakai halaman detail. */
  sourcePath: string;
  poster: string | null;
  rating: string | null;
  quality: string | null;
}

export interface FilmDownload {
  label: string;
  url: string;
}

export interface FilmDetail {
  title: string;
  sourcePath: string;
  poster: string | null;
  synopsis: string | null;
  genres: string[];
  embeds: string[];
  downloads: FilmDownload[];
  meta: { label: string; value: string }[];
}

export interface FilmFeed {
  items: FilmCard[];
  offline: boolean;
}

async function fetchHtml(url: string): Promise<string> {
  let response: Response;
  try {
    response = await fetch(url, {
      headers: HEADERS,
      signal: AbortSignal.timeout(12000),
      next: { revalidate: 900 },
    });
  } catch {
    throw new FilmUnavailable();
  }

  if (!response.ok) {
    throw new FilmUnavailable(
      response.status >= 500
        ? 'Server sumber film sedang down. Coba lagi beberapa saat lagi.'
        : 'Sumber film menolak permintaan.'
    );
  }

  return response.text();
}

/** Alamat gambar bisa relatif, protocol-relative, atau absolut. */
function absolute(raw: string | undefined | null): string | null {
  if (!raw) return null;
  const value = raw.trim();
  if (!value || value.startsWith('data:')) return null;
  if (value.startsWith('//')) return `https:${value}`;
  if (value.startsWith('/')) return `${FILM_BASE}${value}`;
  if (/^https?:\/\//i.test(value)) return value;
  return `${FILM_BASE}/${value}`;
}

/** Entri srcset dengan lebar terbesar, supaya sampul tidak pecah di kartu. */
function largestFromSrcset(srcset: string | undefined | null): string | null {
  if (!srcset) return null;
  let best: { url: string; width: number } | null = null;
  for (const part of srcset.split(',')) {
    const [url, descriptor] = part.trim().split(/\s+/);
    if (!url) continue;
    const width = Number((descriptor || '').replace(/[^\d.]/g, '')) || 0;
    if (!best || width > best.width) best = { url, width };
  }
  return best ? absolute(best.url) : null;
}

/** Jalur sumber tanpa garis miring di ujung, mis. "queen-of-chess-2026". */
export function sourcePathFromUrl(raw: string | undefined | null): string | null {
  const url = absolute(raw);
  if (!url) return null;
  try {
    return new URL(url).pathname.replace(/^\/+|\/+$/g, '');
  } catch {
    return null;
  }
}

function cardHref(sourcePath: string): string {
  return `/film/${sourcePath}`;
}

function posterFrom($: cheerio.CheerioAPI, el: cheerio.Cheerio<any>): string | null {
  const img = el.find('.content-thumbnail img, img').first();
  if (!img.length) return null;
  return (
    largestFromSrcset(img.attr('data-srcset') || img.attr('srcset')) ||
    absolute(img.attr('data-src') || img.attr('data-lazy-src') || img.attr('src'))
  );
}

function parseCards(html: string): FilmCard[] {
  const $ = cheerio.load(html);
  const seen = new Set<string>();
  const cards: FilmCard[] = [];

  $('article.item, article.item-infinite').each((_, el) => {
    const node = $(el);
    const titleEl = node.find('h2.entry-title a, h2 a, h3 a, .entry-title a').first();
    const title = titleEl.text().trim().replace(/\s+/g, ' ');
    const sourcePath = sourcePathFromUrl(titleEl.attr('href'));
    if (!title || !sourcePath || seen.has(sourcePath)) return;

    seen.add(sourcePath);
    cards.push({
      id: sourcePath,
      title,
      href: cardHref(sourcePath),
      sourcePath,
      poster: posterFrom($, node),
      rating: node.find('.gmr-rating-item').first().text().trim() || null,
      quality: node.find('.gmr-quality-item').first().text().trim() || null,
    });
  });

  return cards;
}

/** Film terbaru dari beranda sumber. */
export async function getFilmFeed(limit = 14): Promise<FilmCard[]> {
  const html = await fetchHtml(`${FILM_BASE}/`);
  return parseCards(html).slice(0, limit);
}

/** Umpan beranda yang tidak pernah melempar, untuk baris di halaman depan. */
export async function getFilmFeedSafe(limit = 14): Promise<FilmFeed> {
  try {
    return { items: await getFilmFeed(limit), offline: false };
  } catch {
    return { items: [], offline: true };
  }
}

export async function searchFilm(query: string, limit = 60): Promise<FilmCard[]> {
  const term = query.trim().slice(0, 100);
  const url = term ? `${FILM_BASE}/?s=${encodeURIComponent(term)}` : `${FILM_BASE}/`;
  return parseCards(await fetchHtml(url)).slice(0, limit);
}

export async function searchFilmSafe(query: string, limit = 60): Promise<FilmFeed> {
  try {
    return { items: await searchFilm(query, limit), offline: false };
  } catch {
    return { items: [], offline: true };
  }
}

/** Angka rating dari teks "76 voting, rata-rata 7.5 dari 10". */
function ratingFrom(text: string): string | null {
  const match = /rata-rata\s*([\d.,]+)/i.exec(text) || /([\d.,]+)\s*\/\s*10/.exec(text);
  return match ? match[1].replace(',', '.') : null;
}

/** Baris data film: rating, durasi, negara, sutradara. */
function parseMeta($: cheerio.CheerioAPI): { label: string; value: string }[] {
  const meta: { label: string; value: string }[] = [];
  const push = (label: string, value: string | null) => {
    const clean = (value || '').replace(/\s+/g, ' ').trim();
    if (clean && clean.length < 80) meta.push({ label, value: clean });
  };

  push('Rating', ratingFrom($('.gmr-rating').first().text()));
  push('Durasi', $('.gmr-duration-item').first().text());
  push('Negara', $("a[href*='/country/']").first().text());
  push('Sutradara', $("a[href*='/director/']").first().text());

  return meta.slice(0, 6);
}

export async function getFilmDetail(sourcePath: string): Promise<FilmDetail> {
  const clean = sourcePath.replace(/^\/+|\/+$/g, '');
  if (!clean || clean.includes('..')) throw new FilmUnavailable('Alamat film tidak sah.');

  const $ = cheerio.load(await fetchHtml(`${FILM_BASE}/${clean}/`));

  const title =
    $('h1.entry-title').first().text().trim() || $('h1').first().text().trim() || 'Tanpa judul';

  const posterImg = $('.gmr-movie-data img, .post-thumbnail img').first();
  const poster =
    largestFromSrcset(posterImg.attr('data-srcset') || posterImg.attr('srcset')) ||
    absolute(posterImg.attr('data-src') || posterImg.attr('src'));

  const synopsis =
    $('.entry-content p')
      .map((_, el) => $(el).text().trim())
      .get()
      .find((text) => text.length > 60) || null;

  const genres = [
    ...new Set(
      $("a[rel='category tag']")
        .map((_, el) => $(el).text().trim())
        .get()
        .filter(Boolean)
    ),
  ];

  /* Hanya iframe pemutar: tag iklan dan pelacak dibuang supaya halaman tidak
     menyisipkan skrip pihak lain di luar pemutar. Hanya HTTPS yang lolos,
     karena halaman ini sendiri disajikan lewat HTTPS. */
  const embeds = [
    ...new Set(
      $('iframe')
        .map((_, el) => absolute($(el).attr('src') || $(el).attr('data-src')))
        .get()
        .filter((src): src is string => Boolean(src))
        .filter(
          (src) =>
            !/googletagmanager|google-analytics|facebook|doubleclick|histats/i.test(src) &&
            /^https:\/\//i.test(src)
        )
    ),
  ];

  const downloads: FilmDownload[] = [];
  const seen = new Set<string>();
  $('.gmr-download-list a').each((_, el) => {
    const label = $(el).text().trim().replace(/\s+/g, ' ');
    const url = absolute($(el).attr('href'));
    if (!label || !url || seen.has(url) || !/^https?:\/\//i.test(url)) return;
    seen.add(url);
    downloads.push({ label, url });
  });

  return {
    title,
    sourcePath: clean,
    poster,
    synopsis,
    genres,
    embeds,
    downloads,
    meta: parseMeta($),
  };
}

/* Sampul film hanya diproksi kalau host-nya ada di allowlist /api/img. Host
   lain dimuat langsung oleh browser supaya katalog tidak kehilangan sampul
   hanya karena host-nya belum terdaftar. */
const FILM_POSTER_HOSTS = new Set(['165.227.239.151']);

export function filmPosterUrl(poster: string | null, width: number): string | null {
  if (!poster) return null;
  try {
    if (!FILM_POSTER_HOSTS.has(new URL(poster).hostname.toLowerCase())) return poster;
  } catch {
    return poster;
  }
  return `/api/img?u=${encodeURIComponent(poster)}&w=${width}`;
}
