import { usesPostgres } from '../db/config';
import { pgCreateUser, pgUpdateUser, pgUserByEmail, pgUserById, pgUserByOAuth } from '../db/accounts';
import { randomUUID } from 'node:crypto';
import { hashGetAll, hashSetMany, kvGet, kvSet, setIfAbsent } from './redis';
import { hashPassword } from './crypto';

export type AuthProvider = 'email' | 'google' | 'discord';

export interface StoredUser {
  id: string;
  username: string;
  email: string;
  avatar: string;
  provider: AuthProvider;
  providerId: string;
  passwordHash: string;
  createdAt: string;
  updatedAt: string;
}

export interface PublicUser {
  id: string;
  username: string;
  email: string;
  avatar: string | null;
  provider: AuthProvider;
  createdAt: string;
}

export class EmailTakenError extends Error {
  constructor() {
    super('Email sudah terdaftar');
    this.name = 'EmailTakenError';
  }
}

export function toPublicUser(user: StoredUser): PublicUser {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    avatar: user.avatar || null,
    provider: user.provider,
    createdAt: user.createdAt,
  };
}

function userKey(userId: string): string {
  return `user:${userId}`;
}

function emailKey(email: string): string {
  return `user:email:${email}`;
}

function parseUser(raw: Record<string, string>): StoredUser | null {
  if (!raw.id || !raw.email) return null;
  return {
    id: raw.id,
    username: raw.username || '',
    email: raw.email,
    avatar: raw.avatar || '',
    provider: (raw.provider as AuthProvider) || 'email',
    providerId: raw.providerId || '',
    passwordHash: raw.passwordHash || '',
    createdAt: raw.createdAt || '',
    updatedAt: raw.updatedAt || '',
  };
}

export async function findUserById(userId: string): Promise<StoredUser | null> {
  if (!userId) return null;
  if (usesPostgres()) return pgUserById(userId);
  const raw = await hashGetAll(userKey(userId));
  return parseUser(raw);
}

export async function findUserByEmail(email: string): Promise<StoredUser | null> {
  if (usesPostgres()) return pgUserByEmail(email);
  const id = await kvGet(emailKey(email));
  if (!id) return null;
  return findUserById(id);
}

export async function findUserByOAuth(provider: AuthProvider, providerId: string): Promise<StoredUser | null> {
  if (usesPostgres()) return pgUserByOAuth(provider, providerId);
  const id = await kvGet(`oauth:${provider}:${providerId}`);
  if (!id) return null;
  return findUserById(id);
}

export interface CreateUserInput {
  email: string;
  username: string;
  password?: string;
  provider?: AuthProvider;
  providerId?: string;
  avatar?: string | null;
}

/**
 * Email dipakai sebagai kunci unik lewat SET NX, jadi dua pendaftaran
 * bersamaan tidak bisa menghasilkan dua akun dengan email yang sama.
 */
export async function createUser(input: CreateUserInput): Promise<StoredUser> {
  const provider = input.provider || 'email';
  const email = input.email;
  const postgres = usesPostgres();
  if (!postgres && !(await setIfAbsent(emailKey(email), 'pending'))) throw new EmailTakenError();

  const now = new Date().toISOString();
  const user: StoredUser = {
    id: randomUUID(),
    username: input.username,
    email,
    avatar: input.avatar || '',
    provider,
    providerId: input.providerId || '',
    passwordHash: input.password ? hashPassword(input.password) : '',
    createdAt: now,
    updatedAt: now,
  };

  if (postgres) {
    if (!(await pgCreateUser(user))) throw new EmailTakenError();
    return user;
  }

  try {
    await hashSetMany(userKey(user.id), {
      id: user.id,
      username: user.username,
      email: user.email,
      avatar: user.avatar,
      provider: user.provider,
      providerId: user.providerId,
      passwordHash: user.passwordHash,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    });
    await kvSet(emailKey(email), user.id);
    if (provider !== 'email' && user.providerId) {
      await kvSet(`oauth:${provider}:${user.providerId}`, user.id);
    }
  } catch (error) {
    // Klaim email dilepas lagi supaya percobaan berikutnya tidak terkunci.
    await kvSet(emailKey(email), '');
    throw error;
  }

  return user;
}

export async function updateUser(userId: string, patch: Partial<Pick<StoredUser, 'username' | 'avatar' | 'updatedAt'>>): Promise<void> {
  if (usesPostgres()) return pgUpdateUser(userId, patch);
  const entries: Record<string, string> = {};
  if (patch.username !== undefined) entries.username = patch.username;
  if (patch.avatar !== undefined) entries.avatar = patch.avatar;
  entries.updatedAt = patch.updatedAt || new Date().toISOString();
  await hashSetMany(userKey(userId), entries);
}
