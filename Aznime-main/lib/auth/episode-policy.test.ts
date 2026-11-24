import test from 'node:test';
import assert from 'node:assert/strict';
import { isEpisodeLocked, isEpisodeLockedForGuest, parseEpisodeNumber } from './episode-policy';

test('episode 1-3 gratis untuk tamu', () => {
  for (const value of ['1', '2', '3', '01', '3.0']) {
    assert.equal(isEpisodeLockedForGuest(value), false, `episode ${value} seharusnya gratis`);
  }
});

test('episode 4 ke atas terkunci untuk tamu', () => {
  for (const value of ['4', '5', '12', '10.5']) {
    assert.equal(isEpisodeLockedForGuest(value), true, `episode ${value} seharusnya terkunci`);
  }
});

test('episode tanpa nomor dianggap terkunci', () => {
  assert.equal(isEpisodeLockedForGuest(null), true);
  assert.equal(isEpisodeLockedForGuest(undefined), true);
  assert.equal(isEpisodeLockedForGuest(''), true);
  assert.equal(isEpisodeLockedForGuest('OVA'), true);
});

test('nomor episode dibaca dari judul bebas', () => {
  assert.equal(parseEpisodeNumber('Episode 7 Subtitle Indonesia'), 7);
  assert.equal(parseEpisodeNumber(4), 4);
  assert.equal(parseEpisodeNumber('eps 12.5'), 12.5);
});

test('user login tidak terkena gate', () => {
  assert.equal(isEpisodeLocked('5', true), false);
  assert.equal(isEpisodeLocked(null, true), false);
  assert.equal(isEpisodeLocked('5', false), true);
});
