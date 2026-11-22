import { NextResponse } from 'next/server';

/**
 * Proksi gambar Aznime.
 *
 * Dua sumber butuh perlakuan berbeda:
 * - animein memakai Cloudflare yang menolak permintaan tanpa Referer situsnya,
 *   jadi Referer wajib dikirim.
 * - nekopoi justru memblokir hotlink: Referer dari domain lain dibalas 403.
 *   Selain itu sebagian ISP di Indonesia memblokir domain sumber, sehingga
 *   browser penonton tidak pernah menerima gambarnya. Semua poster Nekopoi
 *   karena itu selalu lewat rute ini.
 */

const ANIMEIN_HOSTS = new Set([
  'api.animein.net',
  'xyz-api.animein.net',
  'animein.net',
  'www.animein.net',
  'animeinweb.com',
  'storages.animein.net',
]);

const NEKOPOI_HOSTS = new Set(['nekopoi.care', 'www.nekopoi.care']);

const BROWSER_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

const UPSTREAM_REFERER = 'https://animein.net/';

type Upstream = 'animein' | 'nekopoi';

function resolveTarget(raw: string | null): { url: URL; upstream: Upstream } | null {
  if (!raw) return null;
  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return null;
    const host = parsed.hostname.toLowerCase();
    if (ANIMEIN_HOSTS.has(host)) return { url: parsed, upstream: 'animein' };
    if (NEKOPOI_HOSTS.has(host)) return { url: parsed, upstream: 'nekopoi' };
    return null;
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  const target = resolveTarget(new URL(request.url).searchParams.get('u'));
  if (!target) {
    return NextResponse.json({ error: 'Parameter u tidak valid' }, { status: 400 });
  }

  const headers: Record<string, string> = {
    'User-Agent': BROWSER_USER_AGENT,
    Accept: 'image/avif,image/webp,image/*,*/*;q=0.8',
  };
  if (target.upstream === 'animein') headers.Referer = UPSTREAM_REFERER;

  try {
    const upstream = await fetch(target.url.toString(), {
      headers,
      signal: AbortSignal.timeout(8000),
      next: { revalidate: 604800 },
    });

    const contentType = upstream.headers.get('content-type') || '';
    if (!upstream.ok || !contentType.startsWith('image/')) {
      return fallback(target);
    }

    const body = await upstream.arrayBuffer();
    return new NextResponse(body, {
      headers: {
        'Content-Type': contentType,
        'Content-Length': String(body.byteLength),
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch {
    return fallback(target);
  }
}

/**
 * Animein masih bisa dipakai langsung sebagai cadangan. Untuk Nekopoi tidak:
 * pengalihan ke domain sumber hanya akan berakhir 403 atau diblokir ISP, jadi
 * balasan 404 dipakai supaya komponen gambar menampilkan placeholder lokalnya.
 */
function fallback(target: { url: URL; upstream: Upstream }) {
  if (target.upstream === 'nekopoi') {
    return new NextResponse(null, {
      status: 404,
      headers: { 'Cache-Control': 'public, max-age=300' },
    });
  }
  return NextResponse.redirect(target.url.toString(), 302);
}
