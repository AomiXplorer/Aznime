import { NextResponse } from 'next/server';
import sharp from 'sharp';

/**
 * Proksi + resize gambar Aznime.
 *
 * Vercel Image Optimization dibatasi kuota, jadi poster/hero tidak boleh
 * bergantung pada /_next/image. Rute ini mengambil gambar dari host yang
 * diizinkan, lalu (kalau ada `w`) mengecilkan dan mengubahnya ke WebP/AVIF
 * dengan sharp. Hasilnya di-cache immutable di CDN.
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
const HIDORI_HOSTS = new Set(['v10.hidoristream.online', 'hidoristream.online']);
const ANILIST_HOSTS = new Set(['s4.anilist.co']);
const YOUTUBE_HOSTS = new Set(['i.ytimg.com']);

const BROWSER_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

type Upstream = 'animein' | 'nekopoi' | 'hidori' | 'anilist' | 'youtube';

function resolveTarget(raw: string | null): { url: URL; upstream: Upstream } | null {
  if (!raw) return null;
  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return null;
    const host = parsed.hostname.toLowerCase();
    if (ANIMEIN_HOSTS.has(host)) return { url: parsed, upstream: 'animein' };
    if (NEKOPOI_HOSTS.has(host)) return { url: parsed, upstream: 'nekopoi' };
    if (HIDORI_HOSTS.has(host)) return { url: parsed, upstream: 'hidori' };
    if (ANILIST_HOSTS.has(host)) return { url: parsed, upstream: 'anilist' };
    if (YOUTUBE_HOSTS.has(host)) return { url: parsed, upstream: 'youtube' };
    return null;
  } catch {
    return null;
  }
}

function refererFor(upstream: Upstream): string | undefined {
  if (upstream === 'animein') return 'https://animein.net/';
  if (upstream === 'hidori') return 'https://v10.hidoristream.online/';
  return undefined;
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const target = resolveTarget(params.get('u'));
  if (!target) {
    return NextResponse.json({ error: 'Parameter u tidak valid' }, { status: 400 });
  }

  const headers: Record<string, string> = {
    'User-Agent': BROWSER_USER_AGENT,
    Accept: 'image/avif,image/webp,image/*,*/*;q=0.8',
  };
  const referer = refererFor(target.upstream);
  if (referer) headers.Referer = referer;

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
    const width = Number(params.get('w'));
    const format = params.get('f') === 'avif' ? 'avif' : 'webp';
    const quality = Math.min(90, Math.max(40, Number(params.get('q')) || 72));

    if (Number.isFinite(width) && width >= 64) {
      try {
        const resized = await sharp(Buffer.from(body))
          .resize({ width: Math.min(Math.round(width), 1920), withoutEnlargement: true })
          .toFormat(format, { quality })
          .toBuffer();

        return new NextResponse(new Uint8Array(resized), {
          headers: {
            'Content-Type': `image/${format}`,
            'Content-Length': String(resized.byteLength),
            'Cache-Control': 'public, max-age=31536000, s-maxage=31536000, immutable',
          },
        });
      } catch {
        // sharp gagal (format aneh): kirim file asli daripada memecahkan poster.
      }
    }

    return new NextResponse(body, {
      headers: {
        'Content-Type': contentType,
        'Content-Length': String(body.byteLength),
        'Cache-Control': 'public, max-age=31536000, s-maxage=31536000, immutable',
      },
    });
  } catch {
    return fallback(target);
  }
}

function fallback(target: { url: URL; upstream: Upstream }) {
  if (target.upstream === 'nekopoi') {
    return new NextResponse(null, {
      status: 404,
      headers: { 'Cache-Control': 'public, max-age=300' },
    });
  }
  return NextResponse.redirect(target.url.toString(), 302);
}
