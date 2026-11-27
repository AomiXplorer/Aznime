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
const DONGHIVE_HOSTS = new Set(['donghive.vip', 'www.donghive.vip']);
/* Poster dan halaman chapter komik: host utama plus dua mirror resminya.
   thumbnail.komiku.org adalah host sampul yang dipakai daftar dan peringkat. */
const KOMIKU_HOSTS = new Set([
  'img.komiku.org',
  'thumbnail.komiku.org',
  'image1.komiku.to',
  'image2.komiku.to',
  /* Sebagian sampul di daftar komiku.org ditautkan ke Comic Vine, bukan ke
     host sendiri. Tanpa host ini kartunya tampil tanpa gambar. */
  'comicvine.gamespot.com',
]);

/**
 * komiku.org beserta host gambarnya duduk di belakang Cloudflare dan menolak
 * (403) permintaan dari alamat pusat data, termasuk lambda Vercel. Proksi
 * terjemahan Google mengambil berkas yang sama dari alamat Google, jadi sampul
 * tetap tampil. Alamat asli tetap dicoba lebih dulu supaya kualitas dan
 * kecepatannya tidak berubah kalau sumbernya nanti terbuka lagi.
 */
const KOMIKU_PROXY_HOSTS: Record<string, string> = {
  'img.komiku.org': 'img-komiku-org.translate.goog',
  'thumbnail.komiku.org': 'thumbnail-komiku-org.translate.goog',
  'image1.komiku.to': 'image1-komiku-to.translate.goog',
  'image2.komiku.to': 'image2-komiku-to.translate.goog',
};

function komikuProxyUrl(url: URL): URL | null {
  const host = KOMIKU_PROXY_HOSTS[url.hostname.toLowerCase()];
  if (!host) return null;
  const proxied = new URL(url.toString());
  proxied.hostname = host;
  return proxied;
}
/* Sampul webtoon menolak hotlink: 403 tanpa Referer m.webtoons.com. */
const WEBTOON_HOSTS = new Set(['webtoon-phinf.pstatic.net']);
/* Sampul MangaSusuku (bagian /manhwa18). Halaman chapternya TIDAK lewat sini:
   alamat gambar chapter berpindah-pindah CDN, jadi dibaca lewat
   /api/manhwa-page yang mengambil alamatnya dari API sumber. */
const MANGASUSUKU_HOSTS = new Set(['mangasusuku.com', 'www.mangasusuku.com']);
const HIDORI_HOSTS = new Set(['v10.hidoristream.online', 'hidoristream.online']);
const ANILIST_HOSTS = new Set(['s4.anilist.co']);
const YOUTUBE_HOSTS = new Set(['i.ytimg.com']);

const BROWSER_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

type Upstream =
  | 'animein'
  | 'nekopoi'
  | 'donghive'
  | 'hidori'
  | 'anilist'
  | 'youtube'
  | 'komiku'
  | 'webtoon'
  | 'mangasusuku';

function resolveTarget(raw: string | null): { url: URL; upstream: Upstream } | null {
  if (!raw) return null;
  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return null;
    const host = parsed.hostname.toLowerCase();
    if (ANIMEIN_HOSTS.has(host)) return { url: parsed, upstream: 'animein' };
    if (NEKOPOI_HOSTS.has(host)) return { url: parsed, upstream: 'nekopoi' };
    if (DONGHIVE_HOSTS.has(host)) return { url: parsed, upstream: 'donghive' };
    if (KOMIKU_HOSTS.has(host)) return { url: parsed, upstream: 'komiku' };
    if (WEBTOON_HOSTS.has(host)) return { url: parsed, upstream: 'webtoon' };
    if (MANGASUSUKU_HOSTS.has(host)) return { url: parsed, upstream: 'mangasusuku' };
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
  if (upstream === 'donghive') return 'https://donghive.vip/';
  if (upstream === 'hidori') return 'https://v10.hidoristream.online/';
  if (upstream === 'komiku') return 'https://komiku.org/';
  if (upstream === 'webtoon') return 'https://m.webtoons.com/';
  if (upstream === 'mangasusuku') return 'https://mangasusuku.com/';
  return undefined;
}

const CACHE_IMMUTABLE = 'public, max-age=31536000, s-maxage=31536000, immutable';

function parseWidth(params: URLSearchParams): number | null {
  const width = Number(params.get('w'));
  return Number.isFinite(width) && width >= 64 ? Math.min(Math.round(width), 1920) : null;
}

function parseHeight(params: URLSearchParams): number | null {
  const height = Number(params.get('h'));
  return Number.isFinite(height) && height >= 64 ? Math.min(Math.round(height), 1920) : null;
}

