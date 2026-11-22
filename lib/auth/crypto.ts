import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

/* Parameter scrypt dipilih supaya masih muat di batas CPU Vercel Serverless
   (N=16384 memakai ~16 MB dan selesai di bawah 100 ms), tetapi jauh di atas
   batas yang membuat serangan kamus murah. Format simpan:
   scrypt$N$r$p$saltBase64$hashBase64 */
const N = 16384;
const R = 8;
const P = 1;
const KEYLEN = 64;

export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const derived = scryptSync(password.normalize('NFKC'), salt, KEYLEN, { N, r: R, p: P, maxmem: 64 * 1024 * 1024 });
  return ['scrypt', N, R, P, salt.toString('base64'), derived.toString('base64')].join('$');
}

export function verifyPassword(password: string, stored: string | null | undefined): boolean {
  if (!stored) return false;
  const parts = stored.split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
  const n = Number.parseInt(parts[1], 10);
  const r = Number.parseInt(parts[2], 10);
  const p = Number.parseInt(parts[3], 10);
  if (!Number.isFinite(n) || !Number.isFinite(r) || !Number.isFinite(p)) return false;

  let salt: Buffer;
  let expected: Buffer;
  try {
    salt = Buffer.from(parts[4], 'base64');
    expected = Buffer.from(parts[5], 'base64');
  } catch {
    return false;
  }
  if (salt.length === 0 || expected.length === 0) return false;

  let derived: Buffer;
  try {
    derived = scryptSync(password.normalize('NFKC'), salt, expected.length, { N: n, r, p, maxmem: 64 * 1024 * 1024 });
  } catch {
    return false;
  }
  return derived.length === expected.length && timingSafeEqual(derived, expected);
}

/** Token acak 32 byte dalam base64url, dipakai untuk session dan state OAuth. */
export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString('base64url');
}

export function sha256Hex(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

/**
 * Yang disimpan di Redis hanya hash token + pepper AUTH_SECRET. Kalau isi
 * database bocor, token session mentah tidak bisa dipakai ulang.
 */
export function sessionTokenHash(token: string): string {
  const pepper = process.env.AUTH_SECRET || '';
  return sha256Hex(`${token}.${pepper}`);
}
