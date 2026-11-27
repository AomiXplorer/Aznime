/**
 * Klien HTTP untuk sumber yang dilindungi anti-bot (RumahFilm).
 *
 * Penyebab 403 yang paling umum dari server (Vercel, VPS, dll.):
 *  1. Header terlalu "polos": fetch Node hanya mengirim User-Agent dan Accept,
 *     tanpa Sec-Fetch-*, sec-ch-ua, dan Upgrade-Insecure-Requests seperti
 *     browser sungguhan. User-Agent Chrome 120 yang sudah lama juga mudah
 *     ditandai. Client hints harus cocok dengan User-Agent yang dikirim.
 *  2. Cookie tidak pernah disimpan, jadi cookie sesi/clearance dari kunjungan
 *     pertama hilang di permintaan berikutnya.
 *  3. IP datacenter. Ini yang paling sering jadi akar masalah dan tidak bisa
 *     diselesaikan dengan header saja: butuh proxy (idealnya residensial),
 *     relay, atau FlareSolverr.
 *
 * Urutan eskalasi per permintaan:
 *   a. langsung/proxy dengan profil browser A (tanpa Referer, Sec-Fetch-Site: none)
 *   b. profil browser B + kunjungan "pemanasan" ke beranda + Referer
 *   c. profil browser C, sama seperti (b)
 *   d. FlareSolverr (bila RUMAHFILM_FLARESOLVERR_URL diisi)
 *   e. relay HTTP (bila RUMAHFILM_RELAY_URL diisi)
 *
 * Modul ini sengaja tidak punya import lokal supaya mudah diuji sendiri.
 * Satu-satunya dependensi opsional adalah `undici` (hanya dimuat bila
 * RUMAHFILM_PROXY_URL diisi), karena fetch global Node tidak bisa memakai proxy.
 */

export type OutcomeKind = 'ok' | 'notfound' | 'blocked' | 'error';

export interface FetchOutcome {
  kind: OutcomeKind;
  status: number;
  html: string;
  url: string;
  /** Jalur yang menghasilkan outcome ini, untuk log. */
  via: string;
  /** Pesan galat jaringan (status 0). */
  error?: string;
}

export interface BypassOptions {
  baseUrl: string;
  isChallenge: (html: string) => boolean;
}

export interface BrowserProfile {
  id: string;
  userAgent: string;
  secChUa?: string;
  secChUaMobile?: string;
  secChUaPlatform?: string;
}

const ATTEMPT_TIMEOUT_MS = 12_000;
const TOTAL_BUDGET_MS = 30_000;
const SOLVER_TIMEOUT_MS = 45_000;
const MAX_DIRECT_ATTEMPTS = 3;
const MAX_JARS = 24;
const MAX_COOKIES_PER_JAR = 40;

/* ------------------------------------------------------------------ */
/* Profil browser                                                      */
/* ------------------------------------------------------------------ */

// Perbarui nomor versi ini sesekali agar tidak tertinggal jauh dari Chrome stabil.
const CHROME_MAJOR = '142';

const DEFAULT_USER_AGENTS = [
  `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${CHROME_MAJOR}.0.0.0 Safari/537.36`,
  `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${CHROME_MAJOR}.0.0.0 Safari/537.36`,
  `Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${CHROME_MAJOR}.0.0.0 Mobile Safari/537.36`,
];

/**
 * Bangun profil dari string User-Agent. Untuk Chrome, client hints
 * (sec-ch-ua*) diturunkan dari UA yang sama supaya konsisten. Browser lain
 * (Firefox, Safari, Edge, Opera) tidak mengirim client hints Chrome.
 */
