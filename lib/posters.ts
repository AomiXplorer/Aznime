/**
 * Poster arsip Malz disimpan di CDN animein yang sekarang dijaga Cloudflare
 * Bot Management: permintaan dari server dijawab "Sorry, you have been
 * blocked" dan permintaan gambar dari browser pun ikut diblokir. Poster itu
 * tidak akan pernah tampil, seberapa lama pun ditunggu.
 *
 * Karena itu poster dari host tersebut tidak lagi dirender apa adanya,
 * melainkan ditukar dengan cover AniList yang setara. Penukarannya terjadi
 * di /api/img saat gambar benar-benar diminta, jadi tidak ada ratusan
 * permintaan AniList saat halaman dirender, dan hasilnya di-cache CDN selamanya.
 */

const BLOCKED_POSTER_HOSTS =
  /(^|\.)(api\.animein\.net|xyz-api\.animein\.net|animein\.net|www\.animein\.net|storages\.animein\.net|animeinweb\.com)$/i;

export function isBlockedPosterHost(url: string | null | undefined): boolean {
  if (!url) return false;
  try {
    return BLOCKED_POSTER_HOSTS.test(new URL(url).hostname.toLowerCase());
  } catch {
    return false;
  }
}

/**
 * Poster dengan cadangan judul: proksi mencoba URL aslinya lebih dulu (poster
 * yang sudah lama tersimpan di cache CDN tetap terpakai), dan baru mencari
 * cover AniList kalau host sumbernya menolak.
 */
export function posterUrlWithTitleFallback(
  src: string,
  title: string,
  altTitle?: string | null,
  width = 340
): string {
  const params = new URLSearchParams({
    u: src,
    t: title,
    w: String(width),
    q: '72',
    f: 'webp',
  });
  if (altTitle) params.set('a', altTitle);
  return `/api/img?${params.toString()}`;
}

/** URL poster pengganti: proksi kita mencari cover AniList berdasarkan judul. */
export function titlePosterUrl(title: string, altTitle?: string | null, width = 340): string {
  const params = new URLSearchParams({ t: title, w: String(width), q: '72', f: 'webp' });
  if (altTitle) params.set('a', altTitle);
  return `/api/img?${params.toString()}`;
}

export function isTitlePosterUrl(src: string | null | undefined): boolean {
  if (!src || !src.startsWith('/api/img?')) return false;
  try {
    return new URL(src, 'https://aznime.com').searchParams.has('t');
  } catch {
    return false;
  }
}
