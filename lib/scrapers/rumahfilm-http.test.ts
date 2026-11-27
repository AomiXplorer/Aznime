import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildHeaders,
  fetchWithBypass,
  getProfiles,
  parseProxyList,
  profileFromUserAgent,
  readConfig,
  resetBypassState,
  type BypassConfig,
} from './rumahfilm/http';

process.env.RUMAHFILM_RETRY_DELAY_MS = '0';

const BASE = 'https://rumahfilm.net';
const OPTIONS = {
  baseUrl: BASE,
  isChallenge: (html: string) =>
    !html.trim() || html.toLowerCase().includes('attention required! | cloudflare'),
};
const NO_BYPASS: BypassConfig = { proxies: [] };
const BLOCK_HTML = '<title>Attention Required! | Cloudflare</title>';
const OK_HTML = '<html><body><h1>Daftar film</h1></body></html>';

type FetchCall = { url: string; headers: Record<string, string> };

function installFetch(
  handler: (call: FetchCall, n: number) => Response | Promise<Response>
): { calls: FetchCall[]; restore: () => void } {
  const original = globalThis.fetch;
  const calls: FetchCall[] = [];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const call: FetchCall = {
      url: String(input),
      headers: { ...((init?.headers as Record<string, string>) || {}) },
    };
    calls.push(call);
    return handler(call, calls.length);
  }) as typeof fetch;
  return {
    calls,
    restore: () => {
      globalThis.fetch = original;
    },
  };
}

test('profileFromUserAgent menurunkan client hints Chrome yang konsisten dengan UA', () => {
  const android = profileFromUserAgent(
    'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Mobile Safari/537.36'
  );
  assert.match(android.secChUa || '', /v="142"/);
  assert.equal(android.secChUaMobile, '?1');
  assert.equal(android.secChUaPlatform, '"Android"');

  const win = profileFromUserAgent(
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36'
  );
  assert.equal(win.secChUaMobile, '?0');
  assert.equal(win.secChUaPlatform, '"Windows"');

  const firefox = profileFromUserAgent(
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:140.0) Gecko/20100101 Firefox/140.0'
  );
  assert.equal(firefox.secChUa, undefined);
});

test('buildHeaders memuat header navigasi browser dan Sec-Fetch-Site mengikuti Referer', () => {
  const [profile] = getProfiles();
  const first = buildHeaders(profile);
  assert.equal(first['Sec-Fetch-Mode'], 'navigate');
  assert.equal(first['Sec-Fetch-Dest'], 'document');
  assert.equal(first['Sec-Fetch-Site'], 'none');
  assert.equal(first['Upgrade-Insecure-Requests'], '1');
  assert.ok(first['sec-ch-ua']);
  assert.equal(first.Referer, undefined);

  const second = buildHeaders(profile, { referer: `${BASE}/`, cookie: 'a=b' });
  assert.equal(second['Sec-Fetch-Site'], 'same-origin');
  assert.equal(second.Referer, `${BASE}/`);
  assert.equal(second.Cookie, 'a=b');
});

test('getProfiles memakai satu profil bila RUMAHFILM_USER_AGENT diisi, dan tiga profil bila tidak', () => {
  resetBypassState();
  assert.equal(getProfiles().length, 3);
  const custom = getProfiles('Mozilla/5.0 (X11; Linux x86_64) Chrome/150.0.0.0 Safari/537.36');
  assert.equal(custom.length, 1);
  assert.equal(custom[0].secChUaPlatform, '"Linux"');
});

test('parseProxyList menerima daftar http(s) dan membuang entri tidak valid/socks', () => {
  assert.deepEqual(parseProxyList(undefined), []);
  assert.deepEqual(
    parseProxyList('http://user:pass@p1.example:8080, https://p2.example:443 socks5://p3.example:1080 bukan-url'),
    ['http://user:pass@p1.example:8080/', 'https://p2.example/']
  );
});