export function profileFromUserAgent(ua: string, id = 'custom'): BrowserProfile {
  const chrome = ua.match(/Chrome\/(\d+)/);
  if (!chrome || /Edg\/|OPR\/|Firefox\//.test(ua)) {
    return { id, userAgent: ua };
  }
  const major = chrome[1];
  const platform = /Android/.test(ua)
    ? 'Android'
    : /Windows/.test(ua)
      ? 'Windows'
      : /Macintosh|Mac OS X/.test(ua)
        ? 'macOS'
        : /Linux|X11/.test(ua)
          ? 'Linux'
          : 'Windows';
  return {
    id,
    userAgent: ua,
    secChUa: `"Chromium";v="${major}", "Google Chrome";v="${major}", "Not_A Brand";v="99"`,
    secChUaMobile: /Mobile|Android/.test(ua) ? '?1' : '?0',
    secChUaPlatform: `"${platform}"`,
  };
}

let stickyStart: number | null = null;

/** Profil untuk dicoba berurutan. Awal urutan acak sekali per proses lalu tetap (stabil). */
export function getProfiles(customUserAgent?: string): BrowserProfile[] {
  const custom = customUserAgent?.trim();
  if (custom) return [profileFromUserAgent(custom)];

  if (stickyStart === null) stickyStart = Math.floor(Math.random() * DEFAULT_USER_AGENTS.length);
  const n = DEFAULT_USER_AGENTS.length;
  return Array.from({ length: n }, (_, i) => {
    const idx = (stickyStart! + i) % n;
    return profileFromUserAgent(DEFAULT_USER_AGENTS[idx], `chrome-${idx}`);
  });
}

export function buildHeaders(
  profile: BrowserProfile,
  opts: { referer?: string; cookie?: string } = {}
): Record<string, string> {
  const headers: Record<string, string> = {
    'User-Agent': profile.userAgent,
    Accept:
      'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
    'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
    'Accept-Encoding': 'gzip, deflate, br',
    'Upgrade-Insecure-Requests': '1',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': opts.referer ? 'same-origin' : 'none',
    'Sec-Fetch-User': '?1',
  };
  if (profile.secChUa) headers['sec-ch-ua'] = profile.secChUa;
  if (profile.secChUaMobile) headers['sec-ch-ua-mobile'] = profile.secChUaMobile;
  if (profile.secChUaPlatform) headers['sec-ch-ua-platform'] = profile.secChUaPlatform;
  if (opts.referer) headers.Referer = opts.referer;
  if (opts.cookie) headers.Cookie = opts.cookie;
  return headers;
}

/* ------------------------------------------------------------------ */
/* Konfigurasi dari env (dibaca saat dipakai, bukan saat import)       */
/* ------------------------------------------------------------------ */

export interface BypassConfig {
  userAgent?: string;
  cookie?: string;
  proxies: string[];
  flaresolverr?: string;
  relay?: string;
}

/** Terima satu atau beberapa URL proxy (dipisah koma/spasi). Hanya http(s). */
export function parseProxyList(raw: string | undefined): string[] {
  if (!raw) return [];
  const out: string[] = [];
  for (const part of raw.split(/[\s,]+/)) {
    const value = part.trim();
    if (!value) continue;
    try {
      const url = new URL(value);
      if (url.protocol === 'http:' || url.protocol === 'https:') out.push(url.toString());
    } catch {
      /* abaikan entri tidak valid */
    }
  }
  return out;
}

export function readConfig(env: NodeJS.ProcessEnv = process.env): BypassConfig {
  return {
    userAgent: env.RUMAHFILM_USER_AGENT?.trim() || undefined,
    cookie: env.RUMAHFILM_COOKIE?.trim() || undefined,
    proxies: parseProxyList(env.RUMAHFILM_PROXY_URL || env.SCRAPER_PROXY_URL),
    flaresolverr: env.RUMAHFILM_FLARESOLVERR_URL?.trim() || undefined,
    relay: env.RUMAHFILM_RELAY_URL?.trim() || undefined,
  };
}

/* ------------------------------------------------------------------ */
/* Cookie jar sederhana (per host + profil + proxy)                    */
/* ------------------------------------------------------------------ */

const jars = new Map<string, Map<string, string>>();

