import { NextResponse } from 'next/server';
import sharp from 'sharp';
import { getDoujinChapter } from '@/lib/mangasusuku';
import { rateLimitGuard } from '@/lib/api-guard';

/**
 * Halaman chapter MangaSusuku untuk pembaca /doujin.
 *
 * Alamat gambar chapter tidak bisa dimasukkan ke allowlist `/api/img`: satu
 * judul bisa memakai CDN berbeda (cdn.uqni.net, wibulep.xyz, cdnfgo.xyz, ...)
 * dan alamatnya berganti kapan saja. Karena itu rute ini tidak menerima URL
 * gambar dari browser, melainkan nomor halaman: alamat aslinya diambil sendiri
 * dari API sumber, jadi rute ini tidak bisa dipakai mengambil host sembarang.
 *
 * Permintaan: ?s=<slug chapter>&i=<indeks halaman>&w=<lebar>
 */

const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

/** Halaman sumber tidak pernah butuh lebih dari 1400 px; di atas itu cuma byte. */
const MIN_WIDTH = 320;
const MAX_WIDTH = 1400;
const DEFAULT_WIDTH = 900;
const MAX_IMAGE_BYTES = 12 * 1024 * 1024;

const CACHE_IMMUTABLE = 'public, max-age=31536000, s-maxage=31536000, immutable';

function parseWidth(raw: string | null): number {
  const value = Number(raw);
  if (!Number.isFinite(value) || value < MIN_WIDTH) return DEFAULT_WIDTH;
  return Math.min(Math.round(value), MAX_WIDTH);
}

function notFound(maxAge = 300) {
  return new NextResponse(null, {
    status: 404,
    headers: { 'Cache-Control': `public, max-age=${maxAge}` },
  });
}

export async function GET(request: Request) {
  /* Satu chapter bisa 30+ halaman, jadi batasnya jauh lebih longgar daripada
     rute lain: 2400 per menit cukup untuk puluhan chapter per IP. */
  const limited = await rateLimitGuard(request, { name: 'doujin-page', limit: 2400, windowSeconds: 60 });
  if (limited) return notFound(60);

  const params = new URL(request.url).searchParams;
  const slug = (params.get('s') || '').trim();
  const index = Number(params.get('i'));

  if (!slug || !Number.isInteger(index) || index < 0 || index > 400) {
    return new NextResponse(null, { status: 400 });
  }

  const chapter = await getDoujinChapter(null, slug);
  const imageUrl = chapter?.images[index];
  if (!imageUrl) return notFound();

  let upstream: Response;
  try {
    upstream = await fetch(imageUrl, {
      headers: {
        'User-Agent': BROWSER_UA,
        Accept: 'image/avif,image/webp,image/*,*/*;q=0.8',
        /* Sebagian CDN sumber menolak permintaan tanpa referer halaman asal. */
        Referer: 'https://mangasusuku.com/',
      },
      signal: AbortSignal.timeout(15000),
      next: { revalidate: 604800 },
    });
  } catch {
    return notFound();
  }

  const contentType = upstream.headers.get('content-type') || '';
  if (!upstream.ok || !contentType.startsWith('image/')) return notFound();

  const declaredLength = Number(upstream.headers.get('content-length') || 0);
  if (Number.isFinite(declaredLength) && declaredLength > MAX_IMAGE_BYTES) return notFound();

  let body: ArrayBuffer;
  try {
    body = await upstream.arrayBuffer();
  } catch {
    return notFound();
  }
  if (body.byteLength === 0 || body.byteLength > MAX_IMAGE_BYTES) return notFound();

  const width = parseWidth(params.get('w'));

  try {
    const resized = await sharp(Buffer.from(body))
      .resize({ width, withoutEnlargement: true })
      .toFormat('webp', { quality: 72 })
      .toBuffer();

    return new NextResponse(new Uint8Array(resized), {
      headers: {
        'Content-Type': 'image/webp',
        'Content-Length': String(resized.byteLength),
        'Cache-Control': CACHE_IMMUTABLE,
      },
    });
  } catch {
    /* sharp gagal (format aneh): kirim berkas aslinya daripada halaman kosong. */
    return new NextResponse(new Uint8Array(body), {
      headers: {
        'Content-Type': contentType,
        'Content-Length': String(body.byteLength),
        'Cache-Control': CACHE_IMMUTABLE,
      },
    });
  }
}
