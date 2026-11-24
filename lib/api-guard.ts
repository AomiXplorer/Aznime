import { clientIp } from '@/lib/auth/http';
import { consumeRateLimit } from '@/lib/auth/rate-limit';
import { RedisError } from '@/lib/auth/redis';

/**
 * Penjaga untuk rute publik (katalog, pencarian, gambar).
 *
 * Rute ini tidak butuh login, tapi setiap panggilan meneruskan permintaan ke
 * sumber pihak ketiga atau menjalankan sharp. Tanpa batas, satu skrip bisa
 * menghabiskan kuota fungsi, memicu blokir dari sumber data, dan menaikkan
 * biaya. Batasnya sengaja longgar supaya pengunjung normal tidak terganggu.
 */

const NO_STORE = 'no-store, no-cache, must-revalidate';

function jsonErrorResponse(status: number, error: string, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify({ error }), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': NO_STORE,
      ...extra,
    },
  });
}

export interface RateLimitOptions {
  /** Nama bucket, dipakai di kunci Redis. */
  name: string;
  /** Jumlah permintaan yang diizinkan per jendela waktu. */
  limit: number;
  /** Panjang jendela dalam detik. */
  windowSeconds: number;
}

/**
 * Mengembalikan Response 429 bila kuota habis, atau null bila permintaan boleh
 * lanjut. Kalau Redis sedang tidak tersedia, permintaan DIBIARKAN lewat:
 * katalog publik tidak boleh ikut mati hanya karena penyimpanan kuota error.
 */
export async function rateLimitGuard(request: Request, options: RateLimitOptions): Promise<Response | null> {
  try {
    const result = await consumeRateLimit(
      `${options.name}:${clientIp(request)}`,
      options.limit,
      options.windowSeconds
    );
    if (result.allowed) return null;
    return jsonErrorResponse(429, 'Terlalu banyak permintaan. Coba lagi sebentar lagi.', {
      'Retry-After': String(result.retryAfterSeconds),
    });
  } catch (error) {
    const status = error instanceof RedisError ? error.status : 'unknown';
    console.error(`[rate-limit] pemeriksaan kuota ${options.name} gagal (status=${status}); permintaan dilewatkan.`);
    return null;
  }
}

/**
 * Kegagalan sumber pihak ketiga tidak boleh diteruskan apa adanya ke browser.
 * Pesan asli bisa memuat URL internal, nama host sumber, atau kode status
 * upstream. Yang dikirim ke klien hanya pesan umum; detailnya masuk log server.
 */
export function upstreamFailure(context: string, error: unknown, message: string): Response {
  const detail = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  console.error(`[api:${context}] ${detail.slice(0, 300)}`);
  return jsonErrorResponse(502, message);
}
