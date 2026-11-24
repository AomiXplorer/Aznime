import assert from 'node:assert/strict';
import test from 'node:test';
import { isBlockedPosterHost, isTitlePosterUrl, titlePosterUrl } from './posters';

test('host poster yang diblokir Cloudflare dikenali', () => {
  assert.equal(isBlockedPosterHost('https://api.animein.net/assets/images/movie/poster/a.jpg'), true);
  assert.equal(isBlockedPosterHost('https://xyz-api.animein.net/assets_xyz/images/movie/poster/a.jpg'), true);
  assert.equal(isBlockedPosterHost('https://storages.animein.net/x.jpg'), true);
  assert.equal(isBlockedPosterHost('https://v10.hidoristream.online/wp-content/uploads/a.jpg'), false);
  assert.equal(isBlockedPosterHost('https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx1.jpg'), false);
  assert.equal(isBlockedPosterHost(null), false);
  assert.equal(isBlockedPosterHost('bukan url'), false);
});

test('titlePosterUrl membawa judul, alias, dan lebar', () => {
  const url = new URL(titlePosterUrl('One Piece', 'OP'), 'https://aznime.com');
  assert.equal(url.pathname, '/api/img');
  assert.equal(url.searchParams.get('t'), 'One Piece');
  assert.equal(url.searchParams.get('a'), 'OP');
  assert.equal(url.searchParams.get('w'), '340');
  assert.equal(url.searchParams.get('f'), 'webp');
});

test('isTitlePosterUrl hanya benar untuk proksi berbasis judul', () => {
  assert.equal(isTitlePosterUrl(titlePosterUrl('One Piece')), true);
  assert.equal(isTitlePosterUrl('/api/img?u=https%3A%2F%2Fv10.hidoristream.online%2Fa.jpg'), false);
  assert.equal(isTitlePosterUrl('https://s4.anilist.co/x.jpg'), false);
  assert.equal(isTitlePosterUrl(null), false);
});
