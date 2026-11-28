import { incrementRateLimit } from './redis';

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
  const count = await incrementRateLimit(key, windowSeconds);
  const allowed = count <= limit;
  return {
    allowed,
    remaining: Math.max(0, limit - count),
    retryAfterSeconds: allowed ? 0 : windowSeconds,
  };
}
