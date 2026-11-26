import { usesPostgres, PersistenceError } from '../db/config';
import { pgList, pgMutate } from '../db/library';
import { hashDel, hashGetAll, hashSetMany, redisPipeline, zCard, zRem, zRevRange, zScore, zAdd } from './redis';

export const HISTORY_LIMIT = 100;

export interface HistoryItem {
  animeId: string;
  title: string;
  poster: string | null;
  episodeNumber: string | null;
  episodeSlug: string | null;
  episodeTitle: string | null;
  updatedAt: number;
  position: number;
}

export function sanitizeHistoryItem(input: unknown): HistoryItem | null {
  if (!input || typeof input !== 'object') return null;
  const raw = input as Record<string, unknown>;
  const animeId = typeof raw.animeId === 'string' ? raw.animeId.trim().slice(0, 200) : '';
  const title = typeof raw.title === 'string' ? raw.title.trim().slice(0, 300) : '';
  if (!animeId || !title) return null;

  const poster = typeof raw.poster === 'string' ? raw.poster.trim().slice(0, 500) : '';
  const episodeNumber =
    typeof raw.episodeNumber === 'string' || typeof raw.episodeNumber === 'number'
      ? String(raw.episodeNumber).slice(0, 20)
      : null;
  const episodeSlug = typeof raw.episodeSlug === 'string' ? raw.episodeSlug.trim().slice(0, 300) : null;
  const episodeTitle = typeof raw.episodeTitle === 'string' ? raw.episodeTitle.trim().slice(0, 300) : null;
  const updatedAt = Number(raw.updatedAt);
  const position = Number(raw.position);

  return {
    animeId,
    title,
    poster: poster || null,
    episodeNumber,
    episodeSlug,
    episodeTitle,
    updatedAt: Number.isFinite(updatedAt) && updatedAt > 0 ? Math.min(updatedAt, Date.now() + 60_000) : Date.now(),
    position: Number.isFinite(position) && position > 0 ? Math.floor(position) : 0,
  };
}

function historyKey(userId: string): string {
  return `user:${userId}:history`;
}

function historyDataKey(userId: string): string {
  return `user:${userId}:history:data`;
}

function parseItems(raw: Record<string, string>): HistoryItem[] {
  const items: HistoryItem[] = [];
  for (const value of Object.values(raw)) {
    try {
      const parsed = sanitizeHistoryItem(JSON.parse(value));
      if (parsed) items.push(parsed);
    } catch {
      /* entri rusak dilewati, tidak menggagalkan seluruh daftar */
    }
  }
  return items;
}

export async function listHistory(userId: string): Promise<HistoryItem[]> {
  if (usesPostgres()) return pgList(userId, 'history');
  const ids = await zRevRange(historyKey(userId), 0, HISTORY_LIMIT - 1);
  if (ids.length === 0) return [];
  const raw = await hashGetAll(historyDataKey(userId));
  const items: HistoryItem[] = [];
  for (const id of ids) {
    const value = raw[id];
    if (!value) continue;
    try {
      const parsed = sanitizeHistoryItem(JSON.parse(value));
      if (parsed) items.push(parsed);
    } catch {
      /* abaikan entri rusak */
    }
  }
  // zset sudah urut terbaru, tetapi hash bisa tertinggal; urutkan ulang sebagai jaring aman.
  return items.sort((a, b) => b.updatedAt - a.updatedAt).slice(0, HISTORY_LIMIT);
}

/**
 * Tulis history: satu ZADD + satu HSET, lalu potong ekor kalau melewati batas.
 * Skor memakai timestamp sehingga anime yang sama tidak pernah dobel.
 */
export async function upsertHistory(userId: string, item: HistoryItem): Promise<HistoryItem> {
  if (usesPostgres()) {
    const result = await pgMutate(userId, 'history', 'put', [item]);
    if (!result || Array.isArray(result)) throw new PersistenceError();
    return result;
  }
  const zsetKey = historyKey(userId);
  const dataKey = historyDataKey(userId);

  const existingScore = await zScore(zsetKey, item.animeId);
  if (existingScore !== null && existingScore > item.updatedAt) {
    // Data di server lebih baru (misalnya dari perangkat lain); jangan turunkan.
    const raw = await hashGetAll(dataKey);
    const existing = raw[item.animeId];
    if (existing) {
      try {
        const parsed = sanitizeHistoryItem(JSON.parse(existing));
        if (parsed) return parsed;
      } catch {
        /* lanjut tulis data baru */
      }
    }
  }

  await zAdd(zsetKey, item.updatedAt, item.animeId);
  await hashSetMany(dataKey, { [item.animeId]: JSON.stringify(item) });

  const total = await zCard(zsetKey);
  if (total > HISTORY_LIMIT) {
    const overflow = await zRevRange(zsetKey, HISTORY_LIMIT, total - 1);
    if (overflow.length > 0) {
      await zRem(zsetKey, ...overflow);
      await hashDel(dataKey, ...overflow);
    }
  }

  return item;
}

export async function removeHistory(userId: string, animeId: string): Promise<void> {
  if (usesPostgres()) {
    await pgMutate(userId, 'history', 'delete', [], animeId);
    return;
  }
  await zRem(historyKey(userId), animeId);
  await hashDel(historyDataKey(userId), animeId);
}

/**
 * Gabung history tamu dengan history akun. Timestamp terbaru menang dan satu
 * anime hanya muncul sekali. Fungsi murni supaya bisa diuji tanpa Redis.
 */
export function mergeHistoryItems(guestItems: HistoryItem[], accountItems: HistoryItem[]): HistoryItem[] {
  const merged = new Map<string, HistoryItem>();
  for (const item of [...accountItems, ...guestItems]) {
    const current = merged.get(item.animeId);
    if (!current || item.updatedAt >= current.updatedAt) {
      merged.set(item.animeId, item);
    }
  }
  return [...merged.values()].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, HISTORY_LIMIT);
}

export async function syncHistory(userId: string, guestItems: unknown[]): Promise<{ items: HistoryItem[]; synced: true }> {
  const clean = guestItems.map(sanitizeHistoryItem).filter((item): item is HistoryItem => item !== null);
  if (usesPostgres()) {
    const result = await pgMutate(userId, 'history', 'sync', clean);
    if (!Array.isArray(result)) throw new PersistenceError();
    return { items: result, synced: true };
  }
  const accountItems = await listHistory(userId);
  const merged = mergeHistoryItems(clean, accountItems);

  const commands: (string | number)[][] = [];
  for (const item of merged) {
    commands.push(['ZADD', historyKey(userId), item.updatedAt, item.animeId]);
    commands.push(['HSET', historyDataKey(userId), item.animeId, JSON.stringify(item)]);
  }
  if (commands.length > 0) await redisPipeline(commands);

  return { items: merged, synced: true };
}
