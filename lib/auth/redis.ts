/**
 * Klien Upstash Redis lewat REST API. Tidak ada koneksi TCP yang dibuka,
 * jadi aman dipakai di Vercel Serverless/Edge tanpa connection pool.
 */
export class RedisError extends Error {
  readonly status: number;
  constructor(message: string, status = 500) {
    super(message);
    this.name = 'RedisError';
    this.status = status;
  }
}

function restUrl(): string {
  return (process.env.UPSTASH_REDIS_REST_URL || '').trim().replace(/\/+$/, '');
}

function restToken(): string {
  return (process.env.UPSTASH_REDIS_REST_TOKEN || '').trim();
}

export function isRedisConfigured(): boolean {
  const raw = restUrl();
  if (!restToken() || !URL.canParse(raw)) return false;
  const url = new URL(raw);
  const local = process.env.VERCEL_ENV !== 'production' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  return (url.protocol === 'https:' || (local && url.protocol === 'http:')) &&
    !url.username && !url.password && url.pathname === '/' && !url.search && !url.hash;
}

async function post<T>(path: string, body: unknown, timeoutMs = 5000): Promise<T> {
  const url = restUrl();
  const token = restToken();
  if (!isRedisConfigured()) throw new RedisError('Redis belum dikonfigurasi', 503);

  let response: Response;
  try {
    response = await fetch(`${url}${path}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      cache: 'no-store',
      /* Tanpa batas waktu, Redis yang menggantung menahan request sampai
         fungsi Vercel kehabisan waktu. 5 detik cukup untuk REST Upstash. */
      signal: AbortSignal.timeout(timeoutMs),
      redirect: 'error',
    });
  } catch {
    throw new RedisError('Tidak bisa menghubungi Redis', 503);
  }

  if (!response.ok) throw new RedisError(`Redis menolak permintaan (${response.status})`, response.status);
  try {
    return (await response.json()) as T;
  } catch {
    throw new RedisError('Balasan Redis tidak bisa dibaca', 502);
  }
}

export async function redisCommand<T = unknown>(...command: (string | number)[]): Promise<T> {
  const data = await post<{ result?: T; error?: string }>('', command);
  if (data.error) throw new RedisError('Redis command failed', 500);
  return data.result as T;
}

export async function redisPipeline<T = unknown>(commands: (string | number)[][]): Promise<T[]> {
  if (commands.length === 0) return [];
  const data = await post<({ result?: T; error?: string })[]>('/pipeline', commands);
  if (!Array.isArray(data)) throw new RedisError('Balasan pipeline Redis tidak valid', 502);
  const failed = data.find((entry) => entry && entry.error);
  if (failed?.error) throw new RedisError('Redis pipeline command failed', 500);
  return data.map((entry) => entry?.result as T);
}

export async function optionalRedisCommand<T = unknown>(...command: (string | number)[]): Promise<T> {
  const data = await post<{ result?: T; error?: string }>('', command, 500);
  if (data.error) throw new RedisError('Redis command failed', 500);
  return data.result as T;
}

export function kvGetDel(key: string): Promise<string | null> {
  return redisCommand<string | null>('GETDEL', key);
}

/* ---------- pembantu bertipe ---------- */

export function kvGet(key: string): Promise<string | null> {
  return redisCommand<string | null>('GET', key);
}

export async function kvSet(key: string, value: string, ttlSeconds?: number): Promise<void> {
  if (ttlSeconds && ttlSeconds > 0) {
    await redisCommand('SET', key, value, 'EX', Math.round(ttlSeconds));
    return;
  }
  await redisCommand('SET', key, value);
}

export async function kvDel(...keys: string[]): Promise<void> {
  if (keys.length === 0) return;
  await redisCommand('DEL', ...keys);
}

export async function kvIncr(key: string): Promise<number> {
  return redisCommand<number>('INCR', key);
}

export async function kvExpire(key: string, ttlSeconds: number): Promise<void> {
  await redisCommand('EXPIRE', key, Math.round(ttlSeconds));
}

export async function hashGetAll(key: string): Promise<Record<string, string>> {
  const flat = await redisCommand<(string | null)[]>('HGETALL', key);
  const result: Record<string, string> = Object.create(null) as Record<string, string>;
  if (!Array.isArray(flat)) return result;
  for (let i = 0; i < flat.length; i += 2) {
    const field = flat[i];
    const value = flat[i + 1];
    if (field === null || field === undefined) continue;
    result[String(field)] = value === null || value === undefined ? '' : String(value);
  }
  return result;
}

export async function hashGet(key: string, field: string): Promise<string | null> {
  return redisCommand<string | null>('HGET', key, field);
}

export async function hashSetMany(key: string, entries: Record<string, string>): Promise<void> {
  const flat: string[] = [];
  for (const [field, value] of Object.entries(entries)) {
    flat.push(field, value);
  }
  if (flat.length === 0) return;
  await redisCommand('HSET', key, ...flat);
}

export async function hashDel(key: string, ...fields: string[]): Promise<void> {
  if (fields.length === 0) return;
  await redisCommand('HDEL', key, ...fields);
}

export async function hashLen(key: string): Promise<number> {
  return redisCommand<number>('HLEN', key);
}

export async function zAdd(key: string, score: number, member: string): Promise<void> {
  await redisCommand('ZADD', key, score, member);
}

export async function zScore(key: string, member: string): Promise<number | null> {
  const raw = await redisCommand<string | number | null>('ZSCORE', key, member);
  if (raw === null || raw === undefined) return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

export async function zRevRange(key: string, start: number, stop: number): Promise<string[]> {
  const raw = await redisCommand<(string | null)[]>('ZREVRANGE', key, start, stop);
  return Array.isArray(raw) ? raw.filter((v): v is string => typeof v === 'string') : [];
}

export async function zRem(key: string, ...members: string[]): Promise<void> {
  if (members.length === 0) return;
  await redisCommand('ZREM', key, ...members);
}

export async function zCard(key: string): Promise<number> {
  return redisCommand<number>('ZCARD', key);
}

export async function setIfAbsent(key: string, value: string): Promise<boolean> {
  const result = await redisCommand<string | null>('SET', key, value, 'NX');
  return result === 'OK';
}
