import type { EpisodeSummary } from './scraper/types';

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

export function matchesEpisodeQuery(episode: EpisodeSummary, query: string): boolean {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return true;

  const exactNumber = normalized.match(/^(?:episode\s*)?(\d+(?:\.\d+)?)$/i)?.[1];
  if (exactNumber) {
    const episodeNumber = (episode.number || episodeNumberFromTitle(episode.title) || '').trim();
    return episodeNumber === exactNumber;
  }

  return (
    (episode.number || '').toLowerCase().includes(normalized) ||
    episode.title.toLowerCase().includes(normalized)
  );
}

export interface EpisodeRange {
  start: number;
  end: number;
  label: string;
}

export function createEpisodeRanges(minEpisode: number, maxEpisode: number): EpisodeRange[] {
  if (!Number.isFinite(minEpisode) || !Number.isFinite(maxEpisode) || maxEpisode - minEpisode < 50) {
    return [];
  }

  const firstRange = Math.floor((minEpisode - 1) / 50) * 50 + 1;
  const ranges: EpisodeRange[] = [];
  for (let start = firstRange; start <= maxEpisode; start += 50) {
    ranges.push({
      start,
      end: Math.min(start + 49, maxEpisode),
      label: `${start}–${Math.min(start + 49, maxEpisode)}`,
    });
  }
  return ranges;
}
