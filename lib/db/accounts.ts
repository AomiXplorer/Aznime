import type { AuthProvider, StoredUser } from '../auth/users';
import { PersistenceError } from './config';
import { database } from './supabase';

const COLUMNS = 'id,username,email,avatar,provider,provider_id,password_hash,created_at,updated_at';
const TABLE = 'aznime_users';

export function accountRow(user: StoredUser) {
  return {
    id: user.id, username: user.username, email: user.email, avatar: user.avatar,
    provider: user.provider, provider_id: user.providerId, password_hash: user.passwordHash,
    created_at: user.createdAt, updated_at: user.updatedAt,
  };
}

async function find(query: PromiseLike<{ data: ReturnType<typeof accountRow> | null; error: unknown }>): Promise<StoredUser | null> {
  const { data, error } = await query;
  if (error) throw new PersistenceError();
  if (!data) return null;
  return {
    id: data.id, username: data.username, email: data.email, avatar: data.avatar, provider: data.provider,
    providerId: data.provider_id, passwordHash: data.password_hash,
    createdAt: new Date(data.created_at).toISOString(), updatedAt: new Date(data.updated_at).toISOString(),
  };
}

export function pgUserById(id: string) {
  return find(database().from(TABLE).select(COLUMNS).eq('id', id).maybeSingle());
}

export function pgUserByEmail(email: string) {
  return find(database().from(TABLE).select(COLUMNS).eq('email', email).maybeSingle());
}

export function pgUserByOAuth(provider: AuthProvider, id: string) {
  return find(database().from(TABLE).select(COLUMNS).eq('provider', provider).eq('provider_id', id).maybeSingle());
}

export async function pgCreateUser(user: StoredUser) {
  const { error } = await database().from(TABLE).insert(accountRow(user));
  if (error?.code === '23505') return false;
  if (error) throw new PersistenceError();
  return true;
}

export async function pgUpdateUser(id: string, patch: { username?: string; avatar?: string; updatedAt?: string }) {
  const { error } = await database().from(TABLE).update({
    username: patch.username, avatar: patch.avatar, updated_at: patch.updatedAt || new Date().toISOString(),
  }).eq('id', id);
  if (error) throw new PersistenceError();
}
