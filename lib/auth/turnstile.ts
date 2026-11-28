/**
 * Verifikasi token Cloudflare Turnstile di server. Frontend hanya mengirim
 * token; keputusan lolos atau tidak selalu diambil dari Siteverify.
 */
import { createHash } from 'node:crypto';
import { request as httpsRequest } from 'node:https';
import { setIfAbsent } from './redis';

export type TurnstileFailure =
  | 'missing-token'
  | 'invalid'
  | 'expired'
  | 'misconfigured'
  | 'unavailable';

export type TurnstileResult = { ok: true } | { ok: false; reason: TurnstileFailure };

export function turnstileSiteKey(): string {
  return process.env.TURNSTILE_SITE_KEY?.trim() || process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim() || '';
}

function turnstileSecret(): string {
  return (process.env.TURNSTILE_SECRET_KEY || '').trim();
}

export function isTurnstileConfigured(): boolean {
  return turnstileSiteKey().length > 0 && turnstileSecret().length > 0;
}

export function requiresTurnstile(): boolean {
  return process.env.TURNSTILE_REQUIRED === '1' || Boolean(turnstileSiteKey() || turnstileSecret());
}

/**
 * Cloudflare menolak `remoteip` loopback atau privat dengan HTTP 400, jadi
 * hanya alamat publik yang dikirim. Tanpa ini, semua percobaan login dari
 * lingkungan lokal (127.0.0.1) akan dianggap gagal verifikasi.
 */
function isPublicIp(value: string): boolean {
  if (!/^[0-9a-fA-F:.]{3,45}$/.test(value)) return false;
  if (value === '::1' || value === 'unknown') return false;
  if (value.startsWith('127.') || value.startsWith('10.') || value.startsWith('192.168.')) return false;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(value)) return false;
  if (value.startsWith('::ffff:127.') || value.startsWith('fe80:') || value.startsWith('fc') || value.startsWith('fd')) {
    return false;
  }
  return true;
}

/**
 * Siteverify dipanggil lewat node:https, bukan fetch, supaya tidak melewati
 * lapisan cache fetch milik framework. Body balasan dikembalikan apa adanya.
 */
function postForm(payload: string): Promise<string | null> {
  return new Promise((resolve) => {
    const req = httpsRequest(
      {
        host: 'challenges.cloudflare.com',
        path: '/turnstile/v0/siteverify',
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': Buffer.byteLength(payload),
        },
        timeout: 8000,
      },
      (res) => {
        let raw = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => {
          raw += chunk;
        });
        res.on('end', () => {
          const status = res.statusCode || 0;
          // Cloudflare menjawab HTTP 400 untuk secret yang salah, tetapi body-nya
          // tetap berisi error-codes. Body 4xx harus dibaca supaya kasus
          // 'invalid-input-secret' bisa dibedakan dari gangguan jaringan.
          if (status >= 500) {
            console.error('[turnstile] siteverify status', status);
            resolve(null);
            return;
          }
          resolve(raw);
        });
      }
    );
    req.on('timeout', () => {
      req.destroy();
      resolve(null);
    });
    req.on('error', (error) => {
      console.error('[turnstile] siteverify gagal', error.message);
      resolve(null);
    });
    req.write(payload);
    req.end();
  });
}

interface SiteverifyResponse {
  success?: boolean;
  'error-codes'?: string[];
  hostname?: string;
}

export async function verifyTurnstile(
  token: string | null | undefined,
  options: { ip?: string | null; expectedHostname?: string | null } = {}
): Promise<TurnstileResult> {
  const secret = turnstileSecret();
  const hostname = options.expectedHostname || process.env.TURNSTILE_HOSTNAME?.trim();
  if (!secret || !turnstileSiteKey() || (process.env.TURNSTILE_REQUIRED === '1' && !hostname)) {
    return { ok: false, reason: 'misconfigured' };
  }
  if (!token) return { ok: false, reason: 'missing-token' };
  if (token.length > 2048) return { ok: false, reason: 'invalid' };

  const body = new URLSearchParams();
  body.set('secret', secret);
  body.set('response', token);
  if (options.ip && isPublicIp(options.ip)) body.set('remoteip', options.ip);

  const result = await postForm(body.toString());
  if (!result) return { ok: false, reason: 'unavailable' };

  let data: SiteverifyResponse;
  try {
    data = JSON.parse(result) as SiteverifyResponse;
  } catch {
    return { ok: false, reason: 'unavailable' };
  }

  const codes = data['error-codes'] || [];
  if (data.success === true) {
    if (hostname && data.hostname !== hostname) {
      return { ok: false, reason: 'invalid' };
    }
    // Siteverify dapat menerima token yang sama saat status penggunaan belum
    // tersebar ke semua lokasi. Redis memastikan hanya satu request lolos.
    const tokenHash = createHash('sha256').update(token).digest('hex');
    if (!(await setIfAbsent(`turnstile:redeemed:${tokenHash}`, '1', 300))) {
      return { ok: false, reason: 'expired' };
    }
    return { ok: true };
  }
  if (codes.includes('invalid-input-secret') || codes.includes('missing-input-secret')) {
    return { ok: false, reason: 'misconfigured' };
  }
  if (codes.includes('timeout-or-duplicate')) return { ok: false, reason: 'expired' };
  return { ok: false, reason: 'invalid' };
}
