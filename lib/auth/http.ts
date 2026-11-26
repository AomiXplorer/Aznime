import { PersistenceError } from '../db/config';
import { RedisError } from './redis';
import type { FieldError } from './validation';

export function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}

export function jsonError(status: number, message: string, extra: Record<string, unknown> = {}): Response {
  return jsonResponse({ error: message, ...extra }, status);
}

export function validationResponse(errors: FieldError[]): Response {
  const first = errors[0];
  return jsonResponse({ error: first?.message || 'Data tidak valid.', errors }, 422);
}

/**
 * Alamat IP klien untuk kunci rate limit.
 *
 * `x-forwarded-for` bisa ditulis klien, jadi entri pertama tidak dipercaya:
 * yang dipakai adalah `x-real-ip` milik platform (Vercel mengisinya di edge),
 * lalu entri TERAKHIR XFF yang ditambahkan proxy terdekat. Nilainya juga
 * disaring ke bentuk IP saja, karena nilai mentah dari header menjadi bagian
 * kunci Redis dan tidak boleh bisa dipanjangkan sembarang orang.
 */
const IP_PATTERN = /^[0-9a-fA-F:.]{3,45}$/;

function sanitizeIp(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  return IP_PATTERN.test(trimmed) ? trimmed.toLowerCase() : null;
}

export function clientIp(request: Request): string {
  const realIp = sanitizeIp(request.headers.get('x-real-ip'));
  if (realIp) return realIp;

  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    const hops = forwarded.split(',');
    for (let i = hops.length - 1; i >= 0; i -= 1) {
      const hop = sanitizeIp(hops[i]);
      if (hop) return hop;
    }
  }
  return 'unknown';
}

/**
 * CSRF: setiap POST/DELETE harus datang dari origin yang sama dengan situs.
 * Cookie session juga SameSite=Lax, jadi dua lapis.
 */
export function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get('origin');
  if (!origin) return true; // permintaan non-browser (curl, cron) tanpa cookie lintas situs
  const allowed = new Set<string>();
  const authUrl = process.env.AUTH_URL || '';
  if (authUrl) {
    try {
      allowed.add(new URL(authUrl).origin);
    } catch {
      /* AUTH_URL tidak valid, abaikan */
    }
  }
  try {
    allowed.add(new URL(request.url).origin);
  } catch {
    /* abaikan */
  }
  return allowed.has(origin);
}

/**
 * Batas ukuran body JSON.
 *
 * Tanpa batas, `request.json()` membaca seluruh body ke memori lebih dulu
 * sebelum validasi apa pun berjalan. Semua body yang sah di situs ini kecil
 * (login, favorit, sinkron history tamu), jadi 512 KB sudah longgar.
 */
const MAX_JSON_BODY_BYTES = 512 * 1024;

export async function readJsonBody<T = Record<string, unknown>>(request: Request): Promise<T | null> {
  const declared = Number(request.headers.get('content-length') || 0);
  if (Number.isFinite(declared) && declared > MAX_JSON_BODY_BYTES) return null;
  try {
    return (await request.json()) as T;
  } catch {
    return null;
  }
}

export function handleRouteError(error: unknown): Response {
  if (error instanceof RedisError || error instanceof PersistenceError) {
    return jsonError(503, 'Layanan akun sedang tidak tersedia. Coba lagi sebentar lagi.');
  }
  console.error('[auth]', error);
  return jsonError(500, 'Terjadi kesalahan di server.');
}
