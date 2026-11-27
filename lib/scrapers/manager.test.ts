import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createSourceManager } from './manager';
import { deduplicateMovies } from './deduplicate';
import { normalizeMovie, normalizeTitleKey } from './normalize';
import { getSortedSources } from './registry';
import { getSourceStatus, resetSourceHealth } from './health';
import type { FilmSource, Movie, ScrapeResult } from './types';

process.env.FILM_SOURCE_COOLDOWN_MS = '60000';

function movie(title: string, slug: string, extra: Partial<Movie> = {}): Movie {
  return {
    title,
    slug,
    url: `https://example.test/${slug}/`,
    sourceUrl: `https://example.test/${slug}/`,
    type: 'movie',
    ...extra,
  };
}

function source(
  id: string,
  priority: number,
  scrape: () => Promise<ScrapeResult>,
  timeout?: number
): FilmSource {
  return { id, name: id.toUpperCase(), priority, timeout, scrapeMovies: scrape };
}

const ok = (...movies: Movie[]) => async (): Promise<ScrapeResult> => ({ movies });
const fail = (msg = 'HTTP 500') => async (): Promise<ScrapeResult> => {
  throw new Error(msg);
};
const hang = () => new Promise<ScrapeResult>(() => {});

beforeEach(() => {
  resetSourceHealth();
});

test('Source A HTTP 500, Source B berhasil -> film tetap tampil dari B', async () => {
  const mgr = createSourceManager(() => [
    source('a', 1, fail('HTTP 500')),
    source('b', 2, ok(movie('Dora', 'dora', { year: 2019 }))),
  ]);
  const res = await mgr.getMovies({ cache: false });
  assert.equal(res.offline, false);
  assert.deepEqual(res.usedSources, ['b']);
  assert.equal(res.items[0].title, 'Dora');
  assert.equal(res.items[0].source?.id, 'b');
  assert.deepEqual(res.attempts.map((a) => a.outcome), ['error', 'success']);
});

test('A timeout, B timeout, C berhasil -> C dipakai', async () => {
  const mgr = createSourceManager(() => [
    source('a', 1, hang, 20),
    source('b', 2, hang, 20),
    source('c', 3, ok(movie('Cars', 'cars'))),
  ]);
  const res = await mgr.getMovies({ cache: false });
  assert.deepEqual(res.usedSources, ['c']);
  assert.deepEqual(res.attempts.map((a) => a.outcome), ['timeout', 'timeout', 'success']);
});

test('semua sumber gagal -> offline tanpa melempar', async () => {
  const mgr = createSourceManager(() => [source('a', 1, fail()), source('b', 2, hang, 20)]);
  const res = await mgr.getMovies({ cache: false });
  assert.equal(res.offline, true);
  assert.equal(res.items.length, 0);
  assert.ok(res.error);
});

test('tidak ada sumber terdaftar -> offline tanpa melempar', async () => {
  const mgr = createSourceManager(() => []);
  const res = await mgr.getMovies({ cache: false });
  assert.equal(res.offline, true);
});

test('fallback: sumber cadangan tidak disentuh bila sumber utama berhasil', async () => {
  let bCalls = 0;
  const mgr = createSourceManager(() => [
    source('a', 1, ok(movie('Up', 'up'))),
    source('b', 2, async () => {
      bCalls += 1;
      return { movies: [movie('Cars', 'cars')] };
    }),
  ]);
  const res = await mgr.getMovies({ cache: false });
  assert.deepEqual(res.usedSources, ['a']);
  assert.equal(bCalls, 0);
});

test('priority menentukan urutan, bukan urutan di array', () => {
  const sorted = getSortedSources([
    source('late', 5, ok()),
    source('first', 1, ok()),
    source('mid', 3, ok()),
  ]);
  assert.deepEqual(sorted.map((s) => s.id), ['first', 'mid', 'late']);
});

