import test from 'node:test';
import assert from 'node:assert/strict';
import {
  NEKOPOI_ONLY_GENRE,
  nekopoiAnimeSlug,
  nekopoiAnimeSlugFromSlug,
  nekopoiCleanTitle,
  nekopoiDetailGenres,
  nekopoiDetailTitle,
  nekopoiDownloadsToBoxes,
  nekopoiEpisodeNumber,
  nekopoiEpisodeSlug,
  nekopoiEpisodeSlugFromSlug,
  nekopoiIsHentaiItem,
  nekopoiIsSeries,
  nekopoiSeriesSlugFromEpisode,
  nekopoiSeriesTitle,
  nekopoiStreamsToMirrors,
  nekopoiSynopsis,
  nekopoiToCard,
  type NekopoiListItem,
} from './nekopoi';

const seriesItem: NekopoiListItem = {
  title: 'Kuroinu: Kedakaki Seijo wa Hakudaku ni Somaru',
  slug: 'kuroinu-kedakaki-seijo-wa-hakudaku-ni-somaru',
  url: 'https://nekopoi.care/hentai/kuroinu-kedakaki-seijo-wa-hakudaku-ni-somaru/',
  thumbnail: 'https://nekopoi.care/wp-content/uploads/2016/07/33059.jpg',
  status: 'Completed',
  score: '7.45',
};

const episodeItem: NekopoiListItem = {
  title: '[UNCENSORED] Mouse Cursor de Genjitsu o Sosa Dekiru Yo ni Natta node Episode 6 Subtitle Indonesia',
  slug: 'uncensored-mouse-cursor-de-genjitsu-o-sosa-dekiru-yo-ni-natta-node-episode-6-subtitle-indonesia',
  url: 'https://nekopoi.care/uncensored-mouse-cursor-de-genjitsu-o-sosa-dekiru-yo-ni-natta-node-episode-6-subtitle-indonesia/',
  thumbnail: 'https://nekopoi.care/wp-content/uploads/2026/11/vlcsnap-2026-11-20-18h07m09s971-300x170.jpg',
};

const javItem: NekopoiListItem = {
  title: 'MCY-0254 Spesial Pendidikan Seksualitas Godaan Guru Berpayudara',
  slug: 'mcy-0254-spesial-pendidikan-seksualitas-godaan-guru-berpayudara',
  url: 'https://nekopoi.care/mcy-0254-spesial-pendidikan-seksualitas-godaan-guru-berpayudara/',
};

test('slug berawalan bisa dibalik ke slug sumber', () => {
  assert.equal(nekopoiAnimeSlug('kuroinu'), 'nekopoi-kuroinu');
  assert.equal(nekopoiEpisodeSlug('kuroinu-episode-1'), 'nekopoi-ep-kuroinu-episode-1');
  assert.equal(nekopoiAnimeSlugFromSlug('nekopoi-kuroinu'), 'kuroinu');
  assert.equal(nekopoiEpisodeSlugFromSlug('nekopoi-ep-kuroinu-episode-1'), 'kuroinu-episode-1');
  // Slug episode tidak boleh dibaca sebagai slug seri.
  assert.equal(nekopoiAnimeSlugFromSlug('nekopoi-ep-kuroinu-episode-1'), null);
  assert.equal(nekopoiEpisodeSlugFromSlug('nekopoi-kuroinu'), null);
});

test('slug seri diturunkan dari slug episode', () => {
  assert.equal(
    nekopoiSeriesSlugFromEpisode('kuroinu-kedakaki-seijo-wa-hakudaku-ni-somaru-episode-1-subtitle-indonesia'),
    'kuroinu-kedakaki-seijo-wa-hakudaku-ni-somaru'
  );
  assert.equal(
    nekopoiSeriesSlugFromEpisode('taimanin-shiranui-episode-2'),
    'taimanin-shiranui'
  );
  // Postingan 3D/JAV tidak berpola episode, jadi tidak punya seri induk.
  assert.equal(nekopoiSeriesSlugFromEpisode('mcy-0254-spesial-pendidikan'), null);
});

