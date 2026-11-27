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

interface MemoryEntry {
  kind: 'string' | 'hash' | 'zset';
  value: string | Map<string, string> | Map<string, number>;
  expiresAt: number | null;
}

const globalForRedis = globalThis as typeof globalThis & {
  __aznimeMemoryRedis?: Map<string, MemoryEntry>;
};

function memoryStore(): Map<string, MemoryEntry> {
  if (!globalForRedis.__aznimeMemoryRedis) {
    globalForRedis.__aznimeMemoryRedis = new Map();
  }
  return globalForRedis.__aznimeMemoryRedis;
}

function getLiveEntry(key: string): MemoryEntry | undefined {
  const store = memoryStore();
  const entry = store.get(key);
  if (!entry) return undefined;
  if (entry.expiresAt !== null && entry.expiresAt <= Date.now()) {
    store.delete(key);
    return undefined;
  }
  return entry;
}

function executeMemoryCommand(command: (string | number)[]): unknown {
  const op = String(command[0] || '').toUpperCase();
  const store = memoryStore();

  switch (op) {
    case 'GET': {
      const entry = getLiveEntry(String(command[1]));
      return entry?.kind === 'string' ? (entry.value as string) : null;
    }
    case 'GETDEL': {
      const key = String(command[1]);
      const entry = getLiveEntry(key);
      store.delete(key);
      return entry?.kind === 'string' ? (entry.value as string) : null;
    }
    case 'SET': {
      const key = String(command[1]);
      const value = String(command[2]);
      let exSeconds: number | null = null;
      let nx = false;
      for (let i = 3; i < command.length; i += 1) {
        const flag = String(command[i]).toUpperCase();
        if (flag === 'EX' && command[i + 1] !== undefined) {
          exSeconds = Number(command[i + 1]);
          i += 1;
        } else if (flag === 'NX') {
          nx = true;
        }
      }
      if (nx && getLiveEntry(key)) return null;
      const expiresAt = exSeconds && exSeconds > 0 ? Date.now() + exSeconds * 1000 : null;
      store.set(key, { kind: 'string', value, expiresAt });
      return 'OK';
    }
    case 'DEL': {
      let deleted = 0;
      for (let i = 1; i < command.length; i += 1) {
        if (store.delete(String(command[i]))) deleted += 1;
      }
      return deleted;
    }
    case 'INCR': {
      const key = String(command[1]);
      const existing = getLiveEntry(key);
      const current = existing?.kind === 'string' ? Number(existing.value) || 0 : 0;
      const next = current + 1;
      store.set(key, { kind: 'string', value: String(next), expiresAt: existing?.expiresAt ?? null });
      return next;
    }
    case 'EXPIRE': {
      const key = String(command[1]);
      const ttl = Number(command[2]);
      const existing = getLiveEntry(key);
      if (!existing) return 0;
      existing.expiresAt = ttl > 0 ? Date.now() + ttl * 1000 : Date.now();
      return 1;
    }
    case 'HGETALL': {
      const entry = getLiveEntry(String(command[1]));
      if (entry?.kind !== 'hash') return [];
      const flat: string[] = [];
      for (const [k, v] of (entry.value as Map<string, string>).entries()) {
        flat.push(k, v);
      }
      return flat;
    }
    case 'HGET': {
      const entry = getLiveEntry(String(command[1]));
      if (entry?.kind !== 'hash') return null;
      return (entry.value as Map<string, string>).get(String(command[2])) ?? null;
    }
    case 'HSET': {
      const key = String(command[1]);
      let entry = getLiveEntry(key);
      if (entry?.kind !== 'hash') {
        entry = { kind: 'hash', value: new Map<string, string>(), expiresAt: null };
        store.set(key, entry);
      }
      const map = entry.value as Map<string, string>;
      let added = 0;
      for (let i = 2; i + 1 < command.length; i += 2) {
        const field = String(command[i]);
        if (!map.has(field)) added += 1;
        map.set(field, String(command[i + 1]));
      }
      return added;
    }
    case 'HDEL': {
      const entry = getLiveEntry(String(command[1]));
      if (entry?.kind !== 'hash') return 0;
      const map = entry.value as Map<string, string>;
      let removed = 0;
      for (let i = 2; i < command.length; i += 1) {
        if (map.delete(String(command[i]))) removed += 1;
      }
      return removed;
    }
    case 'HLEN': {
      const entry = getLiveEntry(String(command[1]));
      return entry?.kind === 'hash' ? (entry.value as Map<string, string>).size : 0;
    }
    case 'ZADD': {
      const key = String(command[1]);
      const score = Number(command[2]);
      const member = String(command[3]);
      let entry = getLiveEntry(key);
      if (entry?.kind !== 'zset') {
        entry = { kind: 'zset', value: new Map<string, number>(), expiresAt: null };
        store.set(key, entry);
      }
      const zset = entry.value as Map<string, number>;
      const isNew = !zset.has(member);
      zset.set(member, score);
      return isNew ? 1 : 0;
    }
    case 'ZSCORE': {
      const entry = getLiveEntry(String(command[1]));
      if (entry?.kind !== 'zset') return null;
      const score = (entry.value as Map<string, number>).get(String(command[2]));
      return score !== undefined ? String(score) : null;
    }
    case 'ZREVRANGE': {
      const entry = getLiveEntry(String(command[1]));
      if (entry?.kind !== 'zset') return [];
      const sorted = [...(entry.value as Map<string, number>).entries()]
        .sort((a, b) => b[1] - a[1] || b[0].localeCompare(a[0]))
        .map(([member]) => member);
      const len = sorted.length;
      if (len === 0) return [];
      let start = Number(command[2]);
      let stop = Number(command[3]);
      if (start < 0) start = Math.max(0, len + start);
      if (stop < 0) stop = len + stop;
      if (start >= len || stop < start) return [];
      return sorted.slice(start, stop + 1);
    }
    case 'ZREM': {
      const entry = getLiveEntry(String(command[1]));
      if (entry?.kind !== 'zset') return 0;
      const zset = entry.value as Map<string, number>;
      let removed = 0;
      for (let i = 2; i < command.length; i += 1) {
        if (zset.delete(String(command[i]))) removed += 1;
      }
      return removed;
    }
    case 'ZCARD': {
      const entry = getLiveEntry(String(command[1]));
      return entry?.kind === 'zset' ? (entry.value as Map<string, number>).size : 0;
    }
    case 'EVAL': {
      // Used by rate-limit.ts: EVAL script 1 key windowSeconds
      const key = String(command[3]);
      const windowSeconds = Number(command[4]);
      const existing = getLiveEntry(key);
      const current = existing?.kind === 'string' ? Number(existing.value) || 0 : 0;
      const next = current + 1;
      const expiresAt =
        existing?.expiresAt ?? (windowSeconds > 0 ? Date.now() + windowSeconds * 1000 : null);
      store.set(key, { kind: 'string', value: String(next), expiresAt });
      return next;
    }
    default:
      return null;
  }
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
  if (!isRedisConfigured()) {
    return executeMemoryCommand(command) as T;
  }
  const data = await post<{ result?: T; error?: string }>('', command);
  if (data.error) throw new RedisError('Redis command failed', 500);
  return data.result as T;
}

export async function redisPipeline<T = unknown>(commands: (string | number)[][]): Promise<T[]> {
  if (commands.length === 0) return [];
  if (!isRedisConfigured()) {
    return commands.map((cmd) => executeMemoryCommand(cmd) as T);
  }
  const data = await post<({ result?: T; error?: string })[]>('/pipeline', commands);
  if (!Array.isArray(data)) throw new RedisError('Balasan pipeline Redis tidak valid', 502);
  const failed = data.find((entry) => entry && entry.error);
  if (failed?.error) throw new RedisError('Redis pipeline command failed', 500);
  return data.map((entry) => entry?.result as T);
}

export async function optionalRedisCommand<T = unknown>(...command: (string | number)[]): Promise<T> {
  if (!isRedisConfigured()) {
    return executeMemoryCommand(command) as T;
  }
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
