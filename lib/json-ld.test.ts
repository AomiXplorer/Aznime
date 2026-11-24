import test from 'node:test';
import assert from 'node:assert/strict';
import { serializeJsonLd } from './json-ld';

test('serializeJsonLd escapes characters that are unsafe inside script elements', () => {
  const value = {
    title: '</script><script>alert("xss")</script>',
    text: '& > \u2028 \u2029',
  };

  const serialized = serializeJsonLd(value);

  assert.doesNotMatch(serialized, /[<>&\u2028\u2029]/);
  assert.deepEqual(JSON.parse(serialized), value);
});
