import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_PREFERENCES,
  decodePreferences,
  encodePreferences,
  preferencesCookie,
} from './preferences';

test('tanpa cookie, filter konten dewasa mati dan riwayat tetap disimpan', () => {
  assert.deepEqual(decodePreferences(undefined), DEFAULT_PREFERENCES);
  assert.deepEqual(decodePreferences(''), DEFAULT_PREFERENCES);
  assert.equal(decodePreferences(null).adult, false);
  assert.equal(decodePreferences('').saveHistory, true);
});

test('nilai yang menyimpang dari bawaan bisa bolak-balik', () => {
  const prefs = { adult: true, saveHistory: false, reduceMotion: true };
  assert.equal(encodePreferences(prefs), 'adult.nohistory.nomotion');
  assert.deepEqual(decodePreferences(encodePreferences(prefs)), prefs);
});

test('bawaan tidak menulis apa pun ke cookie', () => {
  assert.equal(encodePreferences(DEFAULT_PREFERENCES), '');
});

test('cookie rusak atau asing diabaikan, bukan bikin halaman error', () => {
  assert.deepEqual(decodePreferences('adult'), {
    adult: true,
    saveHistory: true,
    reduceMotion: false,
  });
  assert.deepEqual(decodePreferences('../../etc/passwd'), DEFAULT_PREFERENCES);
  assert.deepEqual(decodePreferences('ADULT, nomotion'), {
    adult: true,
    saveHistory: true,
    reduceMotion: true,
  });
});

test('cookie pengaturan memakai path root dan setahun', () => {
  const cookie = preferencesCookie({ adult: true, saveHistory: true, reduceMotion: false });
  assert.match(cookie, /^aznime_prefs=adult;/);
  assert.match(cookie, /path=\//);
  assert.match(cookie, /max-age=31536000/);
  assert.match(cookie, /samesite=lax/i);
  assert.doesNotMatch(cookie, /secure/);
  assert.match(preferencesCookie(DEFAULT_PREFERENCES, true), /; secure$/);
});