test('readConfig membaca env dan SCRAPER_PROXY_URL sebagai cadangan', () => {
  const cfg = readConfig({
    RUMAHFILM_USER_AGENT: ' UA-X ',
    RUMAHFILM_COOKIE: 'cf_clearance=abc',
    SCRAPER_PROXY_URL: 'http://p.example:8000',
    RUMAHFILM_RELAY_URL: 'https://relay.example/?u={url}',
  } as NodeJS.ProcessEnv);
  assert.equal(cfg.userAgent, 'UA-X');
  assert.equal(cfg.cookie, 'cf_clearance=abc');
  assert.deepEqual(cfg.proxies, ['http://p.example:8000/']);
  assert.equal(cfg.relay, 'https://relay.example/?u={url}');
  assert.equal(cfg.flaresolverr, undefined);
});

test('permintaan pertama sukses langsung tanpa retry dan membawa header browser', async () => {
  resetBypassState();
  const mock = installFetch(() => new Response(OK_HTML, { status: 200 }));
  try {
    const out = await fetchWithBypass(`${BASE}/movies/`, OPTIONS, NO_BYPASS);
    assert.equal(out.kind, 'ok');
    assert.equal(mock.calls.length, 1);
    assert.equal(mock.calls[0].headers['Sec-Fetch-Mode'], 'navigate');
    assert.match(mock.calls[0].headers['User-Agent'], /Chrome\/\d+/);
  } finally {
    mock.restore();
  }
});

test('403 di percobaan pertama dipulihkan oleh percobaan ulang dengan profil lain + Referer', async () => {
  resetBypassState();
  const mock = installFetch((_call, n) =>
    n === 1
      ? new Response(BLOCK_HTML, { status: 403 })
      : new Response(OK_HTML, { status: 200 })
  );
  try {
    const out = await fetchWithBypass(`${BASE}/movies/`, OPTIONS, NO_BYPASS);
    assert.equal(out.kind, 'ok');

    // call 1 = percobaan awal, call 2 = pemanasan beranda, call 3 = percobaan ulang
    const target = mock.calls.filter((c) => c.url === `${BASE}/movies/`);
    assert.equal(target.length, 2);
    assert.notEqual(target[0].headers['User-Agent'], target[1].headers['User-Agent']);
    assert.equal(target[0].headers.Referer, undefined);
    assert.equal(target[1].headers.Referer, `${BASE}/`);
    assert.ok(mock.calls.some((c) => c.url === `${BASE}/`), 'harus ada kunjungan pemanasan ke beranda');
  } finally {
    mock.restore();
  }
});

test('cookie dari pemanasan dipakai ulang di percobaan berikutnya', async () => {
  resetBypassState();
  const mock = installFetch((call) => {
    if (call.url === `${BASE}/`) {
      const res = new Response(OK_HTML, { status: 200 });
      res.headers.append('set-cookie', '__cf_bm=token123; Path=/; HttpOnly');
      return res;
    }
    // Hanya lolos kalau cookie dari beranda ikut terkirim.
    return (call.headers.Cookie || '').includes('__cf_bm=token123')
      ? new Response(OK_HTML, { status: 200 })
      : new Response(BLOCK_HTML, { status: 403 });
  });
  try {
    // Satu profil saja supaya jar (per profil) dipakai bersama oleh pemanasan dan percobaan ulang.
    const out = await fetchWithBypass(`${BASE}/movies/`, OPTIONS, {
      ...NO_BYPASS,
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/142.0.0.0 Safari/537.36',
    });
    assert.equal(out.kind, 'ok');
  } finally {
    mock.restore();
  }
});

test('404 dikembalikan langsung sebagai notfound tanpa retry', async () => {
  resetBypassState();
  const mock = installFetch(() => new Response('Not Found', { status: 404 }));
  try {
    const out = await fetchWithBypass(`${BASE}/tidak-ada/`, OPTIONS, NO_BYPASS);
    assert.equal(out.kind, 'notfound');
    assert.equal(mock.calls.length, 1);
  } finally {
    mock.restore();
  }
});

