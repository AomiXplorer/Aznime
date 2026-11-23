import test from 'node:test';
import assert from 'node:assert/strict';
import * as cheerio from 'cheerio';
import {
  UpstreamError,
  decodeMirrorOption,
  extractSlug,
  inferLinkKind,
  looksLikeChallengePage,
  normalizeUrl,
  parseQuickSearchPayload,
  selectPlayableServers,
} from '../scraper';
import {
  parseAnimeCard,
  parseDownloadBoxes,
  parseImgSrc,
  parsePagination,
  resolveAnimeUrl,
  resolvePostUrl,
  validateScraperUrl,
} from './utils';

test('normalizeUrl upgrades protocol-relative and hidoristream http URLs and blocks unsafe protocols', () => {
  assert.equal(normalizeUrl('//cdn.example.com/poster.jpg'), 'https://cdn.example.com/poster.jpg');
  assert.equal(
    normalizeUrl('http://v10.hidoristream.online/wp-content/uploads/a.jpg'),
    'https://v10.hidoristream.online/wp-content/uploads/a.jpg'
  );
  assert.equal(normalizeUrl('javascript:alert(1)'), null);
  assert.equal(normalizeUrl(''), null);
});

test('extractSlug and link resolution handle anime and episode URLs including encoded chars', () => {
  assert.equal(
    extractSlug('https://v10.hidoristream.online/anime/sousou-no-frieren-subtitle-indonesia/'),
    'sousou-no-frieren-subtitle-indonesia'
  );
  assert.equal(
    extractSlug('https://v10.hidoristream.online/keroro-gunsou%e2%98%86-episode-8-subtitle-indonesia/'),
    'keroro-gunsou☆-episode-8-subtitle-indonesia'
  );
  assert.equal(inferLinkKind('https://v10.hidoristream.online/anime/foo/'), 'anime');
  assert.equal(inferLinkKind('https://v10.hidoristream.online/foo-episode-1/'), 'episode');
  assert.equal(
    resolveAnimeUrl('frieren-s2'),
    'https://v10.hidoristream.online/anime/frieren-s2/'
  );
  assert.equal(
    resolvePostUrl('frieren-episode-1'),
    'https://v10.hidoristream.online/frieren-episode-1/'
  );
});

test('scraper request URLs stay on the configured upstream host and port', () => {
  const base = 'https://v10.hidoristream.online';
  assert.equal(validateScraperUrl('/anime/frieren/', base), `${base}/anime/frieren/`);
  assert.throws(() => validateScraperUrl('https://127.0.0.1/private', base), UpstreamError);
  assert.throws(() => validateScraperUrl('https://attacker.example/', base), UpstreamError);
  assert.throws(() => validateScraperUrl('https://v10.hidoristream.online:8443/', base), UpstreamError);
  assert.throws(() => validateScraperUrl('https://user@v10.hidoristream.online/', base), UpstreamError);
});

test('parseImgSrc skips SVG base64 placeholders and falls back to noscript', () => {
  const $ = cheerio.load(`
    <div class="thumb">
      <img src="data:image/svg+xml;base64,PHN2Zz4=" data-src="https://v10.hidoristream.online/poster.jpg" />
    </div>
    <div class="fallback">
      <img src="data:image/svg+xml;base64,PHN2Zz4=" />
      <noscript><img src="https://v10.hidoristream.online/ns.jpg" /></noscript>
    </div>
  `);
  assert.equal(parseImgSrc($, '.thumb'), 'https://v10.hidoristream.online/poster.jpg');
  assert.equal(parseImgSrc($, '.fallback'), 'https://v10.hidoristream.online/ns.jpg');
});

test('parseAnimeCard extracts card fields accurately', () => {
  const $ = cheerio.load(`
    <article>
      <div class="bsx">
        <a href="https://v10.hidoristream.online/frieren-episode-12/" title="Frieren Episode 12" rel="20110">
          <div class="limit">
            <img data-src="https://v10.hidoristream.online/img.jpg" />
            <div class="typez">TV</div>
            <div class="bt"><span class="epx">Ep 12</span><span class="sb">Sub</span></div>
            <span class="hotbadge">HOT</span>
          </div>
          <div class="tt">Frieren<span>Ep 12</span></div>
        </a>
      </div>
    </article>
  `);
  const card = parseAnimeCard($, $('article').get(0)!);
  assert.equal(card.postId, '20110');
  assert.equal(card.title, 'Frieren Episode 12');
  assert.equal(card.seriesTitle, 'Frieren');
  assert.equal(card.kind, 'episode');
  assert.equal(card.episodeNumber, 12);
  assert.equal(card.type, 'TV');
  assert.equal(card.sub, 'Sub');
  assert.equal(card.isHot, true);
});

test('parsePagination detects next/prev pages and totalPages', () => {
  const $ = cheerio.load(`
    <div class="pagination">
      <a class="prev page-numbers" href="https://v10.hidoristream.online/anime/?page=1">Prev</a>
      <span class="page-numbers current">2</span>
      <a class="page-numbers" href="https://v10.hidoristream.online/anime/?page=12">12</a>
      <a class="next page-numbers" href="https://v10.hidoristream.online/anime/?page=3">Next</a>
    </div>
  `);
  const p = parsePagination($, 2);
  assert.equal(p.currentPage, 2);
  assert.equal(p.hasNextPage, true);
  assert.equal(p.hasPrevPage, true);
  assert.equal(p.nextPage, 3);
  assert.equal(p.prevPage, 1);
  assert.equal(p.totalPages, 12);
});

