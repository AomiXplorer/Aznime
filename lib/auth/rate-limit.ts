import { redisCommand } from './redis';

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

/**
 * Fixed window counter. INCR dan pemasangan TTL dijalankan atomik.
 */
export async function consumeRateLimit(
  bucket: string,
  limit: number,
  windowSeconds: number
): Promise<RateLimitResult> {
  const key = `ratelimit:${bucket}`;
  const count = await redisCommand<number>(
    'EVAL',
    "local n = redis.call('INCR', KEYS[1]); if redis.call('TTL', KEYS[1]) < 0 then redis.call('EXPIRE', KEYS[1], ARGV[1]); end; return n",
    1, key, windowSeconds,
  );
  const allowed = count <= limit;
  return {
    allowed,
    remaining: Math.max(0, limit - count),
    retryAfterSeconds: allowed ? 0 : windowSeconds,
  };
}