/**
 * Sampul komiku bisa diminta sudah dipotong ke ukuran kartu: origin mengerti
 * ?resize=W,H dan memotong bagian tengah (bukan memipihkan gambar). Tanpa
 * parameter itu satu sampul terkirim 1354x1920 atau ~666 KB untuk kotak
 * selebar 110 px, lalu lambda masih harus mengecilkannya sendiri. Dengan
 * parameter yang sama berkasnya turun jadi ~30 KB, jadi satu halaman katalog
 * tidak lagi menarik puluhan megabita.
 *
 * Proksi terjemahan meneruskan kueri apa adanya, jadi jalur cadangan juga
 * mendapat berkas kecil yang sama. Hanya host sampul yang mengerti parameter
 * ini; host halaman chapter tidak disentuh.
 */
function komikuSizedUrl(url: URL, width: number | null, height: number | null): URL {
  if (!width || !height) return url;
  if (url.hostname.toLowerCase() !== 'thumbnail.komiku.org') return url;
  const sized = new URL(url.toString());
  sized.searchParams.set('resize', `${width},${height}`);
  return sized;
}

async function fetchDirect(url: URL, upstream: Upstream, followRedirects = false) {
  const headers: Record<string, string> = {
    'User-Agent': BROWSER_USER_AGENT,
    Accept: 'image/avif,image/webp,image/*,*/*;q=0.8',
  };
  const referer = refererFor(upstream);
  if (referer) headers.Referer = referer;

  return fetch(url.toString(), {
    headers,
    signal: AbortSignal.timeout(8000),
    next: { revalidate: 604800 },
    /* Host yang lolos allowlist tetap bisa mengalihkan ke alamat lain, termasuk
       alamat internal jaringan. Server tidak mengikuti pengalihan itu; 3xx
       dianggap gagal lalu diteruskan ke browser sebagai 302 biasa. Proksi
       terjemahan Google memang mengalihkan sebagian permintaan, jadi hanya
       jalur itu yang boleh mengikuti pengalihan. */
    redirect: followRedirects ? 'follow' : 'manual',
  });
}

/** Balasan yang benar-benar berisi gambar. Halaman penolakan Cloudflare berupa HTML. */
function isImageResponse(response: Response): boolean {
  return response.ok && (response.headers.get('content-type') || '').startsWith('image/');
}

async function fetchUpstream(target: { url: URL; upstream: Upstream }) {
  const direct = await fetchDirect(target.url, target.upstream);
  if (isImageResponse(direct)) return direct;

  const proxied = target.upstream === 'komiku' ? komikuProxyUrl(target.url) : null;
  if (!proxied) return direct;

  const viaProxy = await fetchDirect(proxied, target.upstream, true);
  return isImageResponse(viaProxy) ? viaProxy : direct;
}

async function respondWithImage(
  target: { url: URL; upstream: Upstream },
  params: URLSearchParams,
  allowTitleFallback = true
) {
  try {
    const width = parseWidth(params);
    const height = parseHeight(params);
    const upstream = await fetchUpstream({
      url: target.upstream === 'komiku' ? komikuSizedUrl(target.url, width, height) : target.url,
      upstream: target.upstream,
    });
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
  /* Satu halaman katalog meminta ~60 gambar, dan satu IP operator seluler
     dipakai bersama banyak orang. Batas 300 per menit habis setelah lima
     tampilan halaman, lalu poster berikutnya dijawab 429 dan tampil sebagai
     gambar rusak. 1800 memberi ruang 30 tampilan halaman per menit per IP,
     sementara pemakaian normal tetap jauh di bawahnya. */
  const limited = await rateLimitGuard(request, { name: 'img', limit: 1800, windowSeconds: 60 });
  /* Kuota habis tetap dijawab gambar, bukan JSON: <img> yang menerima JSON
     hanya menampilkan ikon gambar rusak. */
  if (limited) return placeholderPoster(60);

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
function placeholderPoster(maxAgeSeconds = 3600) {
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
      'Cache-Control': `public, max-age=${maxAgeSeconds}, s-maxage=${maxAgeSeconds}`,
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
  if (target.upstream === 'donghive') return placeholderPoster(300);
  /* Host yang memblokir bot tidak akan berubah pikiran dalam beberapa menit,
     jadi kegagalan di-cache sehari: satu percobaan per poster, bukan satu per
     kunjungan. */
  if (hardFailure && target.upstream === 'animein') {
    return new NextResponse(null, {
      status: 404,
      headers: { 'Cache-Control': 'public, max-age=86400, s-maxage=86400' },
    });
  }
  /* komiku hanya bisa diambil server lewat proksi. Pengalihan ke alamat asli
     akan dijawab 403 oleh Cloudflare, jadi kartunya tampil gambar rusak
     setelah menunggu. Placeholder lebih jelas dan ikut di-cache sebentar. */
  if (target.upstream === 'komiku') return placeholderPoster(300);
  return NextResponse.redirect(target.url.toString(), 302);
}
