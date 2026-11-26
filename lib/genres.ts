import type { FilterOptionItem } from '@/lib/scraper/types';

/**
 * Daftar genre yang dipakai katalog.
 *
 * Sumber (tema hidori) menaruh judul anime di daftar genre: "I Was
 * Reincarnated as the 7th Prince", "Midnight Punch", "Senpai is an Otokonoko",
 * bahkan judul berbahasa Jepang. Judul-judul itu muncul sebagai pilihan genre
 * dan kalau diklik hasilnya tidak nyambung, jadi daftar genre disaring dengan
 * daftar putih ini.
 *
 * Nama genre memakai istilah yang lazim di katalog anime (AniList/MAL),
 * bukan terjemahan, supaya cocok dengan nilai yang dikirim ke sumber.
 */
const CANONICAL_GENRES: { value: string; label: string }[] = [
  { value: 'action', label: 'Action' },
  { value: 'adventure', label: 'Adventure' },
  { value: 'avant-garde', label: 'Avant Garde' },
  { value: 'award-winning', label: 'Award Winning' },
  { value: 'boys-love', label: 'Boys Love' },
  { value: 'cgdct', label: 'CGDCT' },
  { value: 'comedy', label: 'Comedy' },
  { value: 'drama', label: 'Drama' },
  { value: 'ecchi', label: 'Ecchi' },
  { value: 'erotica', label: 'Erotica' },
  { value: 'fantasy', label: 'Fantasy' },
  { value: 'gag-humor', label: 'Gag Humor' },
  { value: 'girls-love', label: 'Girls Love' },
  { value: 'gore', label: 'Gore' },
  { value: 'gourmet', label: 'Gourmet' },
  { value: 'harem', label: 'Harem' },
  { value: 'historical', label: 'Historical' },
  { value: 'horror', label: 'Horror' },
  { value: 'isekai', label: 'Isekai' },
  { value: 'iyashikei', label: 'Iyashikei' },
  { value: 'josei', label: 'Josei' },
  { value: 'kids', label: 'Kids' },
  { value: 'love-polygon', label: 'Love Polygon' },
  { value: 'magic', label: 'Magic' },
  { value: 'mahou-shoujo', label: 'Mahou Shoujo' },
  { value: 'martial-arts', label: 'Martial Arts' },
  { value: 'mecha', label: 'Mecha' },
  { value: 'military', label: 'Military' },
  { value: 'music', label: 'Music' },
  { value: 'mystery', label: 'Mystery' },
  { value: 'mythology', label: 'Mythology' },
  { value: 'parody', label: 'Parody' },
  { value: 'psychological', label: 'Psychological' },
  { value: 'racing', label: 'Racing' },
  { value: 'reincarnation', label: 'Reincarnation' },
  { value: 'reverse-harem', label: 'Reverse Harem' },
  { value: 'romance', label: 'Romance' },
  { value: 'samurai', label: 'Samurai' },
  { value: 'school', label: 'School' },
  { value: 'sci-fi', label: 'Sci-Fi' },
  { value: 'seinen', label: 'Seinen' },
  { value: 'shoujo', label: 'Shoujo' },
  { value: 'shounen', label: 'Shounen' },
  { value: 'slice-of-life', label: 'Slice of Life' },
  { value: 'space', label: 'Space' },
  { value: 'sports', label: 'Sports' },
  { value: 'super-power', label: 'Super Power' },
  { value: 'supernatural', label: 'Supernatural' },
  { value: 'survival', label: 'Survival' },
  { value: 'suspense', label: 'Suspense' },
  { value: 'time-travel', label: 'Time Travel' },
  { value: 'vampire', label: 'Vampire' },
  { value: 'video-game', label: 'Video Game' },
  { value: 'villainess', label: 'Villainess' },
  { value: 'workplace', label: 'Workplace' },
];

/** Nama tampil per nilai, dipakai juga untuk memberi label chip genre aktif. */
export const GENRE_LABELS: Record<string, string> = CANONICAL_GENRES.reduce(
  (out, genre) => {
    out[genre.value] = genre.label;
    return out;
  },
  {} as Record<string, string>
);

/**
 * Saring daftar genre sumber jadi daftar yang rapi dan urut abjad.
 *
 * Nilai yang tidak dikenal dibuang, bukan diganti namanya: nilai itulah yang
 * dikirim balik ke sumber sebagai `genre[]`, jadi mengarang nama baru hanya
 * akan menghasilkan halaman kosong.
 */
export function cleanGenres(items: FilterOptionItem[] | undefined): FilterOptionItem[] {
  const seen = new Set<string>();
  const result: FilterOptionItem[] = [];

  for (const item of items || []) {
    const value = (item.value || '').trim().toLowerCase();
    if (!value || seen.has(value)) continue;
    const label = GENRE_LABELS[value];
    if (!label) continue;
    seen.add(value);
    result.push({ value, label });
  }

  return result.sort((a, b) => a.label.localeCompare(b.label));
}
