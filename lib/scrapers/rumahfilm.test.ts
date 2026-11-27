import test from 'node:test';
import assert from 'node:assert/strict';
import {
  dedupeMovies,
  parseRumahFilmDetail,
  parseRumahFilmListing,
} from './rumahfilm/parser';
import { isRestrictedMovie } from './rumahfilm/filter';
import { getRumahFilmCatalog, getRumahFilmDetail, getRumahFilmFeed, toAnimeCardItem, toComicCard } from './rumahfilm';

const BASE = 'https://rumahfilm.net';

test('parseRumahFilmListing mengekstrak film umum dan membuang konten dewasa/non-film', () => {
  const html = `
    <html>
      <body>
        <main>
          <section>
            <h2>Movies Terbaru</h2>
            <article class="item movies" id="post-101">
              <div class="poster">
                <img data-src="https://rumahfilm.net/wp-content/uploads/dora.jpg" alt="Dora and the Lost City" />
              </div>
              <div class="data">
                <h3><a href="https://rumahfilm.net/movies/dora-2019/">Dora and the Lost City (2019)</a></h3>
                <span class="year">2019</span>
                <span class="rating">7.1</span>
                <div class="genres"><a href="/genre/adventure/">Adventure</a><a href="/genre/family/">Family</a></div>
              </div>
            </article>
            <article class="item movies" id="post-102">
              <div class="poster"><img src="https://rumahfilm.net/wp-content/uploads/steamy.jpg" /></div>
              <div class="data">
                <h3><a href="https://rumahfilm.net/movies/forbidden-night/">Forbidden Night</a></h3>
                <div class="genres"><a href="/genre/steamy/">Steamy</a><a href="/genre/erotic/">Erotic</a></div>
              </div>
            </article>
            <article class="item" id="post-103">
              <div class="data">
                <h3><a href="https://rumahfilm.net/series/some-series/">Some TV Series</a></h3>
              </div>
            </article>
          </section>
          <section>
            <h2>Steamy</h2>
            <article class="item movies" id="post-104">
              <div class="data">
                <h3><a href="https://rumahfilm.net/movies/hidden-passion/">Hidden Passion</a></h3>
              </div>
            </article>
          </section>
          <section>
            <h2>Series</h2>
            <article class="item" id="post-105">
              <div class="data">
                <h3><a href="https://rumahfilm.net/drama-korea/">Drama Korea</a></h3>
              </div>
            </article>
          </section>
          <nav class="pagination">
            <span class="page-numbers current">1</span>
            <a class="page-numbers" href="/movies/page/2/">2</a>
            <a class="page-numbers" href="/movies/page/5/">5</a>
            <a class="next page-numbers" href="https://rumahfilm.net/movies/page/2/">Next</a>
          </nav>
        </main>
      </body>
    </html>
  `;

  const parsed = parseRumahFilmListing(html, 1, BASE);
  assert.equal(parsed.items.length, 1);
  assert.deepEqual(parsed.items[0], {
    sourceId: '101',
    title: 'Dora and the Lost City',
    slug: 'dora-2019',
    url: '/film/dora-2019',
    sourceUrl: 'https://rumahfilm.net/movies/dora-2019/',
    poster: 'https://rumahfilm.net/wp-content/uploads/dora.jpg',
    year: 2019,
    rating: 7.1,
    genres: ['Adventure', 'Family'],
    type: 'movie',
  });
  assert.equal(parsed.pagination.currentPage, 1);
  assert.equal(parsed.pagination.totalPages, 5);
  assert.equal(parsed.pagination.hasNextPage, true);
  assert.equal(parsed.pagination.nextPage, 2);
});

test('dedupeMovies menjaga film dengan judul sama jika tahun berbeda', () => {
  const deduped = dedupeMovies([
    {
      sourceId: '1',
      title: 'Dune',
      slug: 'dune-1984',
      url: '/film/dune-1984',
      sourceUrl: 'https://rumahfilm.net/movies/dune-1984/',
      year: 1984,
      type: 'movie',
    },
    {
      sourceId: '2',
      title: 'Dune',
      slug: 'dune-2021',
      url: '/film/dune-2021',
      sourceUrl: 'https://rumahfilm.net/movies/dune-2021/',
      year: 2021,
      type: 'movie',
    },
    {
      sourceId: '2',
      title: 'Dune (2021)',
      slug: 'dune-2021-dup',
      url: '/film/dune-2021-dup',
      sourceUrl: 'https://rumahfilm.net/movies/dune-2021-dup/',
      year: 2021,
      type: 'movie',
    },
    {
      sourceId: null,
      title: 'Dune',
      slug: 'dune-2021-other-slug',
      url: '/film/dune-2021-other-slug',
      sourceUrl: 'https://rumahfilm.net/movies/dune-2021-other-slug/',
      year: 2021,
      type: 'movie',
    },
  ]);

  assert.equal(deduped.length, 2);
  assert.deepEqual(
    deduped.map((m) => `${m.title}:${m.year}`),
    ['Dune:1984', 'Dune:2021']
  );
});

test('isRestrictedMovie menyaring kategori dan kata kunci dewasa secara ketat', () => {
  assert.equal(isRestrictedMovie({ title: 'Normal Movie', genres: ['Action', 'Steamy'] }), true);
  assert.equal(isRestrictedMovie({ title: 'Movie', url: 'https://rumahfilm.net/category/erotic/' }), true);
  assert.equal(isRestrictedMovie({ title: 'Movie', ratingLabel: '18+' }), true);
  assert.equal(isRestrictedMovie({ title: 'Essex Boys', genres: ['Crime', 'Drama'] }), false);
});

