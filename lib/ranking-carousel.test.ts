import test from 'node:test';
import assert from 'node:assert/strict';
import { circularOffset, isWrapJump, stepIndex } from './ranking-carousel';

test('circularOffset menempatkan kartu aktif di tengah dan sisanya melingkar (5 item)', () => {
  assert.deepEqual([0, 1, 2, 3, 4].map((i) => circularOffset(i, 0, 5)), [0, 1, 2, -2, -1]);
  assert.deepEqual([0, 1, 2, 3, 4].map((i) => circularOffset(i, 2, 5)), [-2, -1, 0, 1, 2]);
  assert.deepEqual([0, 1, 2, 3, 4].map((i) => circularOffset(i, 4, 5)), [1, 2, -2, -1, 0]);
});

test('circularOffset aman untuk jumlah item kecil', () => {
  assert.equal(circularOffset(0, 0, 1), 0);
  assert.deepEqual([0, 1].map((i) => circularOffset(i, 0, 2)), [0, -1]);
  assert.equal(circularOffset(0, 0, 0), 0);
});

test('stepIndex wrap ke kedua arah', () => {
  assert.equal(stepIndex(4, 1, 5), 0);
  assert.equal(stepIndex(0, -1, 5), 4);
  assert.equal(stepIndex(2, 2, 5), 4);
  assert.equal(stepIndex(0, 1, 0), 0);
});

test('isWrapJump hanya true saat kartu menyeberang sisi', () => {
  // Geser 1 langkah: hanya kartu di ujung yang menyeberang (-2 -> 2).
  const n = 5;
  const moves = [0, 1, 2, 3, 4].map((i) =>
    isWrapJump(circularOffset(i, 0, n), circularOffset(i, 1, n), n)
  );
  assert.deepEqual(moves, [false, false, false, true, false]);
  // Lompat 2 langkah lewat dot: perpindahan 2 tetap mulus.
  assert.equal(isWrapJump(0, -2, n), false);
});
