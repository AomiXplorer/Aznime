import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { redisCommand } from '../lib/auth/redis';
import { usesPostgres, usesPostgresHistory } from '../lib/db/config';
import { database } from '../lib/db/supabase';

async function main() {
  if (process.env.AZNIME_RUN_HYBRID_SMOKE !== '1') {
    throw new Error('Set AZNIME_RUN_HYBRID_SMOKE=1 only for disposable test storage.');
  }
  assert(usesPostgresHistory(), 'Enable PostgreSQL history in the disposable app and smoke environment.');
  const origin = new URL(process.env.AZNIME_SMOKE_ORIGIN || 'http://127.0.0.1:3041');
  assert(['127.0.0.1', 'localhost', '[::1]'].includes(origin.hostname), 'Smoke test requires a local AzNime app.');
  assert.equal(await redisCommand('PING'), 'PONG');
  const { error: databaseError } = await database().from('aznime_users').select('id').limit(1);
  assert(!databaseError, 'Service-role connection failed.');

  const anonKey = process.env.SUPABASE_ANON_KEY;
  assert(anonKey, 'Supply the disposable API anon key for the RLS test.');
  const anon = createClient(process.env.SUPABASE_URL!, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  assert((await anon.from('aznime_users').select('id').limit(1)).error, 'Public role read unexpectedly permitted.');
  assert((await anon.rpc('aznime_account_counts', { p_user: randomUUID() })).error, 'Public role RPC unexpectedly permitted.');

  async function request(path: string, method = 'GET', data?: unknown, cookie?: string, ip = '203.0.113.31') {
    return fetch(new URL(path, origin), {
      method, redirect: 'manual',
      headers: {
        origin: origin.origin, 'Content-Type': 'application/json', 'x-real-ip': ip,
        ...(cookie ? { Cookie: cookie } : {}),
      },
      body: data === undefined ? undefined : JSON.stringify(data),
    });
  }

  const password = 'AzNimeTest-' + randomUUID();
  async function register(ip: string) {
    const email = randomUUID() + '@example.test';
    const input = { email, username: 'hybrid-test', password, confirmPassword: password };
    const res = await request('/api/auth/register', 'POST', input, undefined, ip);
    assert.equal(res.status, 201);
    const cookie = res.headers.get('set-cookie')?.split(';')[0];
    assert(cookie);
    const json = await res.json();
    assert.equal(json.user.email, email);
    assert.equal(json.synced, false);
    assert(!Object.hasOwn(json.user, 'passwordHash'));
    return { cookie, email, id: json.user.id as string, input };
  }

  const first = await register('203.0.113.31');
  const second = await register('203.0.113.32');
  assert.equal((await request('/api/history')).status, 401);
  assert.equal((await request('/api/favorites')).status, 401);
  assert.equal((await request('/api/auth/register', 'POST', first.input)).status, 409);

  const favorite = { animeId: 'shared-test', title: 'Sample', poster: null, userId: second.id };
  assert.equal((await request('/api/favorites', 'POST', favorite, first.cookie)).status, 201);
  const one = await (await request('/api/favorites', 'GET', undefined, first.cookie)).json();
  assert.equal(one.items[0].animeId, favorite.animeId);
  assert.equal((await (await request('/api/favorites', 'GET', undefined, second.cookie)).json()).items.length, 0);
  const favKey = `aznime:pg:v1:favorites:${first.id}`;
  const legacyFavKey = `user:${first.id}:favorites`;
  if (usesPostgres()) assert.equal(typeof await redisCommand('GET', favKey), 'string', 'Cache fill missing.');
  else assert.equal(await redisCommand('ZCARD', legacyFavKey), 1);
  assert.deepEqual(await (await request('/api/favorites', 'GET', undefined, first.cookie)).json(), one);
  assert.equal((await request('/api/favorites?animeId=shared-test', 'DELETE', undefined, first.cookie)).status, 200);
  if (usesPostgres()) assert.equal(await redisCommand('GET', favKey), null, 'Cache invalidation missing.');
  else assert.equal(await redisCommand('ZCARD', legacyFavKey), 0);

  const timestamp = Date.now() - 100;
  const writes = await Promise.all(Array.from({ length: 12 }, (_, position) =>
    request('/api/history', 'POST', { ...favorite, updatedAt: timestamp + position, position }, first.cookie)));
  for (const write of writes) assert.equal(write.status, 200);
  const response = await request('/api/history', 'GET', undefined, first.cookie);
  const saved = await response.json();
  assert.deepEqual(Object.keys(saved), ['items']);
  assert.equal(saved.items.length, 1);
  assert.equal(saved.items[0].position, 11);
  const historyKey = `aznime:pg:v1:history:${first.id}`;
  assert.equal(typeof await redisCommand('GET', historyKey), 'string', 'History cache fill missing.');
  assert.deepEqual(await (await request('/api/history', 'GET', undefined, first.cookie)).json(), saved);
  const older = await request('/api/history/sync', 'POST', { items: [{ ...favorite, updatedAt: timestamp, position: 0 }] }, first.cookie);
  assert.deepEqual(await older.json(), { items: saved.items, synced: true });
  const me = await (await request('/api/auth/me', 'GET', undefined, first.cookie)).json();
  assert.deepEqual(me.stats, { history: 1, favorites: 0 });
  assert.equal((await request('/api/history?animeId=shared-test', 'DELETE', undefined, first.cookie)).status, 200);

  assert.equal(await redisCommand('GET', historyKey), null, 'History cache invalidation missing.');

  const login = await request('/api/auth/login', 'POST', { email: first.email, password });
  assert.equal(login.status, 200);
  assert.equal((await request('/api/history', 'GET', undefined, first.cookie)).status, 401, 'Older session survived a new login.');
  const latest = login.headers.get('set-cookie')?.split(';')[0];
  assert(latest);
  assert.equal((await request('/api/auth/logout', 'POST', undefined, latest)).status, 200);
  assert.equal((await request('/api/history', 'GET', undefined, latest)).status, 401);

  console.log('Database access, API authorization and compatibility, CRUD, cache and concurrent progress passed.');
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : 'Hybrid smoke failed.');
  process.exitCode = 1;
});
