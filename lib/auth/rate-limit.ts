import { kvExpire, kvIncr } from './redis';

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

/**
 * Fixed window counter. Satu INCR per percobaan, TTL dipasang sekali saat
 * counter pertama dibuat, jadi tidak ada write berlebih ke Redis.
 */
export async function consumeRateLimit(
  bucket: string,
  limit: number,
  windowSeconds: number
): Promise<RateLimitResult> {
  const key = `ratelimit:${bucket}`;
  const count = await kvIncr(key);
  if (count === 1) {
    await kvExpire(key, windowSeconds);
  }
  const allowed = count <= limit;
  return {
    allowed,
    remaining: Math.max(0, limit - count),
    retryAfterSeconds: allowed ? 0 : windowSeconds,
  };
}
