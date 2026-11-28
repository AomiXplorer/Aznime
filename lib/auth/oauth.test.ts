import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeOAuthReturnTo, oauthOrigin, oauthRedirectUri } from './oauth';

test('OAuth returnTo permits same-origin relative paths and rejects external redirects', () => {
  const requestUrl = 'https://aznime.example/api/auth/oauth/google';

  assert.equal(normalizeOAuthReturnTo('/profile?tab=history#top', requestUrl), '/profile?tab=history#top');
  assert.equal(normalizeOAuthReturnTo('//attacker.example', requestUrl), '/');
  assert.equal(normalizeOAuthReturnTo('/\\attacker.example', requestUrl), '/');
  assert.equal(normalizeOAuthReturnTo('/profile/..//attacker.example', requestUrl), '/');
  assert.equal(normalizeOAuthReturnTo('/%2e//attacker.example', requestUrl), '/');
  assert.equal(normalizeOAuthReturnTo('https://attacker.example', requestUrl), '/');
  assert.equal(normalizeOAuthReturnTo(null, requestUrl), '/');
});

test('OAuth uses the public origin when the proxy presents a localhost request', (t) => {
  const original = process.env.AUTH_URL;
  t.after(() => {
    if (original === undefined) delete process.env.AUTH_URL;
    else process.env.AUTH_URL = original;
  });

  const requestUrl = 'https://localhost:3543/api/auth/oauth/google/callback';
  process.env.AUTH_URL = 'https://aznime.com/';
  assert.equal(oauthOrigin(requestUrl), 'https://aznime.com');
  assert.equal(oauthRedirectUri('google', requestUrl), 'https://aznime.com/api/auth/oauth/google/callback');
  assert.equal(oauthRedirectUri('discord', requestUrl), 'https://aznime.com/api/auth/oauth/discord/callback');

  delete process.env.AUTH_URL;
  assert.equal(oauthOrigin(requestUrl), 'https://localhost:3543');
});
