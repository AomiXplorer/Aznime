import type { HistoryItem } from './auth/history';
import { HISTORY_LIMIT } from './auth/history';

export const GUEST_HISTORY_KEY = 'aznime:guest-history';

function canUseStorage(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function sanitize(value: unknown): HistoryItem | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Record<string, unknown>;
  const animeId = typeof raw.animeId === 'string' ? raw.animeId : '';
  const title = typeof raw.title === 'string' ? raw.title : '';
  if (!animeId || !title) return null;
  const updatedAt = Number(raw.updatedAt);
  const position = Number(raw.position);
  return {
    animeId,
    title,
    poster: typeof raw.poster === 'string' ? raw.poster : null,
    episodeNumber:
      typeof raw.episodeNumber === 'string' || typeof raw.episodeNumber === 'number'
        ? String(raw.episodeNumber)
        : null,
    episodeSlug: typeof raw.episodeSlug === 'string' ? raw.episodeSlug : null,
    episodeTitle: typeof raw.episodeTitle === 'string' ? raw.episodeTitle : null,
    updatedAt: Number.isFinite(updatedAt) && updatedAt > 0 ? updatedAt : Date.now(),
    position: Number.isFinite(position) && position > 0 ? Math.floor(position) : 0,
  };
}

export function readGuestHistory(): HistoryItem[] {
  if (!canUseStorage()) return [];
  try {
    const raw = window.localStorage.getItem(GUEST_HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const items = parsed.map(sanitize).filter((item): item is HistoryItem => item !== null);
    return items.sort((a, b) => b.updatedAt - a.updatedAt).slice(0, HISTORY_LIMIT);
  } catch {
    return [];
  }
}

/** Dedupe per animeId, timestamp terbaru menang, maksimal 100 anime. */
export function writeGuestHistory(items: HistoryItem[]): void {
  if (!canUseStorage()) return;
  const map = new Map<string, HistoryItem>();
  for (const item of items) {
    const current = map.get(item.animeId);
    if (!current || item.updatedAt >= current.updatedAt) map.set(item.animeId, item);
  }
  const next = [...map.values()].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, HISTORY_LIMIT);
  try {
    window.localStorage.setItem(GUEST_HISTORY_KEY, JSON.stringify(next));
  } catch {
    /* kuota penuh atau mode privat: history tamu dilewati, bukan error fatal */
  }
}

export function recordGuestHistory(item: HistoryItem): void {
  const existing = readGuestHistory();
  writeGuestHistory([item, ...existing]);
}

export function removeGuestHistory(animeId: string): void {
  writeGuestHistory(readGuestHistory().filter((item) => item.animeId !== animeId));
}

export function clearGuestHistory(): void {
  if (!canUseStorage()) return;
  try {
    window.localStorage.removeItem(GUEST_HISTORY_KEY);
  } catch {
    /* abaikan */
  }
}
