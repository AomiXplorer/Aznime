import type { PaginationInfo } from '@/lib/scraper/types';
import { deduplicateMovies } from './deduplicate';
import { filterMovies, isAllowedMovie } from './filter';
import { recordFailure, recordSuccess, shouldSkipSource } from './health';
import { normalizeMovie, normalizeMovies } from './normalize';
import { filmSources, getSortedSources } from './registry';
import type {
  FilmSource,
  GetMoviesOptions,
  MovieDetailResult,
  MoviesResult,
  ScrapeResult,
  SourceAttempt,
} from './types';

const DEFAULT_TIMEOUT_MS = 8_000;
const TTL_MS = 10 * 60 * 1000;
/** Hasil dari sumber cadangan disimpan lebih singkat agar sumber utama cepat dipakai lagi. */
const FALLBACK_TTL_MS = 2 * 60 * 1000;
const ERROR_TTL_MS = 60 * 1000;
const CACHE_MAX = 80;

class SourceTimeoutError extends Error {
  constructor(sourceName: string, ms: number) {
    super(`${sourceName} tidak merespons dalam ${ms} ms`);
    this.name = 'SourceTimeoutError';
  }
}

function emptyPagination(page: number): PaginationInfo {
  return {
    currentPage: page,
    totalPages: null,
    hasNextPage: false,
    hasPrevPage: page > 1,
    nextPage: null,
    prevPage: page > 1 ? page - 1 : null,
  };
}

function safePage(page: number | undefined): number {
  return page !== undefined && Number.isFinite(page) && page >= 1 ? Math.trunc(page) : 1;
}

function envTimeout(): number {
  const raw = Number(process.env.FILM_SOURCE_TIMEOUT_MS);
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_TIMEOUT_MS;
}

function resolveTimeout(source: FilmSource, override?: number): number {
  if (override !== undefined && override > 0) return override;
  return source.timeout ?? envTimeout();
}

/** Pesan singkat untuk log/atribut; tidak pernah memuat HTML mentah. */
function briefMessage(err: unknown): string {
  const text = err instanceof Error ? err.message : String(err);
  return text.replace(/\s+/g, ' ').slice(0, 160);
}