function parseCookieString(raw: string | undefined): Map<string, string> {
  const map = new Map<string, string>();
  if (!raw) return map;
  for (const piece of raw.split(';')) {
    const eq = piece.indexOf('=');
    if (eq <= 0) continue;
    const name = piece.slice(0, eq).trim();
    const value = piece.slice(eq + 1).trim();
    if (name) map.set(name, value);
  }
  return map;
}

function jarKey(host: string, profile: BrowserProfile, proxy: string | null): string {
  return `${host}|${profile.id}|${proxy ? new URL(proxy).host : 'direct'}`;
}

function cookieHeaderFor(key: string, envCookie: string | undefined): string | undefined {
  const merged = parseCookieString(envCookie);
  const jar = jars.get(key);
  if (jar) for (const [k, v] of jar) merged.set(k, v);
  if (merged.size === 0) return undefined;
  return Array.from(merged, ([k, v]) => `${k}=${v}`).join('; ');
}

function absorbCookies(key: string, res: Response): void {
  const headers = res.headers as Headers & { getSetCookie?: () => string[] };
  const list = typeof headers.getSetCookie === 'function' ? headers.getSetCookie() : [];
  if (list.length === 0) return;

  let jar = jars.get(key);
  if (!jar) {
    if (jars.size >= MAX_JARS) {
      const oldest = jars.keys().next().value;
      if (oldest) jars.delete(oldest);
    }
    jar = new Map();
    jars.set(key, jar);
  }

  for (const raw of list) {
    const [pair, ...attrs] = raw.split(';');
    const eq = pair.indexOf('=');
    if (eq <= 0) continue;
    const name = pair.slice(0, eq).trim();
    const value = pair.slice(eq + 1).trim();
    const expired = attrs.some((a) => /^\s*max-age\s*=\s*(0|-\d+)\s*$/i.test(a));
    if (!name) continue;
    if (!value || expired) {
      jar.delete(name);
    } else if (jar.size < MAX_COOKIES_PER_JAR || jar.has(name)) {
      jar.set(name, value);
    }
  }
}

/** Untuk pengujian. */
export function resetBypassState(): void {
  jars.clear();
  dispatchers.clear();
  proxyCursor = 0;
  stickyStart = null;
  warnedMissingUndici = false;
}

/* ------------------------------------------------------------------ */
/* Proxy (butuh paket `undici`, dimuat hanya bila proxy dikonfigurasi) */
/* ------------------------------------------------------------------ */

const dispatchers = new Map<string, unknown>();
let proxyCursor = 0;
let warnedMissingUndici = false;

function nextProxy(proxies: string[]): string | null {
  if (proxies.length === 0) return null;
  const proxy = proxies[proxyCursor % proxies.length];
  proxyCursor += 1;
  return proxy;
}

async function fetchViaProxy(
  proxyUrl: string,
  targetUrl: string,
  headers: Record<string, string>,
  signal: AbortSignal
): Promise<Response | null> {
  let undici: typeof import('undici');
  try {
    undici = await import('undici');
  } catch {
    if (!warnedMissingUndici) {
      warnedMissingUndici = true;
      console.warn(
        '[rumahfilm] RUMAHFILM_PROXY_URL diisi tetapi paket "undici" belum terpasang (jalankan: npm install undici). Memakai koneksi langsung.'
      );
    }
    return null;
  }

  let dispatcher = dispatchers.get(proxyUrl) as InstanceType<typeof undici.ProxyAgent> | undefined;
  if (!dispatcher) {
    dispatcher = new undici.ProxyAgent({ uri: proxyUrl });
    dispatchers.set(proxyUrl, dispatcher);
  }

  const res = await undici.fetch(targetUrl, {
    headers,
    redirect: 'follow',
    signal,
    dispatcher,
  });
  return res as unknown as Response;
}

/* ------------------------------------------------------------------ */
/* Inti                                                                */
/* ------------------------------------------------------------------ */

