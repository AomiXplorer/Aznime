import test from 'node:test';
import assert from 'node:assert/strict';
import { hashPassword, randomToken, sessionTokenHash, sha256Hex, verifyPassword } from './crypto';

test('password di-hash dengan salt acak dan tidak menyimpan plaintext', () => {
  const a = hashPassword('rahasia123');
  const b = hashPassword('rahasia123');
  assert.notEqual(a, b, 'dua hash password yang sama harus berbeda karena salt acak');
  assert.ok(a.startsWith('scrypt$16384$8$1$'));
  assert.ok(!a.includes('rahasia123'));
});

test('verifikasi password benar dan salah', () => {
  const stored = hashPassword('rahasia123');
  assert.equal(verifyPassword('rahasia123', stored), true);
  assert.equal(verifyPassword('rahasia124', stored), false);
  assert.equal(verifyPassword('rahasia123', null), false);
  assert.equal(verifyPassword('rahasia123', 'bukan-hash'), false);
});

test('token session acak dan hash-nya stabil', () => {
  const token = randomToken(32);
  assert.equal(token.length >= 40, true);
  assert.notEqual(randomToken(32), randomToken(32));
  process.env.AUTH_SECRET = 'pepper-uji';
  assert.equal(sessionTokenHash(token), sessionTokenHash(token));
  assert.equal(sessionTokenHash(token), sha256Hex(`${token}.pepper-uji`));
});