test('403 terus-menerus berakhir sebagai blocked setelah semua percobaan', async () => {
  resetBypassState();
  const mock = installFetch(() => new Response(BLOCK_HTML, { status: 403 }));
  try {
    const out = await fetchWithBypass(`${BASE}/movies/`, OPTIONS, NO_BYPASS);
    assert.equal(out.kind, 'blocked');
    assert.equal(out.status, 403);
    assert.equal(mock.calls.filter((c) => c.url === `${BASE}/movies/`).length, 3);
  } finally {
    mock.restore();
  }
});

test('header cf-mitigated: challenge dianggap blokir walau status 200', async () => {
  resetBypassState();
  const mock = installFetch(() => {
    const res = new Response(OK_HTML, { status: 200 });
    res.headers.set('cf-mitigated', 'challenge');
    return res;
  });
  try {
    const out = await fetchWithBypass(`${BASE}/movies/`, OPTIONS, NO_BYPASS);
    assert.equal(out.kind, 'blocked');
  } finally {
    mock.restore();
  }
});

test('cookie dari RUMAHFILM_COOKIE ikut terkirim', async () => {
  resetBypassState();
  const mock = installFetch(() => new Response(OK_HTML, { status: 200 }));
  try {
    await fetchWithBypass(`${BASE}/movies/`, OPTIONS, { ...NO_BYPASS, cookie: 'cf_clearance=xyz' });
    assert.equal(mock.calls[0].headers.Cookie, 'cf_clearance=xyz');
  } finally {
    mock.restore();
  }
});

test('FlareSolverr dipakai setelah percobaan langsung gagal', async () => {
  resetBypassState();
  const mock = installFetch((call) => {
    if (call.url === 'http://solver.local:8191/v1') {
      return Response.json({
        status: 'ok',
        solution: { url: `${BASE}/movies/`, status: 200, response: OK_HTML },
      });
    }
    return new Response(BLOCK_HTML, { status: 403 });
  });
  try {
    const out = await fetchWithBypass(`${BASE}/movies/`, OPTIONS, {
      ...NO_BYPASS,
      flaresolverr: 'http://solver.local:8191',
    });
    assert.equal(out.kind, 'ok');
    assert.equal(out.via, 'flaresolverr');
    assert.equal(out.html, OK_HTML);
  } finally {
    mock.restore();
  }
});

test('relay dipakai bila langsung gagal; {url} diganti URL target ter-encode', async () => {
  resetBypassState();
  const mock = installFetch((call) =>
    call.url.startsWith('https://relay.example/')
      ? new Response(OK_HTML, { status: 200 })
      : new Response(BLOCK_HTML, { status: 403 })
  );
  try {
    const out = await fetchWithBypass(`${BASE}/movies/`, OPTIONS, {
      ...NO_BYPASS,
      relay: 'https://relay.example/fetch?key=K&target={url}',
    });
    assert.equal(out.kind, 'ok');
    assert.equal(out.via, 'relay');
    const relayCall = mock.calls.find((c) => c.url.startsWith('https://relay.example/'));
    assert.equal(
      relayCall?.url,
      `https://relay.example/fetch?key=K&target=${encodeURIComponent(`${BASE}/movies/`)}`
    );
  } finally {
    mock.restore();
  }
});

test('galat jaringan menghasilkan outcome error tanpa melempar', async () => {
  resetBypassState();
  const mock = installFetch(() => {
    throw new Error('ECONNRESET');
  });
  try {
    const out = await fetchWithBypass(`${BASE}/movies/`, OPTIONS, NO_BYPASS);
    assert.equal(out.kind, 'error');
    assert.equal(out.status, 0);
    assert.match(out.error || '', /ECONNRESET/);
  } finally {
    mock.restore();
  }
});