test('parseRumahFilmDetail mengambil metadata yang ada tanpa mengarang field yang kosong', () => {
  const html = `
    <html>
      <body>
        <article id="post-88">
          <div class="poster"><img src="https://rumahfilm.net/posters/inception.jpg" /></div>
          <h1 class="entry-title">Inception (2010)</h1>
          <div class="sgeneros">
            <a href="/genre/sci-fi/">Sci-Fi</a>
            <a href="/genre/action/">Action</a>
          </div>
          <span itemprop="ratingValue">8.8</span>
          <div class="gmr-moviedata">
            <div><strong>Sutradara:</strong> Christopher Nolan</div>
            <div><strong>Durasi:</strong> 148 min</div>
          </div>
          <div itemprop="description">
            <p>A thief who steals corporate secrets through the use of dream-sharing technology.</p>
          </div>
          <iframe src="https://player.example.com/embed/inception"></iframe>
        </article>
      </body>
    </html>
  `;

  const detail = parseRumahFilmDetail(
    html,
    'inception-2010',
    'https://rumahfilm.net/movies/inception-2010/',
    BASE
  );

  assert.ok(detail);
  assert.equal(detail.title, 'Inception');
  assert.equal(detail.year, 2010);
  assert.equal(detail.rating, 8.8);
  assert.equal(detail.director, 'Christopher Nolan');
  assert.equal(detail.duration, '148 min');
  assert.equal(detail.originalTitle, undefined);
  assert.equal(detail.country, undefined);
  assert.deepEqual(detail.genres, ['Sci-Fi', 'Action']);
  assert.equal(detail.streamUrls?.[0]?.url, 'https://player.example.com/embed/inception');
});

test('parseRumahFilmDetail mengembalikan null jika detail berisi konten dewasa', () => {
  const html = `
    <html>
      <body>
        <article>
          <h1 class="entry-title">Adult Feature</h1>
          <div class="sgeneros"><a href="/genre/erotic/">Erotic</a></div>
        </article>
      </body>
    </html>
  `;
  const detail = parseRumahFilmDetail(
    html,
    'adult-feature',
    'https://rumahfilm.net/movies/adult-feature/',
    BASE
  );
  assert.equal(detail, null);
});

test('toAnimeCardItem memetakan film ke format kartu katalog Aznime', () => {
  const card = toAnimeCardItem({
    sourceId: '50',
    title: 'Spirited Away',
    slug: 'spirited-away',
    url: '/film/spirited-away',
    sourceUrl: 'https://rumahfilm.net/movies/spirited-away/',
    poster: 'https://rumahfilm.net/spirited.jpg',
    year: 2001,
    rating: 8.6,
    genres: ['Animation', 'Fantasy'],
    type: 'movie',
  });

  assert.equal(card.source, 'rumahfilm');
  assert.equal(card.href, '/film/spirited-away');
  assert.equal(card.type, '2001');
  assert.equal(card.status, '★ 8.6');
  assert.equal(card.episode, null);
});

test('getRumahFilmCatalog dan getRumahFilmDetail menangani blokir 403 dan 404 tanpa data palsu', async () => {
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = (async () =>
      new Response('<title>Attention Required! | Cloudflare</title>', {
        status: 403,
        headers: { 'Content-Type': 'text/html' },
      })) as typeof fetch;

    const catalog = await getRumahFilmCatalog(99);
    assert.equal(catalog.offline, true);
    assert.deepEqual(catalog.items, []);

    const blockedDetail = await getRumahFilmDetail('blocked-movie-test');
    assert.equal(blockedDetail.offline, true);
    assert.equal(blockedDetail.notFound, false);
    assert.equal(blockedDetail.detail, null);

    globalThis.fetch = (async () =>
      new Response('Not Found', { status: 404 })) as typeof fetch;

    const missingDetail = await getRumahFilmDetail('missing-movie-test');
    assert.equal(missingDetail.offline, false);
    assert.equal(missingDetail.notFound, true);
    assert.equal(missingDetail.detail, null);

    globalThis.fetch = (async () =>
      new Response('<title>Attention Required! | Cloudflare</title>', {
        status: 403,
        headers: { 'Content-Type': 'text/html' },
      })) as typeof fetch;

    const offlineFeed = await getRumahFilmFeed(14);
    assert.equal(offlineFeed.offline, true);
    assert.deepEqual(offlineFeed.items, []);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('toComicCard memetakan film ke format ComicRow beranda', () => {
  const card = toComicCard({
    sourceId: '55',
    title: 'Your Name',
    slug: 'your-name',
    url: '/film/your-name',
    sourceUrl: 'https://rumahfilm.net/movies/your-name/',
    poster: 'https://rumahfilm.net/your-name.jpg',
    year: 2016,
    rating: 8.4,
    genres: ['Animation', 'Romance'],
    type: 'movie',
  });

  assert.deepEqual(card, {
    id: 'rumahfilm:your-name',
    source: 'rumahfilm',
    title: 'Your Name',
    poster: 'https://rumahfilm.net/your-name.jpg',
    meta: '2016 · Animation',
    latest: '★ 8.4',
    href: '/film/your-name',
  });
});
