import { spawn } from 'node:child_process';
import { createWriteStream } from 'node:fs';
import { access, mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { setTimeout as wait } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const shared = join(root, 'shared');
const releases = join(root, 'releases');
const repository = join(shared, 'aznime.git');
const remote = 'https://github.com/AomiXplorer/Aznime.git';
const branch = 'refs/heads/main';
const statePath = join(shared, 'release.json');
const commitPattern = /^[0-9a-f]{40}$/;
const interval = 90_000;
const node = process.execPath;
const envFile = join(shared, 'runtime.env');
const [mode, previewSha, extra] = process.argv.slice(2);

if (mode && (mode !== '--preview' || !commitPattern.test(previewSha || '') || extra)) {
  throw new Error('Usage: node pterodactyl.mjs [--preview COMMIT_SHA]');
}

try {
  process.loadEnvFile(envFile);
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}

const {
  AZNIME_BIND_HOST = '127.0.0.1',
  AZNIME_AUTODEPLOY = '0',
  AZNIME_VERIFY_SIGNED_COMMITS = '0',
  AZNIME_TUNNEL_HEALTH_URL,
  CLOUDFLARE_TUNNEL_TOKEN,
  SERVER_PORT = '3543',
} = process.env;
const port = Number(SERVER_PORT);

if (!['127.0.0.1', '0.0.0.0'].includes(AZNIME_BIND_HOST) || !Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error('Invalid AZNIME_BIND_HOST or SERVER_PORT');
}
if (previewSha && AZNIME_BIND_HOST !== '127.0.0.1') {
  throw new Error('Preview requires AZNIME_BIND_HOST=127.0.0.1');
}

const systemEnv = {
  PATH: process.env.PATH,
  HOME: process.env.HOME,
  LANG: process.env.LANG || 'C.UTF-8',
  npm_config_cache: join(shared, 'npm-cache'),
  NEXT_TELEMETRY_DISABLED: '1',
  GIT_TERMINAL_PROMPT: '0',
};
const buildEnv = { ...systemEnv };
if (previewSha) buildEnv.AZNIME_STAGING = '1';
for (const key of [
  'HIDORISTREAM_BASE_URL', 'MALZ_API_BASE_URL', 'MANGASUSUKU_API_BASE_URL',
  'NEKOPOI_API_BASE_URL', 'NEXT_PUBLIC_SITE_URL', 'APP_URL', 'GOOGLE_SITE_VERIFICATION',
]) {
  if (process.env[key] !== undefined) buildEnv[key] = process.env[key];
}
const appEnv = { ...buildEnv, NODE_ENV: 'production' };
if (CLOUDFLARE_TUNNEL_TOKEN && AZNIME_BIND_HOST === '127.0.0.1') appEnv.AZNIME_TRUST_CLOUDFLARE = '1';
for (const key of [
  'UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN', 'AUTH_SECRET', 'AUTH_URL',
  'TURNSTILE_SITE_KEY', 'TURNSTILE_SECRET_KEY', 'TURNSTILE_HOSTNAME',
  'NEXT_PUBLIC_TURNSTILE_SITE_KEY', 'TURNSTILE_REQUIRED',
  'GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'DISCORD_CLIENT_ID', 'DISCORD_CLIENT_SECRET',
  'TELEGRAM_BOT_TOKEN', 'TELEGRAM_WEBHOOK_SECRET', 'TELEGRAM_ADMIN_IDS',
  'MAINTENANCE_BYPASS_SECRET', 'AZNIME_PERSISTENCE', 'AZNIME_HISTORY_PERSISTENCE',
  'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'AZNIME_TRUST_CLOUDFLARE',
]) {
  if (process.env[key] !== undefined) appEnv[key] = process.env[key];
}

const children = new Set();
const shutdown = new AbortController();
let app;
let state = {};

function launch(command, args, { cwd = root, env = systemEnv, stdout = 'inherit' } = {}) {
  const child = spawn(command, args, { cwd, env, detached: true, stdio: ['ignore', stdout, 'inherit'] });
  const result = new Promise((resolve) => {
    child.once('error', (error) => resolve({ error }));
    child.once('close', (code, signal) => resolve({ code, signal }));
  });
  const task = { child, result };
  children.add(task);
  void result.then(() => children.delete(task));
  return task;
}

async function assertSuccess(task, label) {
  const { code, signal, error } = await task.result;
  if (code !== 0) throw new Error(label + ' failed: ' + (error?.code || signal || code));
}

async function run(command, args, options) {
  shutdown.signal.throwIfAborted();
  await assertSuccess(launch(command, args, options), command + ' ' + args[0]);
}

function signalGroup(task, signal) {
  if (!task?.child.pid || !children.has(task)) return;
  try {
    process.kill(-task.child.pid, signal);
  } catch (error) {
    if (error.code !== 'ESRCH') throw error;
  }
}

async function stop(task) {
  if (!task || !children.has(task)) return;
  signalGroup(task, 'SIGTERM');
  const timeout = setTimeout(() => signalGroup(task, 'SIGKILL'), 8000);
  try {
    await task.result;
  } finally {
    clearTimeout(timeout);
  }
}

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.once(signal, () => {
    shutdown.abort();
    for (const task of children) signalGroup(task, 'SIGTERM');
  });
}