test('judul dibersihkan dari penanda rilis dan nomor episode', () => {
  assert.equal(
    nekopoiCleanTitle('[4K] Kuroinu: Kedakaki Seijo Episode 1 Subtitle Indonesia'),
    'Kuroinu: Kedakaki Seijo Episode 1'
  );
  assert.equal(
    nekopoiSeriesTitle('[4K] Kuroinu: Kedakaki Seijo Episode 1 Subtitle Indonesia'),
    'Kuroinu: Kedakaki Seijo'
  );
  assert.equal(nekopoiEpisodeNumber('Kuroinu Episode 6 Subtitle Indonesia'), '6');
  assert.equal(nekopoiEpisodeNumber('Kuroinu'), null);
  assert.equal(
    nekopoiDetailTitle('Unduh "Kuroinu: Kedakaki Seijo wa Hakudaku ni Somaru" Indonesian Subbed/Dubbed Online'),
    'Kuroinu: Kedakaki Seijo wa Hakudaku ni Somaru'
  );
  assert.equal(nekopoiSynopsis('Sinopsis : Takumi, si cowok kuper.'), 'Takumi, si cowok kuper.');
});

test('kartu daftar hanya memakai genre Hentai', () => {
  const seriesCard = nekopoiToCard(seriesItem);
  assert.equal(seriesCard.kind, 'anime');
  assert.equal(seriesCard.slug, 'nekopoi-kuroinu-kedakaki-seijo-wa-hakudaku-ni-somaru');
  assert.deepEqual(seriesCard.genres, [NEKOPOI_ONLY_GENRE]);
  assert.equal(seriesCard.type, NEKOPOI_ONLY_GENRE);

  const episodeCard = nekopoiToCard(episodeItem);
  assert.equal(episodeCard.kind, 'episode');
  assert.equal(episodeCard.slug, `nekopoi-ep-${episodeItem.slug}`);
  assert.equal(episodeCard.episodeNumber, 6);
  assert.equal(episodeCard.title, 'Mouse Cursor de Genjitsu o Sosa Dekiru Yo ni Natta node Episode 6');
  assert.equal(episodeCard.seriesTitle, 'Mouse Cursor de Genjitsu o Sosa Dekiru Yo ni Natta node');
  assert.deepEqual(episodeCard.genres, [NEKOPOI_ONLY_GENRE]);
});

test('genre asli hanya dipakai halaman sinopsis', () => {
  assert.deepEqual(
    nekopoiDetailGenres(['Ahegao', 'Anal', 'ahegao', ' BDSM ']),
    ['Ahegao', 'Anal', 'BDSM']
  );
  // Tanpa genre dari sumber, halaman sinopsis tetap menampilkan Hentai.
  assert.deepEqual(nekopoiDetailGenres([]), [NEKOPOI_ONLY_GENRE]);
  assert.deepEqual(nekopoiDetailGenres(undefined), [NEKOPOI_ONLY_GENRE]);
});

test('rilisan 3D dan JAV disaring keluar', () => {
  assert.equal(nekopoiIsSeries(seriesItem), true);
  assert.equal(nekopoiIsSeries(episodeItem), false);
  assert.equal(nekopoiIsHentaiItem(seriesItem), true);
  assert.equal(nekopoiIsHentaiItem(episodeItem), true);
  assert.equal(nekopoiIsHentaiItem(javItem), false);
});

test('server pemutar membuang widget Discord', () => {
  const mirrors = nekopoiStreamsToMirrors([
    { server: 'Server 1', url: 'https://playmogo.com/e/4ahr74cmibv1' },
    { server: 'Server 3', url: 'https://discord.com/widget?id=1&theme=dark' },
    { server: 'Server 4', url: 'https://stmpoi.com/embed-4frbhig06d0w.html' },
  ]);

  assert.equal(mirrors.length, 2);
  assert.deepEqual(
    mirrors.map((mirror) => mirror.name),
    ['Server 1', 'Server 4']
  );
  assert.ok(mirrors.every((mirror) => mirror.type === 'iframe' && mirror.available));
});

test('tautan unduhan dikelompokkan per resolusi', () => {
  const boxes = nekopoiDownloadsToBoxes([
    {
      quality: '1080p',
      links: [
        { host: 'Mp4Upload', url: 'https://ouo.io/zfLhsK' },
        { host: 'Pixel', url: 'https://ouo.io/TS4Gt8' },
      ],
    },
    { quality: '720p', links: [] },
  ]);

  assert.equal(boxes.length, 1);
  assert.equal(boxes[0].qualities.length, 1);
  assert.equal(boxes[0].qualities[0].quality, '1080p');
  assert.equal(boxes[0].qualities[0].links.length, 2);
  assert.deepEqual(nekopoiDownloadsToBoxes([]), []);
});
