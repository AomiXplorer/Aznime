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

/** Ubah path relatif (mis. `/anime/naruto`) menjadi URL absolut kanonik. */
export function absoluteUrl(path = '/'): string {
  return new URL(path, `${SITE_URL}/`).toString();
}