function sleep(ms: number): Promise<void> {
  return ms > 0 ? new Promise((resolve) => setTimeout(resolve, ms)) : Promise.resolve();
}

function retryDelayMs(): number {
  const raw = Number(process.env.RUMAHFILM_RETRY_DELAY_MS);
  const base = Number.isFinite(raw) && raw >= 0 ? raw : 600;
  return base + Math.random() * base;
}

function classify(
  status: number,
  html: string,
  isChallenge: (html: string) => boolean,
  mitigated = false
): OutcomeKind {
  if (status === 404 || status === 410) return 'notfound';
  if (status === 403 || status === 429 || status >= 500 || mitigated || isChallenge(html)) {
    return 'blocked';
  }
  if (status < 200 || status >= 300) return 'error';
  return 'ok';
}

interface AttemptConfig {
  profile: BrowserProfile;
  proxy: string | null;
  referer: boolean;
}

async function doFetch(
  targetUrl: string,
  headers: Record<string, string>,
  proxy: string | null,
  timeoutMs: number
): Promise<{ res: Response; via: string }> {
  const signal = AbortSignal.timeout(timeoutMs);
  if (proxy) {
    const viaProxy = await fetchViaProxy(proxy, targetUrl, headers, signal);
    if (viaProxy) return { res: viaProxy, via: 'proxy' };
  }
  const res = await fetch(targetUrl, { headers, redirect: 'follow', signal });
  return { res, via: 'direct' };
}

async function attempt(
  targetUrl: string,
  options: BypassOptions,
  cfg: AttemptConfig,
  envCookie: string | undefined,
  timeoutMs: number
): Promise<FetchOutcome> {
  const host = new URL(targetUrl).hostname.toLowerCase();
  const key = jarKey(host, cfg.profile, cfg.proxy);
  const headers = buildHeaders(cfg.profile, {
    referer: cfg.referer ? `${options.baseUrl}/` : undefined,
    cookie: cookieHeaderFor(key, envCookie),
  });

  try {
    const { res, via } = await doFetch(targetUrl, headers, cfg.proxy, timeoutMs);
    absorbCookies(key, res);
    if (res.status === 404 || res.status === 410) {
      await res.body?.cancel();
      return { kind: 'notfound', status: res.status, html: '', url: res.url || targetUrl, via };
    }
    const html = await res.text();
    const mitigated = (res.headers.get('cf-mitigated') || '').toLowerCase() === 'challenge';
    return {
      kind: classify(res.status, html, options.isChallenge, mitigated),
      status: res.status,
      html,
      url: res.url || targetUrl,
      via,
    };
  } catch (err) {
    return {
      kind: 'error',
      status: 0,
      html: '',
      url: targetUrl,
      via: cfg.proxy ? 'proxy' : 'direct',
      error: err instanceof Error ? err.message : 'Gagal menghubungi RumahFilm',
    };
  }
}

/** Kunjungi beranda agar cookie awal (mis. __cf_bm) terpasang sebelum percobaan ulang. */
async function warmUp(
  options: BypassOptions,
  cfg: AttemptConfig,
  envCookie: string | undefined,
  timeoutMs: number
): Promise<void> {
  try {
    const home = `${options.baseUrl}/`;
    const host = new URL(home).hostname.toLowerCase();
    const key = jarKey(host, cfg.profile, cfg.proxy);
    const headers = buildHeaders(cfg.profile, { cookie: cookieHeaderFor(key, envCookie) });
    const { res } = await doFetch(home, headers, cfg.proxy, Math.min(timeoutMs, 8_000));
    absorbCookies(key, res);
    await res.body?.cancel();
  } catch {
    /* pemanasan hanya upaya terbaik */
  }
}

interface SolverJson {
  status?: string;
  solution?: { url?: string; status?: number; response?: string };
}