test('halaman 1 kosong memicu fallback; halaman >1 kosong dianggap akhir katalog', async () => {
  let bCalls = 0;
  const mgr = createSourceManager(() => [
    source('a', 1, ok()),
    source('b', 2, async () => {
      bCalls += 1;
      return { movies: [movie('Cars', 'cars')] };
    }),
  ]);
  const p1 = await mgr.getMovies({ page: 1, cache: false });
  assert.deepEqual(p1.usedSources, ['b']);
  assert.equal(bCalls, 1);

  resetSourceHealth();
  const p2 = await mgr.getMovies({ page: 2, cache: false });
  assert.equal(p2.offline, false);
  assert.equal(p2.items.length, 0);
  assert.equal(p2.pagination.hasNextPage, false);
  assert.equal(bCalls, 1, 'tidak ada request berlebih ke sumber cadangan');
});

test('error satu halaman jatuh ke sumber cadangan untuk halaman itu', async () => {
  const mgr = createSourceManager(() => [
    source('a', 1, async () => {
      throw new Error('HTTP 503');
    }),
    source('b', 2, ok(movie('Page Two', 'page-two'))),
  ]);
  const res = await mgr.getMovies({ page: 2, cache: false });
  assert.deepEqual(res.usedSources, ['b']);
});

test('cooldown: sumber yang berkali-kali gagal dilewati, lalu dicoba lagi setelah cooldown', async () => {
  let aCalls = 0;
  const mgr = createSourceManager(() => [
    source('a', 1, async () => {
      aCalls += 1;
      throw new Error('down');
    }),
    source('b', 2, ok(movie('Up', 'up'))),
  ]);
  for (let i = 0; i < 3; i += 1) await mgr.getMovies({ cache: false });
  assert.equal(aCalls, 3);
  assert.equal(getSourceStatus('a'), 'unavailable');

  const skipped = await mgr.getMovies({ cache: false });
  assert.equal(aCalls, 3, 'A dilewati selama cooldown');
  assert.equal(skipped.attempts[0].outcome, 'skipped');
  assert.deepEqual(skipped.usedSources, ['b']);

  // Cooldown habis -> status degraded -> dicoba lagi.
  assert.equal(getSourceStatus('a', Date.now() + 61_000), 'degraded');
});

test('mode aggregate menggabungkan sumber, mengisolasi error, dan menghapus duplikat', async () => {
  const mgr = createSourceManager(() => [
    source('a', 1, ok(movie('Avatar: The Way of Water', 'avatar-a', { year: 2022 }))),
    source('b', 2, ok(movie('Avatar The Way of Water', 'avatar-b', { year: 2022, poster: 'https://img.test/p.jpg' }), movie('Cars', 'cars'))),
    source('c', 3, fail()),
  ]);
  const res = await mgr.getMovies({ mode: 'aggregate', cache: false });
  assert.equal(res.offline, false);
  assert.deepEqual(res.usedSources, ['a', 'b']);
  assert.equal(res.items.length, 2);
  assert.equal(res.items[0].source?.id, 'a', 'sumber priority tinggi menang');
  assert.equal(res.items[0].poster, 'https://img.test/p.jpg', 'field kosong diisi dari duplikat');
});

test('semua sumber melewati filter konten yang sama', async () => {
  const mgr = createSourceManager(() => [
    source('a', 1, ok(movie('Forbidden Night', 'forbidden-night', { genres: ['Erotic'] }), movie('Dora', 'dora'))),
    source('b', 2, ok(movie('Some Series', 'some', { url: 'https://example.test/series/some/', sourceUrl: 'https://example.test/series/some/' }))),
  ]);
  const res = await mgr.getMovies({ mode: 'aggregate', cache: false });
  assert.deepEqual(res.items.map((m) => m.title), ['Dora']);
});

test('cache manager: request kedua tidak memanggil sumber lagi', async () => {
  let calls = 0;
  const mgr = createSourceManager(() => [
    source('a', 1, async () => {
      calls += 1;
      return { movies: [movie('Up', 'up')] };
    }),
  ]);
  await mgr.getMovies();
  await mgr.getMovies();
  assert.equal(calls, 1);
  mgr.clearCache();
  await mgr.getMovies();
  assert.equal(calls, 2);
});

