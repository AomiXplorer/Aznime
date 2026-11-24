import { cookies } from 'next/headers';
import { cache } from 'react';
import { randomToken, sessionTokenHash } from './crypto';
import { hashGetAll, hashSetMany, kvDel, kvExpire, kvGet, kvSet } from './redis';
import { findUserById, toPublicUser, type PublicUser } from './users';

export const SESSION_COOKIE = 'aznime_session';
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30;

<<<<<<< HEAD
function useSecureCookie(): boolean {
  return (process.env.AUTH_URL || '').startsWith('https://');
=======
/**
 * Cookie session hanya boleh dikirim lewat HTTPS di production.
 *
 * Sebelumnya penilaian ini bergantung tunggal pada AUTH_URL. Kalau variabel itu
 * lupa diisi, cookie turun jadi non-Secure di situs HTTPS. Sekarang sinyal
 * platform (VERCEL_ENV) ikut diperiksa, jadi salah konfigurasi satu variabel
 * tidak lagi melemahkan cookie.
 */
function useSecureCookie(): boolean {
  if ((process.env.AUTH_URL || '').startsWith('https://')) return true;
  return process.env.VERCEL_ENV === 'production';
>>>>>>> c5dfbd0 (Update maintennace)
}

export interface SessionMeta {
  ip?: string | null;
  userAgent?: string | null;
}

function sessionKey(tokenHash: string): string {
  return `session:${tokenHash}`;
}

function sessionIndexKey(userId: string): string {
  return `user:${userId}:sessions`;
}

/** Session lama dicabut saat login baru supaya satu akun hanya punya satu sesi aktif. */
async function revokeUserSessions(userId: string): Promise<void> {
  const indexKey = sessionIndexKey(userId);
  const existing = await kvGet(indexKey);
  if (!existing) return;
  const hashes = existing.split(',').filter(Boolean);
  for (const hash of hashes) {
    await kvDel(sessionKey(hash));
  }
  await kvSet(indexKey, '');
}

<<<<<<< HEAD
=======
/**
 * Daftar hash session per pengguna ikut diberi masa berlaku. Tanpa TTL, kunci
 * indeks tumbuh selamanya untuk akun yang sering login, dan tidak pernah
 * dibersihkan walaupun session-nya sudah lama mati.
 */
const SESSION_INDEX_TTL_SECONDS = SESSION_TTL_SECONDS * 2;

async function rememberSessionHash(userId: string, tokenHash: string): Promise<void> {
  const indexKey = sessionIndexKey(userId);
  const existing = (await kvGet(indexKey)) || '';
  const hashes = existing.split(',').filter(Boolean).slice(-4);
  const next = [...hashes, tokenHash].join(',');
  await kvSet(indexKey, next);
  await kvExpire(indexKey, SESSION_INDEX_TTL_SECONDS);
}

async function forgetSessionHash(userId: string, tokenHash: string): Promise<void> {
  const indexKey = sessionIndexKey(userId);
  const existing = await kvGet(indexKey);
  if (!existing) return;
  const remaining = existing
    .split(',')
    .filter((hash) => hash && hash !== tokenHash)
    .join(',');
  await kvSet(indexKey, remaining);
}

>>>>>>> c5dfbd0 (Update maintennace)
export async function createSession(userId: string, meta: SessionMeta = {}): Promise<{ token: string; expiresAt: number }> {
  await revokeUserSessions(userId);

  const token = randomToken(32);
  const tokenHash = sessionTokenHash(token);
  const expiresAt = Date.now() + SESSION_TTL_SECONDS * 1000;

  await hashSetMany(sessionKey(tokenHash), {
    userId,
    createdAt: new Date().toISOString(),
    expiresAt: String(expiresAt),
    ip: meta.ip || '',
    ua: (meta.userAgent || '').slice(0, 200),
  });
  await kvExpire(sessionKey(tokenHash), SESSION_TTL_SECONDS);

<<<<<<< HEAD
  const indexKey = sessionIndexKey(userId);
  const existing = (await kvGet(indexKey)) || '';
  await kvSet(indexKey, existing ? `${existing},${tokenHash}` : tokenHash);
=======
  await rememberSessionHash(userId, tokenHash);
>>>>>>> c5dfbd0 (Update maintennace)

  return { token, expiresAt };
}

export async function readSessionToken(): Promise<string | null> {
  const jar = await cookies();
  return jar.get(SESSION_COOKIE)?.value || null;
}

export async function setSessionCookie(token: string): Promise<void> {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: useSecureCookie(),
    path: '/',
    maxAge: SESSION_TTL_SECONDS,
  });
}

export async function clearSessionCookie(): Promise<void> {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: useSecureCookie(),
    path: '/',
    maxAge: 0,
  });
}

<<<<<<< HEAD
export async function destroySession(token: string): Promise<void> {
  await kvDel(sessionKey(sessionTokenHash(token)));
=======
/**
 * Logout harus benar-benar mematikan session di server, bukan hanya
 * menghapus cookie: hash-nya dibuang dari Redis dan dari indeks milik
 * pengguna supaya tidak ada sisa entri yang bisa dipakai ulang.
 */
export async function destroySession(token: string): Promise<void> {
  const tokenHash = sessionTokenHash(token);
  const key = sessionKey(tokenHash);
  const data = await hashGetAll(key);
  await kvDel(key);
  if (data.userId) await forgetSessionHash(data.userId, tokenHash);
>>>>>>> c5dfbd0 (Update maintennace)
}

/**
 * Dibungkus cache() supaya satu request hanya menembak Redis sekali walau
 * dipanggil dari page dan komponen server sekaligus.
 */
export const getSessionUser = cache(async (): Promise<PublicUser | null> => {
  const token = await readSessionToken();
  if (!token) return null;
  const tokenHash = sessionTokenHash(token);
  const data = await hashGetAll(sessionKey(tokenHash));
  if (!data.userId) return null;
  const expiresAt = Number(data.expiresAt || 0);
  if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
    await kvDel(sessionKey(tokenHash));
    return null;
  }
  const user = await findUserById(data.userId);
  if (!user) return null;
  return toPublicUser(user);
});
