import test from 'node:test';
import assert from 'node:assert/strict';
import { buildTitleCandidates, cleanAnimeTitleForMatch } from './anilist';

test('cleanAnimeTitleForMatch strips Subtitle Indonesia and release suffixes', () => {
  assert.equal(
    cleanAnimeTitleForMatch('Sousou no Frieren Season 2 Subtitle Indonesia'),
    'Sousou no Frieren Season 2'
  );
  assert.equal(
    cleanAnimeTitleForMatch('Chainsaw Man Movie: Reze-hen (BD) Sub Indo'),
    'Chainsaw Man Movie: Reze-hen'
  );
});

test('buildTitleCandidates deduplicates primary, altTitle, and season-stripped variants', () => {
  const candidates = buildTitleCandidates(
    'Sousou no Frieren Season 2 Subtitle Indonesia',
    'Frieren: Beyond Journey’s End Season 2, 葬送のフリーレン'
  );
  assert.equal(candidates[0], 'Sousou no Frieren Season 2');
  assert.ok(candidates.includes('Frieren: Beyond Journey’s End Season 2'));
  assert.ok(candidates.includes('Sousou no Frieren'));

  const movieCandidates = buildTitleCandidates('Chainsaw Man Movie: Reze-hen Subtitle Indonesia');
  assert.ok(movieCandidates.includes('Chainsaw Man Reze'));
});
