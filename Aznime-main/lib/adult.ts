/**
 * Sumber utama (Hidori) masih memuat beberapa judul hentai. Beranda Aznime
 * tidak boleh menampilkannya: bagian 18+ punya ruangnya sendiri di /hentai dan
 * hanya terbuka lewat filter genre Hentai di katalog.
 */
const ADULT_TYPE = /hentai/i;
const ADULT_GENRE = /hentai/i;

type AdultProbe = {
  type?: string | null;
  genres?: string[] | null;
};

export function isAdultTitle(item: AdultProbe): boolean {
  if (item.type && ADULT_TYPE.test(item.type)) return true;
  return Boolean(item.genres?.some((genre) => ADULT_GENRE.test(genre)));
}

export function withoutAdult<T extends AdultProbe>(items: T[]): T[] {
  return items.filter((item) => !isAdultTitle(item));
}
