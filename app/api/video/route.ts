import type { NextRequest } from 'next/server';
import { rateLimitGuard } from '@/lib/api-guard';

/**
 * Proksi berkas video arsip Malz.
 *
 * CDN Malz menyimpan berkas dengan garis miring di dalam nama objek, jadi
 * tautannya memakai `%2F` (mis. `/Blue%20Archive%20the%20Animation%2F1-360p.mp4`).
 * Sebagian browser dan jaringan menormalkan `%2F` menjadi `/`, sehingga request
 * berubah menjadi path lain yang memuat spasi mentah dan server membalas
 * 400 Bad Request. Dengan proksi ini browser hanya melihat URL aznime.com dan
 * encoding asli dipertahankan di sisi server. Range diteruskan supaya seek,
 * resume, dan streaming bertahap tetap bekerja.
 *
 * Sebagian host (storages.animein.net) dilindungi Cloudflare Managed Challenge:
 * request dari IP pusat data dibalas 403 dengan header `cf-mitigated: challenge`,
 * jadi berkasnya tidak mungkin diambil dari server sama sekali. Untuk host itu
 * (dan untuk setiap balasan 401/403/429 dari upstream) route ini tidak memproksi,
 * melainkan mengalihkan browser ke URL asli. Encoding `%2F` tetap utuh karena
 * Location ditulis dari URL yang sudah terparse di sisi server, dan unduhannya
 * dilakukan browser pengunjung yang lolos challenge.
 */

const VIDEO_HOSTS = new Set([
  'storages.animein.net',
  'api.animein.net',
  'xyz-api.animein.net',
  'animein.net',
  'www.animein.net',
  'animeinweb.com',
]);

/** Host yang menolak semua permintaan non-browser, jadi harus diambil browser penonton. */
const BROWSER_ONLY_HOSTS = new Set(['storages.animein.net']);

const BROWSER_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

const PASSTHROUGH = [
  'content-type',
  'content-length',
  'content-range',
  'accept-ranges',
  'etag',
  'last-modified',
];

const HLS_PATTERN = /\.m3u8(\?|$)/i;

export const dynamic = 'force-dynamic';

function redirectTo(target: URL): Response {
  return new Response(null, {
    status: 307,
    headers: { location: target.toString(), 'cache-control': 'no-store' },
  });
}

export async function GET(req: NextRequest) {
  const limited = await rateLimitGuard(req, { name: 'video', limit: 240, windowSeconds: 60 });
  if (limited) return limited;

  const raw = req.nextUrl.searchParams.get('u');
  let target: URL | null = null;
  try {
    target = raw ? new URL(raw) : null;
  } catch {
    target = null;
  }

  if (!target || target.protocol !== 'https:') {
    return new Response('Permintaan tidak valid', { status: 400 });
  }

  if (!VIDEO_HOSTS.has(target.hostname.toLowerCase())) {
    return new Response('Host tidak diizinkan', { status: 403 });
  }

  /* Playlist HLS tetap diproksi: segmennya relatif dan hls.js memuatnya lewat
     XHR, yang butuh CORS dari host playlist. Berkas video biasa dialihkan. */
  const isHls = HLS_PATTERN.test(target.pathname + target.search);
  if (!isHls && BROWSER_ONLY_HOSTS.has(target.hostname.toLowerCase())) {
    return redirectTo(target);
  }

  const range = req.headers.get('range');
  const headers: Record<string, string> = {
    Accept: '*/*',
    'User-Agent': BROWSER_USER_AGENT,
    Referer: 'https://aznime.com/',
  };
  if (range) headers.Range = range;

  let upstream: Response;
  try {
    upstream = await fetch(target.toString(), {
      headers,
      cache: 'no-store',
      signal: AbortSignal.timeout(25_000),
    });
  } catch {
    return new Response('Gagal menghubungi sumber video', { status: 502 });
  }

  if (upstream.status === 416) {
    const out = new Headers();
    const contentRange = upstream.headers.get('content-range');
    if (contentRange) out.set('content-range', contentRange);
    return new Response(null, { status: 416, headers: out });
  }

  if (!upstream.ok) {
    await upstream.body?.cancel();
    /* 403 `cf-mitigated: challenge`, 401, dan 429 berarti host menolak IP server
       atau membatasi laju. Browser pengunjung masih bisa mengambil berkasnya. */
    if (!isHls && [401, 403, 429].includes(upstream.status)) {
      return redirectTo(target);
    }
    return new Response('Sumber video menolak permintaan', { status: 502 });
  }

  const out = new Headers();
  for (const key of PASSTHROUGH) {
    const value = upstream.headers.get(key);
    if (value) out.set(key, value);
  }
  if (!out.has('accept-ranges')) out.set('accept-ranges', 'bytes');
  out.set('cache-control', 'public, max-age=3600');

  return new Response(upstream.body, { status: upstream.status, headers: out });
}
