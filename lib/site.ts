/**
 * Identitas & URL publik kanonik Aznime.
 *
 * Domain produksi sekarang https://aznime.com (migrasi dari aznime.web.id), jadi
 * domain itu dipakai sebagai default untuk metadata, Open Graph, robots, dan sitemap.
 * Env override hanya untuk preview/staging, bukan untuk produksi.
 */
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ||
  process.env.APP_URL ||
  'https://aznime.com'
).replace(/\/+$/, '');

export const SITE_NAME = 'Aznime';

/**
 * Satu deskripsi brand yang dipakai di mana-mana: <meta name="description">,
 * Open Graph, Twitter Card, JSON-LD, dan teks footer. Nama brand muncul sekali
 * saja dalam kalimat wajar, bukan diulang-ulang.
 */
export const SITE_DESCRIPTION =
  'Aznime adalah situs streaming anime subtitle Indonesia dengan katalog cepat, jadwal tayang harian, trailer AniList, dan pemutar yang otomatis memilih server tercepat.';

/** Nama pembeda yang benar-benar dipakai di judul halaman dan teks situs. */
export const SITE_ALTERNATE_NAME = 'Aznime Subtitle Indonesia';

/** Logo persegi 512x512 untuk Organization.logo (syarat Google: minimal 112x112). */
export const SITE_LOGO_PATH = '/icons/icon-512.png';

export const SITE_LOCALE = 'id_ID';
export const SITE_LANG = 'id-ID';

/** Beranda kanonik, selalu dengan garis miring penutup. */
export const HOME_URL = `${SITE_URL}/`;

/** Ubah path relatif (mis. `/anime/naruto`) menjadi URL absolut kanonik. */
export function absoluteUrl(path = '/'): string {
  return new URL(path, `${SITE_URL}/`).toString();
}
