import { hashDel, hashGetAll, hashSetMany, zAdd, zRem, zRevRange } from './redis';

export const FAVORITES_LIMIT = 500;

export interface FavoriteItem {
  animeId: string;
  title: string;
  poster: string | null;
  addedAt: number;
}

export function sanitizeFavoriteInput(input: unknown): FavoriteItem | null {
  if (!input || typeof input !== 'object') return null;
  const raw = input as Record<string, unknown>;
  const animeId = typeof raw.animeId === 'string' ? raw.animeId.trim().slice(0, 200) : '';
  const title = typeof raw.title === 'string' ? raw.title.trim().slice(0, 300) : '';
  if (!animeId || !title) return null;
  const poster = typeof raw.poster === 'string' ? raw.poster.trim().slice(0, 500) : '';
  return { animeId, title, poster: poster || null, addedAt: Date.now() };
}

function favoritesKey(userId: string): string {
  return `user:${userId}:favorites`;
}

function favoritesDataKey(userId: string): string {
  return `user:${userId}:favorites:data`;
}

export async function listFavorites(userId: string): Promise<FavoriteItem[]> {
  const ids = await zRevRange(favoritesKey(userId), 0, FAVORITES_LIMIT - 1);
  if (ids.length === 0) return [];
  const raw = await hashGetAll(favoritesDataKey(userId));
  const items: FavoriteItem[] = [];
  for (const id of ids) {
    const value = raw[id];
    if (!value) continue;
    try {
      const parsed = JSON.parse(value) as FavoriteItem;
      if (parsed?.animeId && parsed?.title) items.push({ ...parsed, addedAt: Number(parsed.addedAt) || 0 });
    } catch {
      /* abaikan entri rusak */
    }
  }
  return items.sort((a, b) => b.addedAt - a.addedAt);
}

/** Satu anime hanya bisa masuk sekali: ZADD dengan member animeId bersifat idempoten. */
export async function addFavorite(userId: string, item: FavoriteItem): Promise<FavoriteItem> {
  await zAdd(favoritesKey(userId), item.addedAt, item.animeId);
  await hashSetMany(favoritesDataKey(userId), { [item.animeId]: JSON.stringify(item) });
  return item;
}

export async function removeFavorite(userId: string, animeId: string): Promise<void> {
  await zRem(favoritesKey(userId), animeId);
  await hashDel(favoritesDataKey(userId), animeId);
}
