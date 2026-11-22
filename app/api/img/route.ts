import { NextResponse } from 'next/server';

const ALLOWED_HOSTS = new Set([
  'api.animein.net',
  'xyz-api.animein.net',
  'animein.net',
  'www.animein.net',
  'animeinweb.com',
  'storages.animein.net',
]);

// Cloudflare di depan animein menolak permintaan tanpa Referer situsnya sendiri.
const BROWSER_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

const UPSTREAM_REFERER = 'https://animein.net/';

function resolveTarget(raw: string | null): URL | null {
  if (!raw) return null;
  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return null;
    if (!ALLOWED_HOSTS.has(parsed.hostname)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  const target = resolveTarget(new URL(request.url).searchParams.get('u'));
  if (!target) {
    return NextResponse.json({ error: 'Parameter u tidak valid' }, { status: 400 });
  }

  try {
    const upstream = await fetch(target.toString(), {
      headers: {
        'User-Agent': BROWSER_USER_AGENT,
        Referer: UPSTREAM_REFERER,
        Accept: 'image/avif,image/webp,image/*,*/*;q=0.8',
      },
      signal: AbortSignal.timeout(8000),
      next: { revalidate: 604800 },
    });

    const contentType = upstream.headers.get('content-type') || '';
    if (!upstream.ok || !contentType.startsWith('image/')) {
      return NextResponse.redirect(target.toString(), 302);
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
    return NextResponse.redirect(target.toString(), 302);
  }
}
