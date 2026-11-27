import type { SourceStatus } from './types';

/**
 * Kesehatan sumber, disimpan di memori instance (tanpa dashboard, tanpa
 * health-check terdistribusi). Cukup untuk memutuskan apakah sebuah sumber
 * dilewati sementara.
 *
 *   1-2 kegagalan beruntun  -> degraded  (tetap dicoba)
 *   3+ kegagalan beruntun   -> unavailable selama cooldown (dilewati)
 *   cooldown habis          -> dicoba lagi; sukses -> healthy, gagal -> cooldown lagi
 */
const FAILURE_THRESHOLD = 3;
const DEFAULT_COOLDOWN_MS = 60_000;

interface HealthRecord {
  failures: number;
  unavailableUntil: number;
}

const records = new Map<string, HealthRecord>();

function cooldownMs(): number {
  const raw = Number(process.env.FILM_SOURCE_COOLDOWN_MS);
  return Number.isFinite(raw) && raw >= 0 ? raw : DEFAULT_COOLDOWN_MS;
}

export function recordSuccess(sourceId: string): void {
  records.delete(sourceId);
}

export function recordFailure(sourceId: string, now = Date.now()): void {
  const prev = records.get(sourceId) ?? { failures: 0, unavailableUntil: 0 };
  const failures = prev.failures + 1;
  records.set(sourceId, {
    failures,
    unavailableUntil: failures >= FAILURE_THRESHOLD ? now + cooldownMs() : 0,
  });
}

export function getSourceStatus(sourceId: string, now = Date.now()): SourceStatus {
  const record = records.get(sourceId);
  if (!record || record.failures === 0) return 'healthy';
  if (record.unavailableUntil > now) return 'unavailable';
  return 'degraded';
}

/** True bila sumber sedang cooldown dan sebaiknya dilewati. */
export function shouldSkipSource(sourceId: string, now = Date.now()): boolean {
  return getSourceStatus(sourceId, now) === 'unavailable';
}

export function resetSourceHealth(): void {
  records.clear();
}
