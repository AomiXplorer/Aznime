import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import https from 'node:https';
import { syncBuiltinESMExports } from 'node:module';
import { test } from 'node:test';
import { requiresTurnstile, verifyTurnstile } from './turnstile';

test('required Turnstile rejects missing configuration, wrong hosts, expired tokens and concurrent reuse', async (t) => {
  const env = {
    TURNSTILE_REQUIRED: '1',
    TURNSTILE_SITE_KEY: '',
    NEXT_PUBLIC_TURNSTILE_SITE_KEY: '',
    TURNSTILE_SECRET_KEY: '',
    TURNSTILE_HOSTNAME: 'staging.aznime.com',
    UPSTASH_REDIS_REST_URL: 'https://test.upstash.io',
    UPSTASH_REDIS_REST_TOKEN: 'test-token',
  };
  const previous = Object.fromEntries(Object.keys(env).map((key) => [key, process.env[key]]));
  Object.assign(process.env, env);
  t.after(() => {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  assert.equal(requiresTurnstile(), true);
  assert.deepEqual(await verifyTurnstile('test'), { ok: false, reason: 'misconfigured' });
  process.env.TURNSTILE_SITE_KEY = 'public-test-site-key';
  process.env.TURNSTILE_SECRET_KEY = 'private-test-secret';
  assert.deepEqual(await verifyTurnstile(''), { ok: false, reason: 'missing-token' });

  let response: unknown = { success: true };
  t.mock.method(https, 'request', (_options: unknown, callback: (stream: EventEmitter) => void) => {
    const request = new EventEmitter();
    return Object.assign(request, {
      write() {},
      end() {
        const stream = Object.assign(new EventEmitter(), { statusCode: 200, setEncoding() {} });
        callback(stream);
        stream.emit('data', JSON.stringify(response));
        stream.emit('end');
      },
    });
  });
  syncBuiltinESMExports();
  t.after(() => {
    t.mock.restoreAll();
    syncBuiltinESMExports();
  });

  assert.deepEqual(await verifyTurnstile('missing-host'), { ok: false, reason: 'invalid' });
  response = { success: true, hostname: 'aznime.com' };
  assert.deepEqual(await verifyTurnstile('wrong-host'), { ok: false, reason: 'invalid' });
  response = { success: false, 'error-codes': ['timeout-or-duplicate'] };
  assert.deepEqual(await verifyTurnstile('expired'), { ok: false, reason: 'expired' });

  response = { success: true, hostname: 'staging.aznime.com' };
  const redis = new Set<string>();
  t.mock.method(globalThis, 'fetch', async (_url: string, options: RequestInit) => {
    const [operation, key, value, mode, expiry, ttl] = JSON.parse(String(options.body));
    assert.match(key, /^turnstile:redeemed:[a-f0-9]{64}$/);
    assert.deepEqual([operation, value, mode, expiry, ttl], ['SET', '1', 'NX', 'EX', 300]);
    if (redis.has(key)) return Response.json({ result: null });
    redis.add(key);
    return Response.json({ result: 'OK' });
  });

  const results = await Promise.all([verifyTurnstile('same-token'), verifyTurnstile('same-token')]);
  assert.equal(results.filter((result) => result.ok).length, 1);
  assert.deepEqual(results.find((result) => !result.ok), { ok: false, reason: 'expired' });
});
