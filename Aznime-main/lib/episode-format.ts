/** Helper teks episode yang dipakai halaman watch dan pemutar. */

/** "One Piece Episode 1180 Subtitle Indonesia" -> "One Piece Episode 1180" */
export function cleanEpisodeTitle(title: string): string {
  return title.replace(/\s*subtitle\s+indonesia\s*$/i, '').trim() || title;
}

/** Ambil nomor episode dari judul, misal "Episode 1180" -> "1180". */
export function episodeNumberFromTitle(title: string): string | null {
  const match = title.match(/episode\s+([0-9]+(?:\.[0-9]+)?)/i);
  return match ? match[1] : null;
}