async function withTimeout<T>(
  source: FilmSource,
  ms: number,
  run: (signal: AbortSignal) => Promise<T>
): Promise<T> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new SourceTimeoutError(source.name, ms));
    }, ms);
  });
  try {
    return await Promise.race([run(controller.signal), timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

interface SourceRun {
  source: FilmSource;
  movies: ReturnType<typeof normalizeMovies>;
  /** Jumlah film mentah dari adapter, sebelum normalisasi/filter. */
  rawCount: number;
  pagination?: PaginationInfo;
}

function logSource(source: FilmSource, state: string, detail?: string): void {
  const line = `[source] ${source.name}: ${state}${detail ? ` (${detail})` : ''}`;
  if (state === 'success') console.info(line);
  else console.warn(line);
}

/**
 * Jalankan satu sumber dengan error terisolasi: tidak pernah melempar.
 * Hasilnya sudah dinormalisasi dan difilter.
 */
async function runSource(
  source: FilmSource,
  page: number,
  timeoutOverride: number | undefined
): Promise<{ ok: true; run: SourceRun } | { ok: false; attempt: SourceAttempt }> {
  const ms = resolveTimeout(source, timeoutOverride);
  try {
    const result: ScrapeResult = await withTimeout(source, ms, (signal) =>
      source.scrapeMovies({ page, timeout: ms, signal })
    );
    const raw = Array.isArray(result?.movies) ? result.movies : [];
    const movies = filterMovies(normalizeMovies(raw, source));
    return { ok: true, run: { source, movies, rawCount: raw.length, pagination: result?.pagination } };
  } catch (err) {
    const timedOut = err instanceof SourceTimeoutError;
    recordFailure(source.id);
    logSource(source, timedOut ? 'timeout' : 'error', timedOut ? undefined : briefMessage(err));
    return {
      ok: false,
      attempt: {
        sourceId: source.id,
        outcome: timedOut ? 'timeout' : 'error',
        message: briefMessage(err),
      },
    };
  }
}

function mergePagination(page: number, runs: SourceRun[]): PaginationInfo {
  const hasNextPage = runs.some((r) => r.pagination?.hasNextPage);
  const totals = runs
    .map((r) => r.pagination?.totalPages)
    .filter((n): n is number => typeof n === 'number');
  return {
    currentPage: page,
    totalPages: totals.length > 0 ? Math.max(...totals) : null,
    hasNextPage,
    hasPrevPage: page > 1,
    nextPage: hasNextPage ? page + 1 : null,
    prevPage: page > 1 ? page - 1 : null,
  };
}

export interface SourceManager {
  getMovies: (options?: GetMoviesOptions) => Promise<MoviesResult>;
  getMovieDetail: (slug: string, options?: { sourceId?: string; timeout?: number }) => Promise<MovieDetailResult>;
  clearCache: () => void;
}

/**
 * Source Manager: satu-satunya pintu masuk data film untuk UI.
 *
 *   getMovies -> urutkan sumber (priority) -> lewati yang cooldown
 *             -> jalankan dengan timeout + error terisolasi
 *             -> normalisasi -> filter konten -> deduplikasi -> hasil
 *
 * Mode 'fallback' (bawaan): sumber berikutnya hanya dicoba bila sebelumnya
 * gagal/kosong. Mode 'aggregate': semua sumber aktif diambil bersamaan dan
 * digabung.
 *
 * Fungsi ini TIDAK pernah melempar; kegagalan total menjadi hasil
 * { offline: true } sehingga halaman memakai empty/error state yang ada.
 */
export function createSourceManager(
  getSources: () => FilmSource[] = () => filmSources
): SourceManager {
  const cache = new Map<string, { at: number; ttl: number; value: MoviesResult }>();
  const inflight = new Map<string, Promise<MoviesResult>>();

  async function fetchFallback(page: number, timeout?: number): Promise<MoviesResult> {
    const sources = getSortedSources(getSources());
    const attempts: SourceAttempt[] = [];
    let reachedWithoutData = false;

    for (const source of sources) {
      if (shouldSkipSource(source.id)) {
        attempts.push({ sourceId: source.id, outcome: 'skipped', message: 'cooldown' });
        logSource(source, 'skipped', 'cooldown');
        continue;
      }

      const outcome = await runSource(source, page, timeout);
      if (!outcome.ok) {
        attempts.push(outcome.attempt);
        continue;
      }

      const { run } = outcome;
      const items = deduplicateMovies(run.movies);

      if (items.length > 0) {
        recordSuccess(source.id);
        logSource(source, 'success');
        attempts.push({ sourceId: source.id, outcome: 'success' });
        return {
          items,
          pagination: run.pagination ?? emptyPagination(page),
          offline: false,
          usedSources: [source.id],
          attempts,
        };
      }

      // Sumber terjangkau tapi tidak ada data.
      reachedWithoutData = true;
      if (page > 1) {
        // Melewati halaman terakhir adalah akhir katalog yang wajar, bukan
        // kegagalan: jangan menembak sumber cadangan untuk setiap halaman.
        recordSuccess(source.id);
        logSource(source, 'success', 'akhir katalog');
        attempts.push({ sourceId: source.id, outcome: 'success', message: 'akhir katalog' });
        return {
          items: [],
          pagination: { ...(run.pagination ?? emptyPagination(page)), hasNextPage: false, nextPage: null },
          offline: false,
          usedSources: [source.id],
          attempts,
        };
      }

      recordFailure(source.id);
      logSource(source, 'empty');
      attempts.push({ sourceId: source.id, outcome: 'empty' });
    }

    const error = reachedWithoutData
      ? undefined
      : attempts.length > 0
        ? 'Semua sumber film sedang tidak dapat dihubungi.'
        : 'Tidak ada sumber film yang aktif.';
    return {
      items: [],
      pagination: emptyPagination(page),
      offline: !reachedWithoutData,
      ...(error ? { error } : {}),
      usedSources: [],
      attempts,
    };
  }

  async function fetchAggregate(page: number, timeout?: number): Promise<MoviesResult> {
    const sources = getSortedSources(getSources());
    const attempts: SourceAttempt[] = [];
    const active: FilmSource[] = [];

    for (const source of sources) {
      if (shouldSkipSource(source.id)) {
        attempts.push({ sourceId: source.id, outcome: 'skipped', message: 'cooldown' });
        logSource(source, 'skipped', 'cooldown');
      } else {
        active.push(source);
      }
    }

    // runSource tidak pernah menolak, jadi satu sumber gagal tidak mengganggu yang lain.
    const outcomes = await Promise.all(active.map((source) => runSource(source, page, timeout)));

    const runs: SourceRun[] = [];
    for (const outcome of outcomes) {
      if (!outcome.ok) {
        attempts.push(outcome.attempt);
        continue;
      }
      recordSuccess(outcome.run.source.id);
      logSource(outcome.run.source, 'success');
      attempts.push({ sourceId: outcome.run.source.id, outcome: 'success' });
      runs.push(outcome.run);
    }

    if (runs.length === 0) {
      return {
        items: [],
        pagination: emptyPagination(page),
        offline: true,
        error: active.length > 0 ? 'Semua sumber film sedang tidak dapat dihubungi.' : 'Tidak ada sumber film yang aktif.',
        usedSources: [],
        attempts,
      };
    }

    // `runs` mengikuti urutan priority, jadi duplikat dimenangkan sumber utama.
    const items = deduplicateMovies(runs.flatMap((run) => run.movies));
    return {
      items,
      pagination: mergePagination(page, runs),
      offline: false,
      usedSources: runs.map((run) => run.source.id),
      attempts,
    };
  }

  function ttlFor(result: MoviesResult): number {
    if (result.offline) return ERROR_TTL_MS;
    const primary = getSortedSources(getSources())[0];
    return primary && result.usedSources.includes(primary.id) ? TTL_MS : FALLBACK_TTL_MS;
  }

  async function getMovies(options: GetMoviesOptions = {}): Promise<MoviesResult> {
    const page = safePage(options.page);
    const mode = options.mode ?? 'fallback';
    const load = () =>
      mode === 'aggregate' ? fetchAggregate(page, options.timeout) : fetchFallback(page, options.timeout);

    if (options.cache === false) return load();

    const key = `${mode}:${page}`;
    const hit = cache.get(key);
    if (hit && Date.now() - hit.at < hit.ttl) return hit.value;

    const running = inflight.get(key);
    if (running) return running;

    const task = load()
      .then((value) => {
        cache.delete(key);
        if (cache.size >= CACHE_MAX) {
          const oldest = cache.keys().next().value;
          if (oldest) cache.delete(oldest);
        }
        cache.set(key, { at: Date.now(), ttl: ttlFor(value), value });
        return value;
      })
      .finally(() => {
        inflight.delete(key);
      });
    inflight.set(key, task);
    return task;
  }

  async function getMovieDetail(
    slug: string,
    options: { sourceId?: string; timeout?: number } = {}
  ): Promise<MovieDetailResult> {
    const all = getSortedSources(getSources()).filter((s) => typeof s.getMovieDetail === 'function');
    const candidates = options.sourceId ? all.filter((s) => s.id === options.sourceId) : all;
    let lastError: string | undefined;

    for (const source of candidates) {
      if (shouldSkipSource(source.id)) {
        logSource(source, 'skipped', 'cooldown');
        lastError = `${source.name} sedang cooldown.`;
        continue;
      }
      const ms = resolveTimeout(source, options.timeout);
      try {
        const result = await withTimeout(source, ms, (signal) =>
          source.getMovieDetail!(slug, { timeout: ms, signal })
        );

        if (result.notFound) {
          recordSuccess(source.id);
          return { detail: null, offline: false, notFound: true, sourceId: source.id };
        }
        if (result.offline || !result.detail) {
          recordFailure(source.id);
          logSource(source, 'error', result.error ? briefMessage(result.error) : 'detail offline');
          lastError = result.error;
          continue;
        }

        const base = normalizeMovie(result.detail, source);
        if (!base || !isAllowedMovie(base)) {
          return { detail: null, offline: false, notFound: true, sourceId: source.id };
        }
        recordSuccess(source.id);
        logSource(source, 'success');
        return {
          detail: { ...result.detail, ...base },
          offline: false,
          notFound: false,
          sourceId: source.id,
        };
      } catch (err) {
        const timedOut = err instanceof SourceTimeoutError;
        recordFailure(source.id);
        logSource(source, timedOut ? 'timeout' : 'error', timedOut ? undefined : briefMessage(err));
        lastError = briefMessage(err);
      }
    }

    // Sumber yang diminta tidak ada, atau semuanya gagal.
    if (candidates.length === 0) {
      return { detail: null, offline: false, notFound: true };
    }
    return {
      detail: null,
      offline: true,
      notFound: false,
      error: lastError || 'Detail film sedang tidak dapat diambil.',
    };
  }

  return {
    getMovies,
    getMovieDetail,
    clearCache: () => {
      cache.clear();
      inflight.clear();
    },
  };
}
