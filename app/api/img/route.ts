import { NextResponse } from 'next/server';
import sharp from 'sharp';
import { getAniListCover } from '@/lib/anilist';
import { rateLimitGuard } from '@/lib/api-guard';

/**
 * Proksi + resize gambar Aznime.
 *
 * Vercel Image Optimization dibatasi kuota, jadi poster/hero tidak boleh
 * bergantung pada /_next/image. Rute ini mengambil gambar dari host yang
 * diizinkan, lalu (kalau ada `w`) mengecilkan dan mengubahnya ke WebP/AVIF
 * dengan sharp. Hasilnya di-cache immutable di CDN.
 *
 * Dua bentuk permintaan:
 *   ?u=<url gambar>      gambar sumber langsung
 *   ?t=<judul>&a=<alias> poster arsip Malz yang CDN-nya diblokir Cloudflare;
 *                        cover diambil dari AniList berdasarkan judul
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
/* Poster dan halaman chapter komik: host utama plus dua mirror resminya. */
const KOMIKU_HOSTS = new Set(['img.komiku.org', 'image1.komiku.to', 'image2.komiku.to']);
/* Sampul webtoon menolak hotlink: 403 tanpa Referer m.webtoons.com. */
const WEBTOON_HOSTS = new Set(['webtoon-phinf.pstatic.net']);
const HIDORI_HOSTS = new Set(['v10.hidoristream.online', 'hidoristream.online']);
const ANILIST_HOSTS = new Set(['s4.anilist.co']);
const YOUTUBE_HOSTS = new Set(['i.ytimg.com']);

const BROWSER_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

type Upstream = 'animein' | 'nekopoi' | 'hidori' | 'anilist' | 'youtube' | 'komiku' | 'webtoon';

function resolveTarget(raw: string | null): { url: URL; upstream: Upstream } | null {
  if (!raw) return null;
  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return null;
    const host = parsed.hostname.toLowerCase();
    if (ANIMEIN_HOSTS.has(host)) return { url: parsed, upstream: 'animein' };
    if (NEKOPOI_HOSTS.has(host)) return { url: parsed, upstream: 'nekopoi' };
    if (KOMIKU_HOSTS.has(host)) return { url: parsed, upstream: 'komiku' };
    if (WEBTOON_HOSTS.has(host)) return { url: parsed, upstream: 'webtoon' };
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
  if (upstream === 'komiku') return 'https://komiku.org/';
  if (upstream === 'webtoon') return 'https://m.webtoons.com/';
  return undefined;
}

const CACHE_IMMUTABLE = 'public, max-age=31536000, s-maxage=31536000, immutable';

function parseWidth(params: URLSearchParams): number | null {
  const width = Number(params.get('w'));
  return Number.isFinite(width) && width >= 64 ? Math.min(Math.round(width), 1920) : null;
}

async function fetchUpstream(target: { url: URL; upstream: Upstream }) {
  const headers: Record<string, string> = {
    'User-Agent': BROWSER_USER_AGENT,
    Accept: 'image/avif,image/webp,image/*,*/*;q=0.8',
  };
  const referer = refererFor(target.upstream);
  if (referer) headers.Referer = referer;

  return fetch(target.url.toString(), {
    headers,
    signal: AbortSignal.timeout(8000),
    next: { revalidate: 604800 },
    /* Host yang lolos allowlist tetap bisa mengalihkan ke alamat lain, termasuk
       alamat internal jaringan. Server tidak mengikuti pengalihan itu; 3xx
       dianggap gagal lalu diteruskan ke browser sebagai 302 biasa. */
    redirect: 'manual',
  });
}

