import type { FavoriteItem } from '../auth/favorites';
import type { HistoryItem } from '../auth/history';
import { cachedLibrary, invalidateLibrary } from './library-cache';
import { PersistenceError } from './config';
import { database } from './supabase';

type Items = { history: HistoryItem; favorites: FavoriteItem };
type Kind = keyof Items;
const limits = { history: 100, favorites: 500 };
const ttl = { history: 30, favorites: 90 };
const cacheKey = (id: string, kind: Kind) => `aznime:pg:v1:${kind}:${id}`;

export async function pgList<K extends Kind>(id: string, kind: K): Promise<Items[K][]> {
  return cachedLibrary(cacheKey(id, kind), ttl[kind], async () => {
    const column = kind === 'history' ? 'history_version' : 'favorites_version';
    const { data, error } = await database().from('aznime_users').select(column).eq('id', id).single();
    if (error || !data) throw new PersistenceError();
    return (data as Record<string, string>)[column];
  }, async () => {
    const { data, error } = await database().from('aznime_library_entries')
      .select('item').eq('user_id', id).eq('kind', kind)
      .order('recorded_ms', { ascending: false }).order('anime_id', { ascending: false }).limit(limits[kind]);
    if (error || !data) throw new PersistenceError();
    return data.map(row => row.item as Items[K]);
  });
}

export async function pgMutate<K extends Kind>(
  id: string, kind: K, action: 'put' | 'sync' | 'delete', items: Items[K][] = [], animeId?: string,
): Promise<Items[K] | Items[K][] | null> {
  const { data, error } = await database().rpc('aznime_mutate_library', {
    p_user: id, p_kind: kind, p_action: action, p_items: items, p_anime: animeId ?? null,
  });
  if (error) throw new PersistenceError();
  await invalidateLibrary(cacheKey(id, kind));
  return data as Items[K] | Items[K][] | null;
}

export async function pgAccountCounts(id: string): Promise<{ history: number; favorites: number }> {
  const { data, error } = await database().rpc('aznime_account_counts', { p_user: id });
  if (error || !data) throw new PersistenceError();
  return data as { history: number; favorites: number };
}