async function viaFlareSolverr(
  endpoint: string,
  targetUrl: string,
  options: BypassOptions
): Promise<FetchOutcome | null> {
  const api = `${endpoint.replace(/\/+$/, '').replace(/\/v1$/, '')}/v1`;
  try {
    const res = await fetch(api, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cmd: 'request.get', url: targetUrl, maxTimeout: 40_000 }),
      signal: AbortSignal.timeout(SOLVER_TIMEOUT_MS),
    });
    const data = (await res.json()) as SolverJson;
    if (data.status !== 'ok' || !data.solution) return null;
    const html = String(data.solution.response ?? '');
    const status = Number(data.solution.status) || 200;
    return {
      kind: classify(status, html, options.isChallenge),
      status,
      html,
      url: data.solution.url || targetUrl,
      via: 'flaresolverr',
    };
  } catch {
    return null;
  }
}

async function viaRelay(
  template: string,
  targetUrl: string,
  profile: BrowserProfile,
  options: BypassOptions
): Promise<FetchOutcome | null> {
  const encoded = encodeURIComponent(targetUrl);
  const relayUrl = template.includes('{url}')
    ? template.replace('{url}', encoded)
    : `${template}${template.includes('?') ? '&' : '?'}url=${encoded}`;
  try {
    const res = await fetch(relayUrl, {
      headers: { 'User-Agent': profile.userAgent, Accept: 'text/html,*/*;q=0.8' },
      redirect: 'follow',
      signal: AbortSignal.timeout(SOLVER_TIMEOUT_MS),
    });
    if (res.status === 404 || res.status === 410) {
      await res.body?.cancel();
      return { kind: 'notfound', status: res.status, html: '', url: targetUrl, via: 'relay' };
    }
    const html = await res.text();
    return {
      kind: classify(res.status, html, options.isChallenge),
      status: res.status,
      html,
      url: targetUrl,
      via: 'relay',
    };
  } catch {
    return null;
  }
}

const isFinal = (o: FetchOutcome) => o.kind === 'ok' || o.kind === 'notfound';

/**
 * Ambil HTML dari target dengan eskalasi bertahap (lihat komentar modul).
 * Selalu mengembalikan outcome; tidak melempar galat.
 */
export async function fetchWithBypass(
  targetUrl: string,
  options: BypassOptions,
  config: BypassConfig = readConfig()
): Promise<FetchOutcome> {
  const profiles = getProfiles(config.userAgent);
  const deadline = Date.now() + TOTAL_BUDGET_MS;
  let last: FetchOutcome | null = null;

  for (let i = 0; i < MAX_DIRECT_ATTEMPTS; i += 1) {
    const cfg: AttemptConfig = {
      profile: profiles[i % profiles.length],
      proxy: nextProxy(config.proxies),
      referer: i > 0,
    };

    if (i > 0) {
      await sleep(retryDelayMs());
      if (Date.now() >= deadline) break;
      if (last?.kind === 'blocked') {
        await warmUp(options, cfg, config.cookie, deadline - Date.now());
      }
    }

    const remaining = Math.max(1_000, deadline - Date.now());
    last = await attempt(
      targetUrl,
      options,
      cfg,
      config.cookie,
      Math.min(ATTEMPT_TIMEOUT_MS, remaining)
    );
    if (isFinal(last)) return last;
    if (Date.now() >= deadline) break;
  }

  if (config.flaresolverr) {
    const solved = await viaFlareSolverr(config.flaresolverr, targetUrl, options);
    if (solved) {
      if (isFinal(solved)) return solved;
      last = solved;
    }
  }

  if (config.relay) {
    const relayed = await viaRelay(config.relay, targetUrl, profiles[0], options);
    if (relayed) {
      if (isFinal(relayed)) return relayed;
      last = relayed;
    }
  }

  return (
    last ?? {
      kind: 'error',
      status: 0,
      html: '',
      url: targetUrl,
      via: 'direct',
      error: 'Gagal menghubungi RumahFilm',
    }
  );
}
