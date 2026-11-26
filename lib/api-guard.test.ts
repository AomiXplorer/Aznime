import test from 'node:test';
import assert from 'node:assert/strict';
import { clientIp, isSameOrigin } from '@/lib/auth/http';
import { rateLimitGuard, upstreamFailure } from '@/lib/api-guard';

/**
 * Uji regresi untuk perbaikan keamanan rute publik dan penentuan identitas
 * klien. Tidak ada permintaan jaringan: Redis dan sumber data tidak disentuh.
 */

function requestWith(headers: Record<string, string>, url = 'https://aznime.com/api/search'): Request {
  return new Request(url, { headers });
}

test('clientIp memakai x-real-ip milik platform, bukan entri pertama x-forwarded-for', () => {
  const request = requestWith({
    'x-real-ip': '203.0.113.9',
    'x-forwarded-for': '1.2.3.4, 203.0.113.9',
  });
  assert.equal(clientIp(request), '203.0.113.9');
});

test('clientIp menolak nilai header yang bukan bentuk IP', () => {
  const request = requestWith({
    'x-real-ip': 'bukan-ip-sama-sekali',
    'x-forwarded-for': 'a'.repeat(400),
  });
  assert.equal(clientIp(request), 'unknown');
});

test('clientIp memakai hop terakhir x-forwarded-for bila x-real-ip tidak ada', () => {
  const request = requestWith({ 'x-forwarded-for': '1.2.3.4, 198.51.100.7' });
  assert.equal(clientIp(request), '198.51.100.7');
});

test('clientIp mengabaikan entri sampah di ujung daftar XFF', () => {
  const request = requestWith({ 'x-forwarded-for': '1.2.3.4, 198.51.100.7, <script>' });
  assert.equal(clientIp(request), '198.51.100.7');
});

test('clientIp tidak pernah mengembalikan string kosong', () => {
  assert.equal(clientIp(requestWith({})), 'unknown');
});

test('isSameOrigin menolak origin lintas situs dan menerima origin sendiri', () => {
  const previous = process.env.AUTH_URL;
  process.env.AUTH_URL = 'https://aznime.com';
  try {
    assert.equal(isSameOrigin(requestWith({ origin: 'https://evil.example' })), false);
    assert.equal(isSameOrigin(requestWith({ origin: 'https://aznime.com' })), true);
    // Permintaan tanpa Origin (curl, cron, same-origin GET) tetap diterima.
    assert.equal(isSameOrigin(requestWith({})), true);
  } finally {
    if (previous === undefined) delete process.env.AUTH_URL;
    else process.env.AUTH_URL = previous;
  }
});

test('rateLimitGuard melewatkan permintaan saat Redis belum dikonfigurasi', async () => {
  const previousUrl = process.env.UPSTASH_REDIS_REST_URL;
  const previousToken = process.env.UPSTASH_REDIS_REST_TOKEN;
  delete process.env.UPSTASH_REDIS_REST_URL;
  delete process.env.UPSTASH_REDIS_REST_TOKEN;
  try {
    const response = await rateLimitGuard(requestWith({ 'x-real-ip': '203.0.113.9' }), {
      name: 'uji',
      limit: 1,
      windowSeconds: 60,
    });
    assert.equal(response, null, 'katalog publik tidak boleh ikut mati saat penyimpanan kuota error');
  } finally {
    if (previousUrl !== undefined) process.env.UPSTASH_REDIS_REST_URL = previousUrl;
    if (previousToken !== undefined) process.env.UPSTASH_REDIS_REST_TOKEN = previousToken;
  }
});

test('upstreamFailure tidak meneruskan pesan internal ke klien', async () => {
  const secretish = 'Gagal terhubung ke https://internal-api.example/stream?id=1 token=abc';
  const response = upstreamFailure('uji', new Error(secretish), 'Layanan sedang sibuk.');
  const body = await response.json();

  assert.equal(response.status, 502);
  assert.equal(body.error, 'Layanan sedang sibuk.');
  assert.ok(!JSON.stringify(body).includes('internal-api.example'));
  assert.ok(!JSON.stringify(body).includes('token=abc'));
});

test('upstreamFailure membalas 502 dengan pesan umum untuk error non-Error', async () => {
  const response = upstreamFailure('uji', 'apa saja', 'Layanan sedang sibuk.');
  assert.equal(response.status, 502);
  assert.equal((await response.json()).error, 'Layanan sedang sibuk.');
});

test('rateLimitGuard membalas 429 setelah kuota habis dan tidak melewati batas', async () => {
  const previousUrl = process.env.UPSTASH_REDIS_REST_URL;
  const previousToken = process.env.UPSTASH_REDIS_REST_TOKEN;
  const previousFetch = globalThis.fetch;
  process.env.UPSTASH_REDIS_REST_URL = 'https://redis-uji.example';
  process.env.UPSTASH_REDIS_REST_TOKEN = 'token-uji';

  let counter = 0;
  // Meniru Upstash: skrip counter atomik menaikkan counter.
  globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
    const command = JSON.parse(String(init?.body ?? '[]')) as unknown[];
    if (command[0] === 'EVAL') {
      counter += 1;
      return new Response(JSON.stringify({ result: counter }), { status: 200 });
    }
    return new Response(JSON.stringify({ result: 'OK' }), { status: 200 });
  }) as typeof fetch;

  try {
    const options = { name: 'uji-batas', limit: 2, windowSeconds: 60 };
    const request = requestWith({ 'x-real-ip': '203.0.113.9' });

    assert.equal(await rateLimitGuard(request, options), null);
    assert.equal(await rateLimitGuard(request, options), null);

    const blocked = await rateLimitGuard(request, options);
    assert.ok(blocked, 'permintaan ketiga harus ditolak');
    assert.equal(blocked.status, 429);
    assert.ok(blocked.headers.get('Retry-After'));
    assert.equal((await blocked.json()).error, 'Terlalu banyak permintaan. Coba lagi sebentar lagi.');
  } finally {
    globalThis.fetch = previousFetch;
    if (previousUrl === undefined) delete process.env.UPSTASH_REDIS_REST_URL;
    else process.env.UPSTASH_REDIS_REST_URL = previousUrl;
    if (previousToken === undefined) delete process.env.UPSTASH_REDIS_REST_TOKEN;
    else process.env.UPSTASH_REDIS_REST_TOKEN = previousToken;
  }
});
