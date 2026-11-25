import assert from 'node:assert/strict';
import test from 'node:test';
import type { EpisodeSummary } from './scraper/types';
import { createEpisodeRanges, matchesEpisodeQuery } from './episode-format';

const episodes: EpisodeSummary[] = [
  { number: '10', title: 'Naruto Episode 10', date: null, slug: 'ep-10', url: '' },
  { number: '100', title: 'Naruto Episode 100', date: null, slug: 'ep-100', url: '' },
  { number: '110', title: 'Naruto Episode 110', date: null, slug: 'ep-110', url: '' },
];

test('pencarian nomor episode mencocokkan nomor tepat, bukan nomor yang mengandung digit sama', () => {
  assert.deepEqual(episodes.filter((episode) => matchesEpisodeQuery(episode, '10')), [episodes[0]]);
  assert.deepEqual(
    episodes.filter((episode) => matchesEpisodeQuery(episode, 'Episode 100')),
    [episodes[1]]
  );
});

test('pencarian judul episode tetap tidak peka huruf besar-kecil', () => {
  assert.deepEqual(
    episodes.filter((episode) => matchesEpisodeQuery(episode, 'naruto')),
    episodes
  );
});

test('rentang panjang dibuat per 50 episode, termasuk seri yang dimulai jauh di atas episode 1', () => {
  assert.deepEqual(
    createEpisodeRanges(1, 220).map(({ label }) => label),
    ['1–50', '51–100', '101–150', '151–200', '201–220']
  );
  assert.deepEqual(
    createEpisodeRanges(1111, 1180).map(({ label }) => label),
    ['1101–1150', '1151–1180']
  );
  assert.equal(createEpisodeRanges(1, 1180).length, 24);
  assert.deepEqual(
    createEpisodeRanges(1, 1180).slice(-2).map(({ label }) => label),
    ['1101–1150', '1151–1180']
  );
});
