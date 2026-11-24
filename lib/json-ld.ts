const JSON_LD_ESCAPES: Record<string, string> = {
  '&': '\\u0026',
  '<': '\\u003c',
  '>': '\\u003e',
  '\u2028': '\\u2028',
  '\u2029': '\\u2029',
};

export function serializeJsonLd(value: object): string {
  const serialized = JSON.stringify(value);
  if (serialized === undefined) {
    throw new TypeError('JSON-LD data could not be serialized');
  }
  return serialized.replace(/[&<>\u2028\u2029]/g, (character) => JSON_LD_ESCAPES[character]);
}
