import test from 'node:test';
import assert from 'node:assert/strict';
import { isAdultTitle, withoutAdult } from './adult';

test('judul bertipe Hentai dikenali sebagai konten dewasa', () => {
  assert.equal(isAdultTitle({ type: 'Hentai', genres: [] }), true);
  assert.equal(isAdultTitle({ type: 'TV', genres: ['Hentai'] }), true);
  assert.equal(isAdultTitle({ type: 'TV', genres: ['Action', 'hentai'] }), true);
});

test('anime biasa tidak ikut tersaring', () => {
  assert.equal(isAdultTitle({ type: 'TV', genres: ['Action', 'Fantasy'] }), false);
  assert.equal(isAdultTitle({ type: null, genres: null }), false);
  assert.equal(isAdultTitle({}), false);
});

test('withoutAdult membuang hanya judul dewasa dan menjaga urutan', () => {
  const items = [
    { title: 'One Piece', type: 'TV', genres: ['Action'] },
    { title: 'Onaji Semi', type: 'Hentai', genres: ['Hentai'] },
    { title: 'Kuroinu', type: 'ONA', genres: ['Hentai'] },
    { title: 'Naruto', type: 'TV', genres: ['Action'] },
  ];

  assert.deepEqual(
    withoutAdult(items).map((item) => item.title),
    ['One Piece', 'Naruto']
  );
});