async function readState() {
  try {
    const saved = JSON.parse(await readFile(statePath, 'utf8'));
    for (const name of ['current', 'previous', 'failed']) {
      if (saved[name] !== undefined && !commitPattern.test(saved[name])) throw new Error('Invalid release state');
    }
    return saved;
  } catch (error) {
    if (error.code === 'ENOENT') return {};
    throw error;
  }
}

async function saveState(next) {
  const temporary = statePath + '.tmp';
  await writeFile(temporary, JSON.stringify(next) + '\n', { mode: 0o600 });
  await rename(temporary, statePath);
  state = next;
}

async function gitOutput(args) {
  const task = launch('git', ['--git-dir=' + repository, ...args], { stdout: 'pipe' });
  task.child.stdout.setEncoding('utf8');
  let output = '';
  task.child.stdout.on('data', (chunk) => { output += chunk; });
  await assertSuccess(task, 'git ' + args[0]);
  return output.trim();
}

async function fetchRelease(ref = branch) {
  try {
    await access(join(repository, 'HEAD'));
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    await run('git', ['init', '--bare', repository]);
  }
  await run('git', [
    '-c', 'http.lowSpeedLimit=1000', '-c', 'http.lowSpeedTime=45',
    '--git-dir=' + repository, 'fetch', '--quiet', '--no-tags', remote, ref,
  ]);
  const sha = await gitOutput(['rev-parse', 'FETCH_HEAD^{commit}']);
  if (!commitPattern.test(sha)) throw new Error('GitHub returned an invalid commit ID');
  if (previewSha && sha !== previewSha) throw new Error('Preview commit did not match requested SHA');
  if (state.current && sha !== state.current) {
    await gitOutput(['merge-base', '--is-ancestor', state.current, sha]);
  }
  if (AZNIME_VERIFY_SIGNED_COMMITS === '1' && sha !== state.current) await gitOutput(['verify-commit', sha]);
  return sha;
}

async function prepare(sha) {
  const dir = join(releases, sha);
  if (state.current === sha || state.previous === sha) return;
  await rm(dir, { recursive: true, force: true });
  await mkdir(dir, { mode: 0o700 });
  const archivePath = join(dir, 'source.tar');
  try {
    const archive = launch('git', ['--git-dir=' + repository, 'archive', '--format=tar', sha], { stdout: 'pipe' });
    await Promise.all([
      pipeline(archive.child.stdout, createWriteStream(archivePath, { mode: 0o600 })),
      assertSuccess(archive, 'git archive'),
    ]);
    await run('tar', ['-xf', archivePath, '-C', dir]);
    await rm(archivePath);
    await run('npm', ['ci', '--include=dev', '--prefer-offline', '--no-audit', '--no-fund'], { cwd: dir });
    await run('npm', ['test'], { cwd: dir });
    await run('npm', ['run', 'build'], { cwd: dir, env: buildEnv });
  } catch (error) {
    if (!shutdown.signal.aborted) await rm(dir, { recursive: true, force: true });
    throw error;
  }
}

async function probe(url, sha) {
  try {
    const response = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(4_000) });
    if (!response.ok) {
      await response.body?.cancel();
      return false;
    }
    const data = await response.json();
    return data.ok === true && data.release === sha;
  } catch {
    return false;
  }
}

const loopback = 'http://127.0.0.1:' + port + '/api/health';

