import * as cheerio from 'cheerio';

/**
 * Sumber film & bioskop: nontonfilm.digital.
 *
 * Alurnya sama dengan sumber lain di situs ini: HTML diambil di server, lalu
 * diurai dengan cheerio. Bedanya, sumber film TIDAK memberi berkas video
 * langsung. Setiap judul hanya menyediakan sejumlah <iframe> pemutar pihak
 * ketiga plus daftar tautan unduhan, jadi halaman /film memutar iframe itu apa
 * adanya dan menyerahkan sisanya ke host pemutar.
 *
 * Origin sumber ini sesekali menjawab 502 dari Cloudflare (bukan blokir IP
 * kita, host-nya memang sedang mati). Semua fungsi di sini karena itu melempar
 * `FilmUnavailable` dan pemanggil menampilkannya sebagai keadaan kosong, bukan
 * halaman error 500.
 */

export const FILM_BASE = 'https://www.nontonfilm.digital';

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
  /** Jalur internal, mis. /film/bioskop-movie/doraemon-2025 */
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
    /* 502/503 dari Cloudflare = origin sumber mati, bukan penolakan terhadap
       kita. Pesannya dibedakan supaya pengguna tahu ini bukan salah situs. */
    throw new FilmUnavailable(
      response.status >= 500
        ? 'Server sumber film sedang down (502). Coba lagi beberapa saat lagi.'
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

/** Jalur sumber tanpa garis miring di ujung, mis. "bioskop-movie/doraemon-2025". */
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

/** Sampul sering ditulis di beberapa atribut berbeda oleh tema WordPress. */
function posterFrom($: cheerio.CheerioAPI, el: cheerio.Cheerio<never> | cheerio.Cheerio<any>): string | null {
  const img = el.find('img').first();
  if (!img.length) return null;
  const direct = img.attr('data-src') || img.attr('data-lazy-src') || img.attr('src');
  const fromDirect = absolute(direct);
  if (fromDirect) return fromDirect;
  const srcset = img.attr('data-srcset') || img.attr('srcset');
  if (srcset) return absolute(srcset.split(',')[0]?.trim().split(' ')[0]);
  return null;
}

function parseCards(html: string): FilmCard[] {
  const $ = cheerio.load(html);
  const seen = new Set<string>();
  const cards: FilmCard[] = [];

  $('article.item, main article, article').each((_, el) => {
    const node = $(el);
    const titleEl = node.find('h2 a, h3 a, .entry-title a').first();
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
  const url = term
    ? `${FILM_BASE}/?s=${encodeURIComponent(term)}`
    : `${FILM_BASE}/`;
  return parseCards(await fetchHtml(url)).slice(0, limit);
}

export async function searchFilmSafe(query: string, limit = 60): Promise<FilmFeed> {
  try {
    return { items: await searchFilm(query, limit), offline: false };
  } catch {
    return { items: [], offline: true };
  }
}

/** Label "Tahun", "Durasi", "Sutradara" dsb. dari blok data film. */
function parseMeta($: cheerio.CheerioAPI): { label: string; value: string }[] {
  const meta: { label: string; value: string }[] = [];
  $('.gmr-movie-data tr, .gmr-moviedata li, .gmr-movie-data li').each((_, el) => {
    const node = $(el);
    const label = node.find('th, .gmr-label, strong, b').first().text().trim();
    const value = node
      .find('td, .gmr-value')
      .first()
      .text()
      .trim()
      .replace(/\s+/g, ' ');
    const finalValue = value || node.text().replace(label, '').trim().replace(/\s+/g, ' ');
    if (label && finalValue && label.length < 24 && finalValue.length < 120) {
      meta.push({ label: label.replace(/:$/, ''), value: finalValue });
    }
  });
  return meta.slice(0, 6);
}

export async function getFilmDetail(sourcePath: string): Promise<FilmDetail> {
  const clean = sourcePath.replace(/^\/+|\/+$/g, '');
  if (!clean || clean.includes('..')) throw new FilmUnavailable('Alamat film tidak sah.');

  const $ = cheerio.load(await fetchHtml(`${FILM_BASE}/${clean}/`));

  const title =
    $('h1.entry-title').first().text().trim() || $('h1').first().text().trim() || 'Tanpa judul';

  const poster = absolute(
    $('.gmr-movie-data img, .post-thumbnail img, .gmr-movie-data .gmr-postimage img')
      .first()
      .attr('src') ||
      $('.gmr-movie-data img, .post-thumbnail img').first().attr('data-src')
  );

  const synopsis =
    $('.entry-content p')
      .map((_, el) => $(el).text().trim())
      .get()
      .find((text) => text.length > 60) || null;

  const genres = [
    ...new Set(
      $("a[rel='category tag'], .gmr-moviedata a[href*='/genre/'], .gmr-movie-data a[href*='/genre/']")
        .map((_, el) => $(el).text().trim())
        .get()
        .filter(Boolean)
    ),
  ];

  /* Hanya iframe pemutar: tag iklan dan pelacak dibuang supaya halaman tidak
     menyisipkan skrip pihak lain di luar pemutar. */
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
  $('.gmr-download-list a, #download a, .gmr-download a').each((_, el) => {
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

/* Poster film hanya diproksi kalau host-nya ada di allowlist /api/img. Host
   lain (CDN tema WordPress, mis. i0.wp.com) dimuat langsung oleh browser supaya
   katalog tidak kehilangan sampul hanya karena host-nya belum terdaftar. */
const FILM_POSTER_HOSTS = new Set(['nontonfilm.digital', 'www.nontonfilm.digital']);

export function filmPosterUrl(poster: string | null, width: number): string | null {
  if (!poster) return null;
  try {
    if (!FILM_POSTER_HOSTS.has(new URL(poster).hostname.toLowerCase())) return poster;
  } catch {
    return poster;
  }
  return `/api/img?u=${encodeURIComponent(poster)}&w=${width}`;
}
