import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MALZ_PAGE_BASE,
  dedupeCards,
  isMalzPoolPage,
  looseTitleKey,
  mergeAnimeCards,
  mergeQuickSearchResults,
  normalizeTitle,
  titleMatchKeys,
  toMalzPoolPage,
  toVirtualMalzPage,
} from './sources';
import type { AnimeCardItem, QuickSearchItem } from './scraper/types';

function card(partial: Partial<AnimeCardItem> & { title: string }): AnimeCardItem {
  return {
    postId: null,
    seriesTitle: partial.seriesTitle ?? partial.title,
    slug: partial.slug ?? null,
    url: partial.url ?? null,
    kind: 'anime',
    poster: null,
    type: null,
    status: null,
    sub: null,
    episode: null,
    episodeNumber: null,
    isHot: false,
    source: 'hidori',
    ...partial,
  };
}

test('normalizeTitle menyamakan variasi judul antar sumber', () => {
  assert.equal(
    normalizeTitle('Naruto Shippuuden Subtitle Indonesia'),
    normalizeTitle('Naruto: Shippuden')
  );
  assert.equal(normalizeTitle('Black Clover 2nd Season'), normalizeTitle('Black Clover Season 2'));
  assert.equal(normalizeTitle('[BD] One Piece Sub Indo'), 'one piece');
  assert.notEqual(normalizeTitle('Black Clover'), normalizeTitle('Black Clover Season 2'));
});

test('titleMatchKeys memakai judul utama, judul seri, dan sinonim', () => {
  const keys = titleMatchKeys({
    title: 'Naruto: Shippuuden',
    seriesTitle: 'Naruto Shippuuden Subtitle Indonesia',
    altTitles: ['Naruto Shippuden', 'NARUTO-ナルト- 疾風伝'],
  });
  assert.ok(keys.includes('naruto shipuden'));
  assert.ok(keys.length >= 2);
});

test('mergeAnimeCards membuang judul Malz yang sudah ada di Hidori', () => {
  const hidori = [
    card({ title: 'One Piece Episode 1090 Subtitle Indonesia', seriesTitle: 'One Piece' }),
    card({ title: 'Black Clover Season 2 Subtitle Indonesia', seriesTitle: 'Black Clover Season 2' }),
  ];
  const malz = [
    card({ title: 'One Piece', slug: 'malz-426', source: 'malz' }),
    card({ title: 'Black Clover 2nd Season', slug: 'malz-6484', source: 'malz' }),
    card({ title: 'Naruto: Shippuuden', slug: 'malz-341', source: 'malz' }),
  ];

  const merged = mergeAnimeCards(hidori, malz, new Set());
  assert.equal(merged.length, 3);
  assert.deepEqual(
    merged.map((item) => item.title),
    [
      'One Piece Episode 1090 Subtitle Indonesia',
      'Black Clover Season 2 Subtitle Indonesia',
      'Naruto: Shippuuden',
    ]
  );
});

test('mergeAnimeCards menghormati batas dan indeks judul Hidori', () => {
  const index = new Set(['detective conan']);
  const malz = [
    card({ title: 'Detective Conan', slug: 'malz-1', source: 'malz' }),
    card({ title: 'Doraemon', slug: 'malz-2', source: 'malz' }),
    card({ title: 'Sazae-san', slug: 'malz-3', source: 'malz' }),
  ];

  const merged = mergeAnimeCards([], malz, index, 2);
  assert.equal(merged.length, 2);
  assert.deepEqual(
    merged.map((item) => item.title),
    ['Doraemon', 'Sazae-san']
  );
});

test('halaman arsip memakai penanda angka yang konsisten', () => {
  assert.equal(isMalzPoolPage(MALZ_PAGE_BASE), true);
  assert.equal(isMalzPoolPage(MALZ_PAGE_BASE - 1), false);
  assert.equal(toMalzPoolPage(toVirtualMalzPage(3)), 3);
});

test('sinonim pendek tidak menghapus entri arsip lain', () => {
  const malz = [
    card({ title: 'Naruto: Shippuuden', slug: 'malz-341', source: 'malz', altTitles: ['Naruto'] }),
    card({ title: 'Naruto', slug: 'malz-338', source: 'malz', altTitles: [] }),
    card({
      title: 'Naruto: Shippuuden Movie 1',
      slug: 'malz-342',
      source: 'malz',
      altTitles: ['Naruto'],
    }),
  ];

  const merged = mergeAnimeCards([], malz, new Set());
  assert.deepEqual(
    merged.map((item) => item.title),
    ['Naruto: Shippuuden', 'Naruto', 'Naruto: Shippuuden Movie 1']
  );
});

test('judul yang sama dari dua sumber tetap diringkas jadi satu', () => {
  const malz = [
    card({ title: 'One Piece', slug: 'malz-426', source: 'malz' }),
    card({ title: 'One Piece Subtitle Indonesia', slug: 'malz-999', source: 'malz' }),
  ];
  const merged = mergeAnimeCards([], malz, new Set());
  assert.equal(merged.length, 1);
});

function quick(partial: Partial<QuickSearchItem> & { title: string }): QuickSearchItem {
  return {
    postId: '',
    slug: null,
    url: null,
    kind: 'anime',
    poster: null,
    genres: [],
    type: null,
    latestEpisode: null,
    sub: 'Sub',
    source: 'hidori',
    ...partial,
  };
}

test('normalizeTitle membuang penanda rilis yang membuat judul terlihat beda', () => {
  assert.equal(normalizeTitle('BATCH Gachiakuta Subtitle Indonesia'), 'gachiakuta');
  assert.equal(normalizeTitle('BATCH BATCH Sakamoto Days Sub Indo'), 'sakamoto days');
  assert.equal(normalizeTitle('Kusuriya no Hitorigoto [BD 1080p]'), 'kusuriya no hitorigoto');
  assert.equal(normalizeTitle('One Piece Web-DL 720p Subtitle Indonesia'), 'one piece');
});

