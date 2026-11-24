import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeOAuthReturnTo } from './oauth';

test('OAuth returnTo permits same-origin relative paths and rejects external redirects', () => {
  const requestUrl = 'https://aznime.example/api/auth/oauth/google';

  assert.equal(normalizeOAuthReturnTo('/profile?tab=history#top', requestUrl), '/profile?tab=history#top');
  assert.equal(normalizeOAuthReturnTo('//attacker.example', requestUrl), '/');
  assert.equal(normalizeOAuthReturnTo('/\\attacker.example', requestUrl), '/');
  assert.equal(normalizeOAuthReturnTo('https://attacker.example', requestUrl), '/');
  assert.equal(normalizeOAuthReturnTo(null, requestUrl), '/');
});