async function start(sha, { checkTunnel = false } = {}) {
  const dir = join(releases, sha);
  shutdown.signal.throwIfAborted();
  app = launch(node, ['node_modules/next/dist/bin/next', 'start', '-H', AZNIME_BIND_HOST, '-p', String(port)], {
    cwd: dir,
    env: { ...appEnv, AZNIME_RELEASE_SHA: sha },
  });
  for (let attempt = 0; attempt < 30 && children.has(app) && !shutdown.signal.aborted; attempt += 1) {
    if (await probe(loopback, sha) &&
      (!checkTunnel || !AZNIME_TUNNEL_HEALTH_URL || await probe(AZNIME_TUNNEL_HEALTH_URL, sha))) {
      if (children.has(app)) {
        console.log('[deploy] healthy ' + sha);
        return;
      }
    }
    await wait(1000, undefined, { signal: shutdown.signal });
  }
  await stop(app);
  throw new Error('Health check failed for ' + sha);
}

async function deploy(sha, checkTunnel) {
  const old = state.current;
  const older = state.previous;
  const runningBefore = app;
  console.log('[deploy] preparing ' + sha);
  try {
    await prepare(sha);
    await stop(app);
    await start(sha, { checkTunnel });
    await saveState({ current: sha, previous: old });
  } catch (error) {
    if (shutdown.signal.aborted) throw error;
    console.error('[deploy] ' + error.message);
    await saveState({ ...state, failed: sha });
    if (!old) throw error;
    if (app !== runningBefore || !children.has(app)) {
      await stop(app);
      await start(old);
    }
    if (sha !== state.previous) await rm(join(releases, sha), { recursive: true, force: true });
    return;
  }
  if (older && older !== sha && older !== old) await rm(join(releases, older), { recursive: true, force: true });
}

async function superviseTunnel() {
  if (!CLOUDFLARE_TUNNEL_TOKEN) return;
  const binary = join(shared, 'bin', 'cloudflared');
  await access(binary);
  let delay = 5_000;
  while (!shutdown.signal.aborted) {
    const started = Date.now();
    const connector = launch(binary, ['tunnel', '--no-autoupdate', 'run'], {
      env: { ...systemEnv, TUNNEL_TOKEN: CLOUDFLARE_TUNNEL_TOKEN },
    });
    const result = await connector.result;
    if (shutdown.signal.aborted) return;
    if (Date.now() - started > 60_000) delay = 5_000;
    console.error('[tunnel] stopped (' + (result.error?.code || result.signal || result.code) + '), retry in ' + delay / 1000 + 's');
    await wait(delay, undefined, { signal: shutdown.signal });
    delay = Math.min(delay * 2, 60_000);
  }
}

async function main() {
  await mkdir(shared, { recursive: true, mode: 0o700 });
  await mkdir(releases, { recursive: true, mode: 0o700 });
  state = await readState();
  if (previewSha && state.current && state.current !== previewSha) {
    throw new Error('Use a separate directory for each pinned preview');
  }
  if (state.current) {
    try {
      await start(state.current);
    } catch (error) {
      if (!state.previous || shutdown.signal.aborted) throw error;
      await start(state.previous);
      await saveState({ current: state.previous, failed: state.current });
    }
  } else {
    await deploy(await fetchRelease(previewSha), false);
  }

  superviseTunnel().catch((error) => {
    if (!shutdown.signal.aborted) console.error('[tunnel] ' + (error.code || error.name));
  });

  let pollAt = Date.now() + interval;
  let startedAt = Date.now();
  let crashes = 0;
  while (!shutdown.signal.aborted) {
    const exit = await Promise.race([
      app.result,
      wait(2_000, null, { signal: shutdown.signal }),
    ]);
    if (exit) {
      if (shutdown.signal.aborted) return;
      if (Date.now() - startedAt > 120_000) crashes = 0;
      crashes += 1;
      if (crashes >= 3) {
        if (!state.previous) throw new Error('Current release exited repeatedly');
        await start(state.previous);
        await saveState({ current: state.previous, failed: state.current });
        crashes = 0;
      } else {
        await wait(5_000 * crashes, undefined, { signal: shutdown.signal });
        await start(state.current);
      }
      startedAt = Date.now();
      continue;
    }
    if (previewSha || AZNIME_AUTODEPLOY !== '1' || Date.now() < pollAt) continue;
    pollAt = Date.now() + interval;
    try {
      const sha = await fetchRelease();
      if (sha !== state.current && sha !== state.failed) {
        await deploy(sha, true);
        startedAt = Date.now();
        crashes = 0;
      }
    } catch (error) {
      if (!shutdown.signal.aborted) console.error('[deploy] ' + error.message);
    }
  }
}

try {
  await main();
} catch (error) {
  if (!shutdown.signal.aborted) {
    console.error('[aznime] ' + error.message);
    process.exitCode = 1;
  }
} finally {
  shutdown.abort();
  await Promise.all([...children].map(stop));
}