test('tahun dalam kurung tetap dipertahankan supaya musim berbeda tidak tertelan', () => {
  assert.notEqual(normalizeTitle('Berserk (1997)'), normalizeTitle('Berserk'));
  assert.notEqual(normalizeTitle('Pokemon (2019)'), normalizeTitle('Pokemon (2023)'));
  assert.equal(looseTitleKey('Berserk (1997)'), 'berserk');
});

test('kartu BATCH dibuang dan diganti entri arsip yang judulnya bersih', () => {
  const hidori = [
    card({
      title: 'BATCH Gachiakuta Subtitle Indonesia',
      seriesTitle: 'Gachiakuta',
      isBatch: true,
    }),
  ];
  const malz = [card({ title: 'Gachiakuta', slug: 'malz-9001', source: 'malz' })];

  const merged = mergeAnimeCards(hidori, malz, new Set());
  assert.equal(merged.length, 1);
  assert.equal(merged[0].source, 'malz');
  assert.equal(merged[0].title, 'Gachiakuta');
});

test('kartu BATCH tetap dipakai kalau arsip tidak punya padanannya', () => {
  const hidori = [
    card({ title: 'BATCH Anime Langka Subtitle Indonesia', seriesTitle: 'Anime Langka', isBatch: true }),
  ];

  const merged = mergeAnimeCards(hidori, [], new Set());
  assert.equal(merged.length, 1);
  assert.equal(merged[0].source, 'hidori');
});

test('seri yang bukan BATCH tidak diganti entri arsip', () => {
  const hidori = [card({ title: 'Gachiakuta Subtitle Indonesia', seriesTitle: 'Gachiakuta' })];
  const malz = [card({ title: 'Gachiakuta', slug: 'malz-9001', source: 'malz' })];

  const merged = mergeAnimeCards(hidori, malz, new Set());
  assert.equal(merged.length, 1);
  assert.equal(merged[0].source, 'hidori');
});

test('dedupeCards meringkas duplikat dalam satu sumber dan memilih posting seri', () => {
  const items = [
    card({ title: 'BATCH Sakamoto Days Subtitle Indonesia', kind: 'episode' }),
    card({ title: 'Sakamoto Days Subtitle Indonesia', kind: 'anime' }),
    card({ title: 'Sakamoto Days Season 2 Subtitle Indonesia', kind: 'anime' }),
  ];

  const deduped = dedupeCards(items);
  assert.deepEqual(
    deduped.map((item) => item.title),
    ['Sakamoto Days Subtitle Indonesia', 'Sakamoto Days Season 2 Subtitle Indonesia']
  );
});

test('mergeQuickSearchResults tidak mengulang anime yang sama dari arsip', () => {
  const hidori = [quick({ title: 'BATCH Gachiakuta Subtitle Indonesia' })];
  const malz = [
    quick({ title: 'Gachiakuta', slug: 'malz-9001', source: 'malz' }),
    quick({ title: 'Sakamoto Days', slug: 'malz-9002', source: 'malz' }),
    quick({ title: 'Sakamoto Days', slug: 'malz-9003', source: 'malz' }),
  ];

  const merged = mergeQuickSearchResults(hidori, malz, new Set(), 8);
  assert.deepEqual(
    merged.map((item) => item.slug),
    ['malz-9001', 'malz-9002']
  );
});

test('mergeQuickSearchResults menghormati jatah arsip', () => {
  const malz = [
    quick({ title: 'Anime A', slug: 'malz-1', source: 'malz' }),
    quick({ title: 'Anime B', slug: 'malz-2', source: 'malz' }),
    quick({ title: 'Anime C', slug: 'malz-3', source: 'malz' }),
  ];

  const merged = mergeQuickSearchResults([], malz, new Set(), 2);
  assert.equal(merged.length, 2);
});

test('judul bilingual Hidori tetap dianggap anime yang sama dengan arsip', () => {
  const hidori = [
    card({
      title: 'Solo Leveling Ore dake Level Up na Ken Season 2 : Arise from the Shadow Subtitle Indonesia',
      seriesTitle: 'Solo Leveling Ore dake Level Up na Ken Season 2',
    }),
  ];
  const malz = [
    card({
      title: 'Ore dake Level Up na Ken Season 2: Arise from the Shadow',
      slug: 'malz-5565',
      source: 'malz',
    }),
  ];

  const merged = mergeAnimeCards(hidori, malz, new Set());
  assert.equal(merged.length, 1);
  assert.equal(merged[0].source, 'hidori');
});

test('judul pendek tidak menelan seri lain yang mirip', () => {
  const hidori = [card({ title: 'Boushoku no Berserk Subtitle Indonesia', seriesTitle: 'Boushoku no Berserk' })];
  const malz = [card({ title: 'Berserk', slug: 'malz-1', source: 'malz' })];

  assert.equal(mergeAnimeCards(hidori, malz, new Set()).length, 2);
});

test('musim yang dipecah jadi part tidak digabung dengan musim penuh', () => {
  const hidori = [
    card({
      title: 'Mushoku Tensei Isekai Ittara Honki Dasu Season 2 Part 2 Subtitle Indonesia',
      seriesTitle: 'Mushoku Tensei Isekai Ittara Honki Dasu Season 2 Part 2',
    }),
  ];
  const malz = [
    card({
      title: 'Mushoku Tensei: Isekai Ittara Honki Dasu 2nd Season',
      slug: 'malz-2',
      source: 'malz',
    }),
  ];

  assert.equal(mergeAnimeCards(hidori, malz, new Set()).length, 2);
});