async function respondWithImage(
  target: { url: URL; upstream: Upstream },
  params: URLSearchParams,
  allowTitleFallback = true
) {
  try {
    const upstream = await fetchUpstream(target);
    const contentType = upstream.headers.get('content-type') || '';
    /* Cloudflare Bot Management membalas halaman HTML untuk host animein.
       Dulu kasus ini dialihkan 302 ke URL sumber, jadi browser mengulang
       perjalanan yang sama dan tetap ditolak: kartu kosong setelah jeda
       panjang. Sekarang kegagalannya dijawab 404 yang di-cache CDN, sehingga
       permintaan berikutnya selesai tanpa menyentuh fungsi. */
    const blockedByEdge =
      Boolean(upstream.headers.get('cf-mitigated')) || contentType.includes('text/html');
    if (!upstream.ok || !contentType.startsWith('image/')) {
      /* Poster Malz membawa judulnya sendiri (parameter t). Kalau CDN sumber
         menolak, cover AniList untuk judul itu dipakai sebagai pengganti, lalu
         hasilnya di-cache CDN di URL yang sama. */
      if (allowTitleFallback && params.has('t')) {
        const cover = await getAniListCover(
          (params.get('t') || '').trim().slice(0, 200),
          (params.get('a') || '').slice(0, 100) || null
        );
        const coverTarget = resolveTarget(cover);
        if (coverTarget) return respondWithImage(coverTarget, params, false);
      }
      return fallback(target, blockedByEdge);
    }

    /* Batas ukuran: proksi gambar tidak boleh dipakai menarik file besar
       berulang kali sampai memori fungsi habis. */
    const MAX_IMAGE_BYTES = 12 * 1024 * 1024;
    const declaredLength = Number(upstream.headers.get('content-length') || 0);
    if (Number.isFinite(declaredLength) && declaredLength > MAX_IMAGE_BYTES) {
      return fallback(target, true);
    }

    const body = await upstream.arrayBuffer();
    if (body.byteLength > MAX_IMAGE_BYTES) return fallback(target, true);
    const width = parseWidth(params);
    const format = params.get('f') === 'avif' ? 'avif' : 'webp';
    const quality = Math.min(90, Math.max(40, Number(params.get('q')) || 72));

    if (width) {
      try {
        const resized = await sharp(Buffer.from(body))
          .resize({ width, withoutEnlargement: true })
          .toFormat(format, { quality })
          .toBuffer();

        return new NextResponse(new Uint8Array(resized), {
          headers: {
            'Content-Type': `image/${format}`,
            'Content-Length': String(resized.byteLength),
            'Cache-Control': CACHE_IMMUTABLE,
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
        'Cache-Control': CACHE_IMMUTABLE,
      },
    });
  } catch {
    return fallback(target, true);
  }
}

/** Poster Malz: cari cover AniList untuk judulnya, lalu sajikan seperti biasa. */
async function serveTitlePoster(params: URLSearchParams) {
  /* Judul dipakai sebagai kueri ke AniList dan kunci cache, jadi panjangnya
     dibatasi seperti parameter lain di rute ini. */
  const title = (params.get('t') || '').trim().slice(0, 200);
  if (!title) return badRequest();

  const cover = await getAniListCover(title, (params.get('a') || '').slice(0, 100) || null);
  if (!cover) return placeholderPoster();

  const target = resolveTarget(cover);
  if (!target) return placeholderPoster();
  return respondWithImage(target, params);
}

export async function GET(request: Request) {
  const limited = await rateLimitGuard(request, { name: 'img', limit: 300, windowSeconds: 60 });
  if (limited) return limited;

  const params = new URL(request.url).searchParams;

  if (params.has('t')) return serveTitlePoster(params);

  const target = resolveTarget(params.get('u'));
  if (!target) return badRequest();

  return respondWithImage(target, params);
}

function badRequest() {
  return NextResponse.json({ error: 'Parameter gambar tidak valid' }, { status: 400 });
}

/**
 * Poster pengganti ketika host sumber menolak dan AniList tidak punya cover.
 *
 * Dulu dijawab 404: kartu tampil kosong dan setiap kartu menulis satu error di
 * konsol. SVG ~500 byte ini membuat kartu tetap rapi, sekali di-cache CDN.
 */
function placeholderPoster() {
  const svg =
    '<svg xmlns="http://www.w3.org/2000/svg" width="340" height="480" viewBox="0 0 340 480" role="img">' +
    '<rect width="340" height="480" fill="#141010"/>' +
    '<rect x="0.5" y="0.5" width="339" height="479" fill="none" stroke="#2a2222"/>' +
    '<circle cx="170" cy="222" r="26" fill="none" stroke="#3d3232" stroke-width="2"/>' +
    '<path d="M160 210 L160 234 L182 222 Z" fill="#3d3232"/>' +
    '<text x="170" y="286" font-family="system-ui,sans-serif" font-size="13" fill="#5a4c4c" text-anchor="middle">Poster belum tersedia</text>' +
    '</svg>';
  return new NextResponse(svg, {
    status: 200,
    headers: {
      'Content-Type': 'image/svg+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=86400',
    },
  });
}

function fallback(target: { url: URL; upstream: Upstream }, hardFailure = false) {
  if (target.upstream === 'nekopoi') {
    return new NextResponse(null, {
      status: 404,
      headers: { 'Cache-Control': 'public, max-age=300' },
    });
  }
  /* Host yang memblokir bot tidak akan berubah pikiran dalam beberapa menit,
     jadi kegagalan di-cache sehari: satu percobaan per poster, bukan satu per
     kunjungan. */
  if (hardFailure && target.upstream === 'animein') {
    return new NextResponse(null, {
      status: 404,
      headers: { 'Cache-Control': 'public, max-age=86400, s-maxage=86400' },
    });
  }
  return NextResponse.redirect(target.url.toString(), 302);
}
