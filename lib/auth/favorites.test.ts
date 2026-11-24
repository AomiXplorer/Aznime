import test from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeFavoriteInput } from './favorites';

test('favorit butuh animeId dan title', () => {
  assert.equal(sanitizeFavoriteInput(null), null);
  assert.equal(sanitizeFavoriteInput({ animeId: 'x' }), null);
  assert.equal(sanitizeFavoriteInput({ title: 'x' }), null);
});

test('favorit disimpan dengan timestamp', () => {
  const clean = sanitizeFavoriteInput({ animeId: 'one-piece', title: 'One Piece', poster: 'https://x/y.jpg' });
  assert.ok(clean);
  assert.equal(clean.animeId, 'one-piece');
  assert.equal(clean.poster, 'https://x/y.jpg');
  assert.ok(clean.addedAt > 0);
});