test('decodeMirrorOption decodes Base64 iframe, direct video, HLS, and unavailable states', () => {
  const iframeB64 = Buffer.from('<iframe src="https://stream.example.com/embed/123"></iframe>').toString('base64');
  const videoB64 = Buffer.from('<video><source src="https://cdn.example.com/ep1.mp4" type="video/mp4"></video>').toString('base64');
  const hlsB64 = Buffer.from('<video><source src="https://cdn.example.com/master.m3u8?token=1"></video>').toString('base64');
  const badB64 = Buffer.from('Server is currently not available').toString('base64');

  const s1 = decodeMirrorOption('Mirror A', iframeB64);
  assert.equal(s1.type, 'iframe');
  assert.equal(s1.available, true);
  assert.equal(s1.url, 'https://stream.example.com/embed/123');

  const s2 = decodeMirrorOption('Direct MP4', videoB64);
  assert.equal(s2.type, 'video');
  assert.equal(s2.available, true);

  const s3 = decodeMirrorOption('HLS', hlsB64);
  assert.equal(s3.type, 'hls');
  assert.equal(s3.available, true);

  const s4 = decodeMirrorOption('Broken', badB64);
  assert.equal(s4.type, 'unavailable');
  assert.equal(s4.available, false);

  const resolved = selectPlayableServers([s1, s2, s4], null);
  assert.equal(resolved.primaryServer?.name, 'Direct MP4');
  assert.equal(resolved.playableServers.length, 2);
});

test('parseDownloadBoxes extracts qualities and host links', () => {
  const $ = cheerio.load(`
    <div class="soraddlx">
      <div class="sorattlx"><h3>Episode 01</h3></div>
      <div class="soraurlx">
        <strong>720p</strong>
        <a href="https://drive.google.com/file/1">GoogleDrive</a>
        <a href="https://acefile.co/f/1">AceFile</a>
      </div>
    </div>
  `);
  const boxes = parseDownloadBoxes($);
  assert.equal(boxes.length, 1);
  assert.equal(boxes[0].title, 'Episode 01');
  assert.equal(boxes[0].qualities[0].quality, '720p');
  assert.equal(boxes[0].qualities[0].links.length, 2);
});

test('parseQuickSearchPayload handles live admin-ajax schema, image fallback, empty WordPress responses, and invalid HTML', () => {
  const livePayload = JSON.stringify({
    anime: [
      {
        all: [
          {
            ID: 20110,
            post_image: 'http://v10.hidoristream.online/wp-content/uploads/2025/12/frieren.jpg',
            post_title: 'Sousou no Frieren Season 2 Subtitle Indonesia',
            post_genres: 'Adventure, Drama, Fantasy, Shounen',
            post_type: 'TV',
            post_link: 'https://v10.hidoristream.online/anime/sousou-no-frieren-season-2-subtitle-indonesia/',
            post_latest: '10',
            post_sub: 'Sub',
          },
          {
            ID: 20111,
            post_image: '',
            post_image_html: '<img src="https://v10.hidoristream.online/fallback.jpg" />',
            post_title: 'Anime Fallback Poster',
            post_genres: '',
            post_type: 'Movie',
            post_link: 'https://v10.hidoristream.online/anime/anime-fallback-poster/',
          },
        ],
      },
    ],
  });

  const parsed = parseQuickSearchPayload(livePayload);
  assert.equal(parsed.length, 2);
  assert.equal(parsed[0].postId, '20110');
  assert.equal(parsed[0].poster, 'https://v10.hidoristream.online/wp-content/uploads/2025/12/frieren.jpg');
  assert.equal(parsed[0].slug, 'sousou-no-frieren-season-2-subtitle-indonesia');
  assert.equal(parsed[0].kind, 'anime');
  assert.equal(parsed[0].latestEpisode, '10');
  assert.equal(parsed[0].sub, 'Sub');
  assert.deepEqual(parsed[0].genres, ['Adventure', 'Drama', 'Fantasy', 'Shounen']);
  assert.equal(parsed[1].poster, 'https://v10.hidoristream.online/fallback.jpg');

  assert.deepEqual(parseQuickSearchPayload('0'), []);
  assert.deepEqual(parseQuickSearchPayload('-1'), []);
  assert.deepEqual(parseQuickSearchPayload(''), []);

  assert.throws(
    () => parseQuickSearchPayload('<html><body>Just a moment...</body></html>'),
    (err: unknown) => err instanceof UpstreamError && err.status === 502
  );
});

test('UpstreamError and looksLikeChallengePage classify 404 vs challenge/empty responses', () => {
  const err404 = new UpstreamError('Not Found', { status: 404 });
  const err503 = new UpstreamError('Unavailable', { status: 503 });
  assert.equal(err404.isNotFound, true);
  assert.equal(err503.isNotFound, false);

  assert.equal(looksLikeChallengePage('<html><head><title>Just a moment...</title></head></html>'), true);
  assert.equal(looksLikeChallengePage('   '), true);
  assert.equal(looksLikeChallengePage('<html><body><div class="listupd"></div></body></html>'), false);
});
