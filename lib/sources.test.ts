import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MALZ_PAGE_BASE,
  isMalzPoolPage,
  mergeAnimeCards,
  normalizeTitle,
  titleMatchKeys,
  toMalzPoolPage,
  toVirtualMalzPage,
} from './sources';
import type { AnimeCardItem } from './scraper/types';

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