test('getMovieDetail jatuh ke sumber lain saat sumber utama offline, dan menghormati sourceId', async () => {
  const detailOf = (title: string) => async () => ({
    detail: { ...movie(title, 'x'), synopsis: 's' },
    offline: false,
    notFound: false,
  });
  const a: FilmSource = {
    ...source('a', 1, ok()),
    getMovieDetail: async () => ({ detail: null, offline: true, notFound: false, error: 'down' }),
  };
  const b: FilmSource = { ...source('b', 2, ok()), getMovieDetail: detailOf('Dari B') };
  const mgr = createSourceManager(() => [a, b]);

  const viaFallback = await mgr.getMovieDetail('x');
  assert.equal(viaFallback.detail?.title, 'Dari B');
  assert.equal(viaFallback.sourceId, 'b');

  resetSourceHealth();
  const onlyA = await mgr.getMovieDetail('x', { sourceId: 'a' });
  assert.equal(onlyA.offline, true);

  const unknown = await mgr.getMovieDetail('x', { sourceId: 'zzz' });
  assert.equal(unknown.notFound, true);
});

test('normalizeTitleKey menyamakan variasi judul', () => {
  assert.equal(
    normalizeTitleKey('Avatar: The Way of Water (2022)'),
    normalizeTitleKey('Avatar The Way of Water')
  );
  assert.equal(normalizeTitleKey('Amélie'), normalizeTitleKey('Amelie'));
});

test('deduplicate: ID eksternal > judul+tahun > judul saja', () => {
  const src = (id: string) => ({ id, name: id, url: 'https://x.test' });
  const withSrc = (m: Movie, id: string): Movie => ({ ...m, source: src(id) });

  // 1. ID eksternal yang sama walau judul berbeda.
  const byId = deduplicateMovies([
    withSrc(movie('Judul Indonesia', 'a', { externalIds: { tmdb: '76600' } }), 'a'),
    withSrc(movie('Original Title', 'b', { externalIds: { tmdb: '76600' } }), 'b'),
  ]);
  assert.equal(byId.length, 1);

  // 2. Judul sama, tahun berbeda -> film berbeda (remake).
  const remake = deduplicateMovies([
    withSrc(movie('Dune', 'd1', { year: 1984 }), 'a'),
    withSrc(movie('Dune', 'd2', { year: 2021 }), 'b'),
  ]);
  assert.equal(remake.length, 2);

  // 3. Salah satu tanpa tahun -> dicocokkan lewat judul, dari arah mana pun.
  assert.equal(
    deduplicateMovies([
      withSrc(movie('Cars', 'c1'), 'a'),
      withSrc(movie('Cars', 'c2', { year: 2006 }), 'b'),
    ]).length,
    1
  );
  assert.equal(
    deduplicateMovies([
      withSrc(movie('Cars', 'c2', { year: 2006 }), 'b'),
      withSrc(movie('Cars', 'c1'), 'a'),
    ]).length,
    1
  );

  // URL berbeda tidak dianggap identitas global.
  assert.equal(
    deduplicateMovies([
      withSrc(movie('Up', 'up-a', { year: 2009, url: 'https://a.test/up' }), 'a'),
      withSrc(movie('Up', 'up-b', { year: 2009, url: 'https://b.test/up' }), 'b'),
    ]).length,
    1
  );
});

test('normalizeMovie membuang data tak layak dan mengisi metadata sumber', () => {
  const src = { id: 'a', name: 'A' };
  assert.equal(normalizeMovie(movie('', 'x'), src), null);
  assert.equal(normalizeMovie(movie('X', 'x', { url: 'javascript:alert(1)' }), src), null);
  const m = normalizeMovie(
    movie('  Up  ', 'up', { poster: 'data:image/png;base64,AAA', year: 3000, rating: 99 }),
    src
  );
  assert.equal(m?.title, 'Up');
  assert.equal(m?.poster, undefined);
  assert.equal(m?.year, undefined);
  assert.equal(m?.rating, undefined);
  assert.deepEqual(m?.source, { id: 'a', name: 'A', url: 'https://example.test/up/' });
});
