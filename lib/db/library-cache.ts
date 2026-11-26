import { isRedisConfigured, optionalRedisCommand } from '../auth/redis';

type Snapshot<T> = { version: string; items: T[] };
const MAX_BYTES = 128 * 1024;
const inFlight = new Map<string, Promise<unknown>>();

export async function cachedLibrary<T>(
  key: string,
  ttl: number,
  getVersion: () => Promise<string>,
  load: () => Promise<T[]>,
): Promise<T[]> {
  if (!isRedisConfigured()) return load();
  let cached: Snapshot<T> | undefined;
  try {
    const raw = await optionalRedisCommand<string | null>('GET', key);
    if (raw && Buffer.byteLength(raw) <= MAX_BYTES) cached = JSON.parse(raw) as Snapshot<T>;
  } catch {
    return load();
  }

  // A committed SQL update changes this version, including when Redis DEL fails.
  // Reading it before SQL load makes a concurrent late cache fill harmless.
  const version = await getVersion();
  if (cached?.version === version && Array.isArray(cached.items)) return cached.items;

  const fillKey = key + ':' + version;
  const existing = inFlight.get(fillKey);
  if (existing) return existing as Promise<T[]>;
  const pending = (async () => {
    const items = await load();
    const payload = JSON.stringify({ version, items });
    if (Buffer.byteLength(payload) <= MAX_BYTES) {
      await optionalRedisCommand('SET', key, payload, 'EX', ttl).catch(() => null);
    }
    return items;
  })();
  inFlight.set(fillKey, pending);
  try {
    return await pending;
  } finally {
    inFlight.delete(fillKey);
  }
}

export async function invalidateLibrary(key: string): Promise<void> {
  if (isRedisConfigured()) await optionalRedisCommand('DEL', key).catch(() => null);
}
