import { spawn } from 'node:child_process';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { request } from 'node:http';
import { dirname, join } from 'node:path';
import { setTimeout as wait } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { parseEnv } from 'node:util';

const root = dirname(fileURLToPath(import.meta.url));
const [previewSha] = process.argv.slice(2);
if (previewSha && !/^[0-9a-f]{40}$/.test(previewSha)) throw new Error('Invalid staging SHA');

const stop = new AbortController();
const children = new Set();
const production = join(root, 'production');
const shared = join(production, 'shared');
const stateFile = join(shared, 'cutover-ready.json');

function launch(directory, port, args = []) {
  const child = spawn(process.execPath, [join(directory, 'pterodactyl.mjs'), ...args], {
    cwd: directory,
    env: { ...process.env, SERVER_PORT: String(port) },
    stdio: 'inherit',
  });
  children.add(child);
  const exit = new Promise((resolve) => {
    child.once('error', (error) => resolve({ code: 1, reason: error.code || error.name }));
    child.once('close', (code, signal) => resolve({ code, reason: signal || code }));
  });
  void exit.then(() => children.delete(child));
  return exit;
}

function shutdown() {
  stop.abort();
  for (const child of children) child.kill('SIGTERM');
}

process.once('SIGTERM', shutdown);
process.once('SIGINT', shutdown);

function get(path, host = 'aznime.com') {
  return new Promise((resolve, reject) => {
    const req = request({
      hostname: '127.0.0.1', port: 3543, path, headers: { Host: host },
      signal: AbortSignal.timeout(10_000),
    }, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => resolve({ status: res.statusCode, location: res.headers.location, body, headers: res.headers }));
      res.on('error', reject);
    });
    req.on('error', reject);
    req.end();
  });
}

async function checkDataConnections() {
  const env = parseEnv(await readFile(join(shared, 'runtime.env'), 'utf8'));
  const signal = AbortSignal.timeout(12_000);
  const supabase = new URL('/rest/v1/aznime_library_entries?select=item&limit=0', env.SUPABASE_URL);
  const [redis, history] = await Promise.all([
    fetch(env.UPSTASH_REDIS_REST_URL, {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + env.UPSTASH_REDIS_REST_TOKEN, 'Content-Type': 'application/json' },
      body: '["PING"]', redirect: 'error', signal,
    }),
    fetch(supabase, {
      headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: 'Bearer ' + env.SUPABASE_SERVICE_ROLE_KEY },
      redirect: 'error', signal,
    }),
  ]);
  return { redis: redis.ok && (await redis.json()).result === 'PONG', history: history.ok };
}

async function writeReadiness() {
  while (!stop.signal.aborted) {
    try {
      const health = JSON.parse((await get('/api/health')).body);
      if (health.ok && /^[0-9a-f]{40}$/.test(health.release)) {
        const [home, auth, www, integrations] = await Promise.all([
          get('/'), get('/api/auth/config'), get('/anime?cutover=1', 'www.aznime.com'), checkDataConnections(),
        ]);
        const config = JSON.parse(auth.body);
        const proof = {
          release: health.release,
          homepage: home.status,
          canonical: home.body.includes('<link rel="canonical" href="https://aznime.com"'),
          noindex: Boolean(home.headers['x-robots-tag']),
          auth: { status: auth.status, redis: config.redis, turnstile: config.turnstile, providers: config.providers },
          integrations,
          www: { status: www.status, location: www.location },
          checkedAt: new Date().toISOString(),
        };
        const temporary = stateFile + '.tmp';
        await writeFile(temporary, JSON.stringify(proof) + '\n', { mode: 0o600 });
        await rename(temporary, stateFile);
        if (proof.homepage === 200 && proof.canonical && !proof.noindex && proof.auth.status === 200 &&
          proof.auth.redis && proof.auth.turnstile === 'active' && integrations.redis && integrations.history &&
          proof.www.status === 308 && proof.www.location === 'https://aznime.com/anime?cutover=1') {
          console.log('[production] loopback readiness recorded for ' + health.release);
          return;
        }
      }
    } catch {}
    await wait(2500, undefined, { signal: stop.signal });
  }
}

async function supervisePreview() {
  if (!previewSha) return;
  while (!stop.signal.aborted) {
    const result = await launch(join(root, 'staging-redis'), 3544, ['--preview', previewSha]);
    if (stop.signal.aborted) return;
    console.warn('[staging] stopped (' + result.reason + '), retry in 30s');
    await wait(30_000, undefined, { signal: stop.signal });
  }
}

await mkdir(shared, { recursive: true, mode: 0o700 });
const productionExit = launch(production, 3543);
const preview = supervisePreview().catch((error) => {
  if (!stop.signal.aborted) console.error('[staging] ' + error.name);
});
const readiness = writeReadiness().catch((error) => {
  if (!stop.signal.aborted) console.error('[production] ' + error.name);
});
const result = await productionExit;
if (!stop.signal.aborted) {
  console.error('[production] supervisor exited (' + result.reason + ')');
  process.exitCode = result.code || 1;
}
shutdown();
await Promise.all([preview, readiness]);
