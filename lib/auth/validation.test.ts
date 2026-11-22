import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeEmail,
  usernameFromEmail,
  validateEmail,
  validatePassword,
  validatePasswordConfirm,
  validateUsername,
} from './validation';

test('email dinormalisasi dan divalidasi', () => {
  assert.equal(normalizeEmail('  Nana@Example.COM '), 'nana@example.com');
  assert.equal(validateEmail('nana@example.com'), null);
  assert.equal(validateEmail('nana@example')?.field, 'email');
  assert.equal(validateEmail('')?.field, 'email');
  assert.equal(validateEmail('a'.repeat(250) + '@x.com')?.field, 'email');
});

test('password minimal 8 karakter dan maksimal 128', () => {
  assert.equal(validatePassword('rahasia123'), null);
  assert.equal(validatePassword('pendek')?.field, 'password');
  assert.equal(validatePassword('')?.field, 'password');
  assert.equal(validatePassword('a'.repeat(129))?.field, 'password');
});

test('konfirmasi password harus sama', () => {
  assert.equal(validatePasswordConfirm('rahasia123', 'rahasia123'), null);
  assert.equal(validatePasswordConfirm('rahasia123', 'rahasia124')?.field, 'confirmPassword');
  assert.equal(validatePasswordConfirm('rahasia123', '')?.field, 'confirmPassword');
});

test('username opsional tetapi punya aturan', () => {
  assert.equal(validateUsername(''), null);
  assert.equal(validateUsername('nana_22'), null);
  assert.equal(validateUsername('na')?.field, 'username');
  assert.equal(validateUsername('nana space')?.field, 'username');
});

test('username turunan email selalu memenuhi aturan', () => {
  const derived = usernameFromEmail('nana@example.com');
  assert.equal(validateUsername(derived), null);
  assert.equal(usernameFromEmail('ab@example.com').length >= 3, true);
});
