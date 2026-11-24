/**
 * Aturan akses episode. Satu sumber kebenaran untuk server dan client:
 * episode 1-3 gratis untuk tamu, episode 4 ke atas wajib login, dan episode
 * tanpa nomor yang bisa dibaca dianggap terkunci supaya tamu tidak bisa
 * menyelundup lewat judul yang tidak memuat angka.
 */
export const GUEST_EPISODE_LIMIT = 3;

export function parseEpisodeNumber(value: string | number | null | undefined): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value !== 'string') return null;
  const match = value.match(/\d+(?:\.\d+)?/);
  if (!match) return null;
  const parsed = Number.parseFloat(match[0]);
  return Number.isFinite(parsed) ? parsed : null;
}

export function isEpisodeLockedForGuest(number: string | number | null | undefined): boolean {
  const parsed = parseEpisodeNumber(number);
  if (parsed === null) return true;
  return parsed > GUEST_EPISODE_LIMIT;
}

export function isEpisodeLocked(number: string | number | null | undefined, signedIn: boolean): boolean {
  return !signedIn && isEpisodeLockedForGuest(number);
}
