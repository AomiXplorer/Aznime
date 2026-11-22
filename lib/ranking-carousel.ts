/**
 * Matematika posisi carousel melingkar untuk Top 5 populer.
 * Dipisah dari komponen agar murni (tanpa React/DOM) dan mudah dites.
 */

/** Posisi relatif kartu terhadap kartu aktif: 0 = tengah, -1 = kiri, 1 = kanan, dst. */
export function circularOffset(index: number, active: number, length: number): number {
  if (length <= 0) return 0;
  const half = Math.floor(length / 2);
  return ((((index - active + half) % length) + length) % length) - half;
}

/** Geser index aktif sebanyak `delta` dengan wrap-around. */
export function stepIndex(active: number, delta: number, length: number): number {
  if (length <= 0) return 0;
  return (((active + delta) % length) + length) % length;
}

/**
 * True bila kartu "menyeberang" dari satu sisi ke sisi lain (wrap-around).
 * Kartu seperti ini sebaiknya dipindah tanpa transisi supaya tidak melintas
 * di belakang kartu lain.
 */
export function isWrapJump(prevOffset: number, nextOffset: number, length: number): boolean {
  return Math.abs(nextOffset - prevOffset) > Math.floor(length / 2);
}
