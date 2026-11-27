import { usesPostgres } from '../db/config';
import { pgDeleteUser } from '../db/accounts';
import { isRedisConfigured, kvDel, kvGet } from './redis';
import { findUserById } from './users';

function sessionKey(tokenHash: string): string {
  return `session:${tokenHash}`;
}

function accountKeys(userId: string): string[] {
  return [
    `user:${userId}:favorites`,
    `user:${userId}:favorites:data`,
    `user:${userId}:history`,
    `user:${userId}:history:data`,
  ];
}

/**
 * Menghapus akun beserta riwayat, favorit, dan seluruh sesinya. Baris
 * aznime_users sudah menurunkan aznime_library_entries lewat cascade, jadi
 * yang perlu dibereskan di sini hanya kunci Redis dan sesi yang tersisa.
 */
export async function deleteAccount(userId: string): Promise<void> {
  const user = await findUserById(userId);
  if (usesPostgres()) await pgDeleteUser(userId);
  if (!isRedisConfigured()) return;

  const keys = accountKeys(userId);
  const sessionIndex = await kvGet(`user:${userId}:sessions`);
  if (sessionIndex) {
    keys.push(...sessionIndex.split(',').filter(Boolean).map(sessionKey));
  }
  keys.push(`user:${userId}:sessions`);

  if (user) {
    keys.push(`user:${user.id}`, `user:email:${user.email}`);
    if (user.provider !== 'email' && user.providerId) {
      keys.push(`oauth:${user.provider}:${user.providerId}`);
    }
  }

  await kvDel(...keys);
}
