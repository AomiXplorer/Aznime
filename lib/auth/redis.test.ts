import assert from 'node:assert/strict';
import { test } from 'node:test';
import { incrementRateLimit, optionalRedisCommand, redisCommand, redisPipeline } from './redis';

test('staging Redis prefixes every key and rejects commands outside the application allowlist', async (t) => {
  const settings = {
    AZNIME_STAGING: '1',
    AZNIME_REDIS_KEY_PREFIX: 'aznime:staging:test:',
    UPSTASH_REDIS_REST_URL: 'https://redis.example',
    UPSTASH_REDIS_REST_TOKEN: 'test-token',
  };
  const original = Object.fromEntries(Object.keys(settings).map((key) => [key, process.env[key]]));
  Object.assign(process.env, settings);
  t.after(() => {
    for (const [key, value] of Object.entries(original)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  const requests: unknown[] = [];
  t.mock.method(globalThis, 'fetch', async (url: string, options: RequestInit) => {
    const body: unknown = JSON.parse(String(options.body));
    requests.push(body);
    if (url.endsWith('/pipeline')) return Response.json([{ result: 1 }, { result: 1 }]);
    return Response.json({ result: 1 });
  });
  const prefix = settings.AZNIME_REDIS_KEY_PREFIX;
  await redisCommand('SET', 'user:key', 'value');
  await optionalRedisCommand('GET', 'cache:key');
  await incrementRateLimit('ratelimit:key', 600);
  await redisPipeline([['HSET', 'history:key', 'field', 'value'], ['DEL', 'first', 'second']]);
  await redisCommand('PING');
  assert.deepEqual(requests.slice(0, 2), [['SET', prefix + 'user:key', 'value'], ['GET', prefix + 'cache:key']]);
  const [, rateScript, ...rateArgs] = requests[2] as unknown[];
  assert.match(String(rateScript), /redis\.call\('INCR', KEYS\[1\]\)/);
  assert.deepEqual(rateArgs, [1, prefix + 'ratelimit:key', 600]);
  assert.deepEqual(requests[3], [['HSET', prefix + 'history:key', 'field', 'value'], ['DEL', prefix + 'first', prefix + 'second']]);
  assert.deepEqual(requests[4], ['PING']);

  await assert.rejects(() => redisCommand('SCAN', 0), /unavailable with a staging prefix/);
  await assert.rejects(() => redisCommand('EVAL', 'return 1', 1, 'key'), /unavailable with a staging prefix/);
  await assert.rejects(() => redisPipeline([['SET', 'key', 'value'], ['SCAN', 0]]), /unavailable with a staging prefix/);
  assert.equal(requests.length, 5);

  delete process.env.AZNIME_STAGING;
  await assert.rejects(() => redisCommand('GET', 'prod:key'), /Invalid staging Redis configuration/);
  delete process.env.AZNIME_REDIS_KEY_PREFIX;
  await redisCommand('GET', 'prod:key');
  assert.deepEqual(requests[5], ['GET', 'prod:key']);
});
