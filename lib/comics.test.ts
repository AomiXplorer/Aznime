import assert from 'node:assert/strict';
import test from 'node:test';
import { getWebtoonDetail, getWebtoonEpisode, getWebtoonEpisodes } from './comics';

function titleResponse(titleNo: number) {
  return new Response(`__titleHomeState__ dto:${JSON.stringify({
    title: {
      titleNo,
      title: 'Contoh Webtoon',
      synopsis: 'Sinopsis contoh',
      representGenre: { displayName: 'Fantasi', seoCode: 'fantasy' },
    },
  })}`);
}

test('detail WEBTOON bisa dibaca saat daftar episode masih dimuat', async (t) => {
  const titleNo = 800001;
  const episodes = Promise.withResolvers<Response>();
  const paths: string[] = [];

  t.mock.method(globalThis, 'fetch', async (input: string) => {
    const { pathname } = new URL(input);
    paths.push(pathname);
    return pathname.endsWith('/episodes') ? episodes.promise : titleResponse(titleNo);
  });

  const list = getWebtoonEpisodes(titleNo);
  const detail = await getWebtoonDetail(titleNo, 'contoh-webtoon');
  assert.equal(detail?.synopsis, 'Sinopsis contoh');

  episodes.resolve(Response.json({ result: { episodeList: [{ episodeNo: 1, episodeTitle: 'Pembuka' }] } }));
  assert.deepEqual(await list, [{ episodeNo: 1, title: 'Pembuka', date: null }]);
  assert.deepEqual(paths, [
    '/api/v1/webtoon/800001/episodes',
    '/id/action/contoh-webtoon/list',
  ]);
});

test('pembaca WEBTOON melewati daftar episode dan mencoba ulang viewer yang sempat kosong', async (t) => {
  const titleNo = 800002;
  const paths: string[] = [];
  let viewerRequests = 0;

  t.mock.method(globalThis, 'fetch', async (input: string) => {
    const url = new URL(input);
    paths.push(url.pathname);
    if (url.pathname.endsWith('/list')) return titleResponse(titleNo);
    assert.equal(url.pathname, '/id/fantasy/contoh-webtoon/episode-7/viewer');
    assert.equal(url.searchParams.get('title_no'), String(titleNo));
    assert.equal(url.searchParams.get('episode_no'), '7');

    viewerRequests += 1;
    return viewerRequests === 1
      ? new Response('Viewer belum tersedia', { status: 503 })
      : new Response('var imageList = [{url:"https://webtoon-phinf.pstatic.net/page.jpg", width:800, height:1200}]');
  });

  assert.equal(await getWebtoonEpisode(titleNo, 'contoh-webtoon', 7), null);
  const [view, concurrentView] = await Promise.all([
    getWebtoonEpisode(titleNo, 'contoh-webtoon', 7),
    getWebtoonEpisode(titleNo, 'contoh-webtoon', 7),
  ]);
  assert.equal(view?.seriesTitle, 'Contoh Webtoon');
  assert.equal(view?.images[0]?.height, 1200);
  assert.deepEqual(concurrentView, view);
  assert.deepEqual(await getWebtoonEpisode(titleNo, 'contoh-webtoon', 7), view);
  assert.deepEqual(paths, [
    '/id/action/contoh-webtoon/list',
    '/id/fantasy/contoh-webtoon/episode-7/viewer',
    '/id/fantasy/contoh-webtoon/episode-7/viewer',
  ]);
});
