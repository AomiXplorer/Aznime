import test from 'node:test';
import assert from 'node:assert/strict';
import {
  malzAnimeIdFromSlug,
  malzEpisodeIdFromSlug,
  malzEpisodeSlug,
  malzReadableEpisodeFromSlug,
  malzServersToMirrors,
  malzSinonimList,
  malzStatusLabel,
  malzToCard,
  malzToEpisodeSummary,
  malzImageUrl,
  malzToQuickItem,
  normalizeMalzAsset,
  type MalzAnime,
  type MalzServer,
} from './malz';

const anime: MalzAnime = {
  id: '341',
  judul: 'Naruto: Shippuuden',
  sinonim: 'Naruto: Shippuden, NARUTO-ナルト- 疾風伝',
  sinopsis: 'Kisah Naruto Uzumaki.',
  poster: 'https://xyz-api.animein.net//assets_xyz/images/movie/poster/abc.jpg',
  cover: 'https://xyz-api.animein.net//assets_xyz/images/movie/cover/abc.jpg',
  tipe: 'SERIES',
  tahun: '2025',
  hari: 'RANDOM',
  status: 'FINISHED',
  genre: 'Action,Shounen,Super Power',
  rating: '',
  views: '5960484',
  favorit: '15567',
  studio: 'Studio Pierrot',
  tayang: '2007-02-15',
  selesai: '2017-03-23',
};

test('slug Malz dipetakan bolak-balik dan tidak menabrak slug Hidori', () => {
  assert.equal(malzAnimeIdFromSlug('malz-341'), '341');
  assert.equal(malzAnimeIdFromSlug('naruto-shippuuden-subtitle-indonesia'), null);
  assert.equal(malzEpisodeIdFromSlug('malz-ep-4988'), '4988');
  assert.equal(malzEpisodeIdFromSlug('malz-341'), null);
});

test('normalizeMalzAsset merapikan garis miring ganda pada poster', () => {
  assert.equal(
    normalizeMalzAsset('https://xyz-api.animein.net//assets_xyz/images/movie/poster/abc.jpg'),
    'https://xyz-api.animein.net/assets_xyz/images/movie/poster/abc.jpg'
  );
  assert.equal(normalizeMalzAsset('javascript:alert(1)'), null);
  assert.equal(normalizeMalzAsset(''), null);
});

test('malzToCard memetakan field API ke kartu katalog', () => {
  const card = malzToCard(anime);
  assert.equal(card.slug, 'naruto-shippuuden');
  assert.equal(card.source, 'malz');
  assert.equal(card.kind, 'anime');
  assert.equal(card.type, 'TV');
  assert.equal(card.status, 'Completed');
  /* CDN animein diblokir Cloudflare, jadi poster ditukar dengan cover AniList
     yang dicari lewat judul (parameter t) saat gambar diminta. */
  const poster = new URL(card.poster!, 'https://aznime.com');
  assert.equal(poster.pathname, '/api/img');
  assert.equal(
    poster.searchParams.get('u'),
    'https://xyz-api.animein.net/assets_xyz/images/movie/poster/abc.jpg'
  );
  assert.equal(poster.searchParams.get('t'), 'Naruto: Shippuuden');
  assert.equal(poster.searchParams.get('a'), 'Naruto: Shippuden');
  assert.equal(poster.searchParams.get('w'), '340');
  assert.deepEqual(card.genres, ['Action', 'Shounen', 'Super Power']);
  assert.deepEqual(card.altTitles, ['Naruto: Shippuden', 'NARUTO-ナルト- 疾風伝']);
});

test('malzSinonimList membuang judul utama dari daftar sinonim', () => {
  assert.deepEqual(malzSinonimList({ judul: 'Black Clover', sinonim: 'Black Clover, BC' }), ['BC']);
  assert.deepEqual(malzSinonimList({ judul: 'Black Clover', sinonim: '' }), []);
});

test('label status dan tipe memakai bahasa yang dipakai katalog Hidori', () => {
  assert.equal(malzStatusLabel('ONGOING'), 'Ongoing');
  assert.equal(malzStatusLabel('FINISHED'), 'Completed');
  assert.equal(malzStatusLabel('WAITING'), 'Upcoming');
  assert.equal(malzStatusLabel('UNKNOWN'), 'Unknown');
});

test('malzToQuickItem dan malzToEpisodeSummary menjaga slug yang bisa dirutekan', () => {
  const quick = malzToQuickItem(anime);
  assert.equal(quick.slug, 'naruto-shippuuden');
  assert.equal(quick.source, 'malz');

  const episode = malzToEpisodeSummary({
    id: '4988',
    episode: '500',
    judul: 'Episode 500',
    views: '53990',
    id_anime: '341',
    tanggal: '2 Aug 2019',
    gambar: '',
  });
  assert.equal(episode.slug, 'malz-ep-4988');
  assert.equal(episode.number, '500');
});

test('server Malz diurutkan kualitas tertinggi dulu, direct sebelum embed', () => {
  const servers: MalzServer[] = [
    { id: '1', nama: 'RAPSODI', tipe: 'direct', kualitas: '360p', ukuran_mb: null, link: 'https://cdn/360.mp4', host: 'cdn', perlu_browser: true },
    { id: '2', nama: 'RAPSODI', tipe: 'direct', kualitas: '1080p', ukuran_mb: null, link: 'https://cdn/1080.mp4', host: 'cdn', perlu_browser: true },
    { id: '3', nama: 'NANIMEX', tipe: 'semi', kualitas: '720p', ukuran_mb: null, link: 'https://embed/720', host: 'embed', perlu_browser: false },
  ];

  const mirrors = malzServersToMirrors(servers);
  assert.deepEqual(
    mirrors.map((mirror) => mirror.name),
    ['RAPSODI 1080p', 'RAPSODI 360p', 'NANIMEX 720p']
  );
  assert.equal(mirrors[0].type, 'video');
  assert.equal(mirrors[2].type, 'iframe');
  assert.ok(mirrors.every((mirror) => mirror.available));
});

test('malzServersToMirrors membuang server tanpa tautan', () => {
  const mirrors = malzServersToMirrors([
    { id: '1', nama: 'RAPSODI', tipe: 'direct', kualitas: '720p', ukuran_mb: null, link: '', host: 'cdn', perlu_browser: true },
  ]);
  assert.equal(mirrors.length, 0);
});

test('malzImageUrl mengarahkan poster lewat proxy gambar', () => {
  assert.equal(malzImageUrl(''), null);
  assert.equal(malzImageUrl(null), null);
  assert.equal(
    malzImageUrl('https://api.animein.net//assets/images/movie/poster/abc.jpg'),
    '/api/img?u=' + encodeURIComponent('https://api.animein.net/assets/images/movie/poster/abc.jpg')
  );
});


test('slug episode Malz memakai nama anime tanpa kata malz', () => {
  assert.equal(malzEpisodeSlug('49385', 'Black Clover', '136'), 'black-clover-episode-136');
  assert.equal(malzEpisodeSlug('49385'), 'malz-ep-49385');
  assert.deepEqual(malzReadableEpisodeFromSlug('black-clover-episode-136'), {
    titleSlug: 'black-clover',
    number: 136,
  });
  assert.equal(malzReadableEpisodeFromSlug('malz-ep-49385'), null);
});
