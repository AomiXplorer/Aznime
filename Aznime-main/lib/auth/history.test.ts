import test from 'node:test';
import assert from 'node:assert/strict';
import { HISTORY_LIMIT, mergeHistoryItems, sanitizeHistoryItem, type HistoryItem } from './history';

function item(animeId: string, updatedAt: number, episodeNumber = '1'): HistoryItem {
  return {
    animeId,
    title: `Anime ${animeId}`,
    poster: null,
    episodeNumber,
    episodeSlug: `${animeId}-episode-${episodeNumber}`,
    episodeTitle: null,
    updatedAt,
    position: 0,
  };
}

test('data history tidak valid ditolak', () => {
  assert.equal(sanitizeHistoryItem(null), null);
  assert.equal(sanitizeHistoryItem({}), null);
  assert.equal(sanitizeHistoryItem({ animeId: '', title: 'x' }), null);
  assert.equal(sanitizeHistoryItem({ animeId: 'a', title: '' }), null);
});

test('timestamp dan posisi dibersihkan', () => {
  const clean = sanitizeHistoryItem({ animeId: 'a', title: 'A', updatedAt: -5, position: -2 });
  assert.ok(clean);
  assert.equal(clean.position, 0);
  assert.ok(clean.updatedAt > 0);
});

test('merge memakai timestamp terbaru dan tidak menduplikasi anime', () => {
  const merged = mergeHistoryItems([item('a', 200, '3'), item('b', 100)], [item('a', 150, '2')]);
  assert.equal(merged.length, 2);
  const a = merged.find((entry) => entry.animeId === 'a');
  assert.equal(a?.updatedAt, 200);
  assert.equal(a?.episodeNumber, '3');
  assert.equal(merged[0].animeId, 'a', 'urut dari yang paling baru');
});

test('history akun yang lebih baru tidak ditimpa data tamu lama', () => {
  const merged = mergeHistoryItems([item('a', 100, '2')], [item('a', 300, '5')]);
  assert.equal(merged[0].episodeNumber, '5');
});

test('hasil merge dibatasi 100 anime', () => {
  const guest = Array.from({ length: 120 }, (_, index) => item(`g${index}`, 1000 + index));
  const merged = mergeHistoryItems(guest, []);
  assert.equal(merged.length, HISTORY_LIMIT);
});
