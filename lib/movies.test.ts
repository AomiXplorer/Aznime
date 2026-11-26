import assert from 'node:assert/strict';
import test from 'node:test';
import { getMovie, isMovieSource, moviePath, parseMovieCatalog, parseMovieDetail } from './movies';

test('katalog mengambil film unik dari sumber dan menolak tautan eksternal serta episode', () => {
  const movies = parseMovieCatalog(`
    <article><a href="/movie/contoh/" title="Contoh">
      <img src="data:image/gif;base64,placeholder" data-src="//images.example.com/poster.jpg">
    </a><h2>Contoh (2026)</h2><span class="quality">HD</span></article>
    <article><h2><a href="/movie/contoh/">Duplikat</a></h2></article>
    <article><h2><a href="/movie/serial-episode-5/">Episode 5</a></h2></article>
    <article><h2><a href="https://other.example.com/movie/external/">Eksternal</a></h2></article>
  `, 'kitanonton');
  assert.deepEqual(movies, [{
    source: 'movie', id: '/movie/kitanonton/movie/contoh', href: '/movie/kitanonton/movie/contoh',
    title: 'Contoh (2026)', poster: 'https://images.example.com/poster.jpg', meta: '2026', latest: 'HD',
  }]);
});

test('detail memakai pemutar yang dikenal di HTML dan mengabaikan iframe lain', () => {
  const film = parseMovieDetail(`
    <h1>Contoh</h1><p class="synopsis">Cerita contoh</p>
    <iframe src="https://ads.example.com/"></iframe>
    <div id="player"><iframe data-src="//video.example.com/embed/movie"></iframe></div>
  `, 'rebahin', '/movie/contoh/');
  assert.equal(film?.synopsis, 'Cerita contoh');
  assert.equal(film?.embed, 'https://video.example.com/embed/movie');
  assert.equal(film?.sourceUrl, 'https://rebahinxxi3.mom/movie/contoh/');
});

test('route film hanya dapat meminta path film yang tervalidasi', async (t) => {
  const fetch = t.mock.method(globalThis, 'fetch');
  assert.equal(isMovieSource('__proto__'), false);
  assert.equal(moviePath(['movie', 'contoh-2026']), '/movie/contoh-2026/');
  for (const path of [['movie', '..'], ['movie', 'x/y'], ['movie', 'x?y'], ['https://example.com']]) {
    assert.equal(await getMovie('rebahin', path), null);
  }
  assert.equal(fetch.mock.callCount(), 0);
});
