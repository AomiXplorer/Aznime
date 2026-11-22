import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeRetryAfterSeconds,
  consumePendingAction,
  createBypassToken,
  formatDurationLabel,
  getMaintenanceState,
  invalidateMaintenanceCache,
  isAuthorizedTelegramAdmin,
  parseAdminIds,
  parseDurationMinutes,
  parseMaintenanceOnArgs,
  savePendingAction,
  setMaintenanceState,
  timingSafeEqualString,
  verifyBypassToken,
} from './maintenance';

test('parseDurationMinutes mengenali format menit, jam, dan hari', () => {
  assert.equal(parseDurationMinutes('30m'), 30);
  assert.equal(parseDurationMinutes('15menit'), 15);
  assert.equal(parseDurationMinutes('2h'), 120);
  assert.equal(parseDurationMinutes('2j'), 120);
  assert.equal(parseDurationMinutes('1.5jam'), 90);
  assert.equal(parseDurationMinutes('1d'), 1440);
  assert.equal(parseDurationMinutes('abc'), null);
  assert.equal(parseDurationMinutes('0m'), null);
});

test('parseMaintenanceOnArgs memisahkan durasi opsional dan pesan kustom', () => {
  assert.deepEqual(parseMaintenanceOnArgs('30m Perbaikan mirror server'), {
    durationMinutes: 30,
    message: 'Perbaikan mirror server',
  });
  assert.deepEqual(parseMaintenanceOnArgs('1j'), {
    durationMinutes: 60,
    message: '',
  });
  assert.deepEqual(parseMaintenanceOnArgs('Sedang update katalog'), {
    durationMinutes: null,
    message: 'Sedang update katalog',
  });
  assert.deepEqual(parseMaintenanceOnArgs(''), {
    durationMinutes: null,
    message: '',
  });
});

test('formatDurationLabel menghasilkan label ramah bahasa Indonesia', () => {
  assert.equal(formatDurationLabel(null), 'Tanpa batas waktu');
  assert.equal(formatDurationLabel(45), '45 menit');
  assert.equal(formatDurationLabel(120), '2 jam');
  assert.equal(formatDurationLabel(90), '1 jam 30 menit');
});

test('createBypassToken dan verifyBypassToken memvalidasi tanda tangan dan masa berlaku', async () => {
  const now = 1_800_000_000;
  const token = await createBypassToken(600, now);
  assert.equal(await verifyBypassToken(token, now + 100), true);
  assert.equal(await verifyBypassToken(token, now + 700), false);

  const [exp, sig] = token.split('.');
  const tampered = `${exp}.${sig.slice(0, -1)}${sig.endsWith('a') ? 'b' : 'a'}`;
  assert.equal(await verifyBypassToken(tampered, now + 100), false);
  assert.equal(await verifyBypassToken('invalid-token', now), false);
});

test('timingSafeEqualString membandingkan panjang dan isi secara akurat', () => {
  assert.equal(timingSafeEqualString('secret-123', 'secret-123'), true);
  assert.equal(timingSafeEqualString('secret-123', 'secret-124'), false);
  assert.equal(timingSafeEqualString('secret', 'secret-longer'), false);
});

test('parseAdminIds dan isAuthorizedTelegramAdmin membatasi ID admin', () => {
  const prev = process.env.TELEGRAM_ADMIN_IDS;
  process.env.TELEGRAM_ADMIN_IDS = '111222, 333444, invalid';
  try {
    const parsed = parseAdminIds();
    assert.deepEqual([...parsed], [111222, 333444]);
    assert.equal(isAuthorizedTelegramAdmin(111222, 999), true);
    assert.equal(isAuthorizedTelegramAdmin(999, 333444), true);
    assert.equal(isAuthorizedTelegramAdmin(555, 666), false);
  } finally {
    if (prev === undefined) delete process.env.TELEGRAM_ADMIN_IDS;
    else process.env.TELEGRAM_ADMIN_IDS = prev;
  }
});

test('setMaintenanceState, getMaintenanceState, dan pending action bekerja dengan store fallback', async () => {
  const prevUrl = process.env.UPSTASH_REDIS_REST_URL;
  const prevToken = process.env.UPSTASH_REDIS_REST_TOKEN;
  delete process.env.UPSTASH_REDIS_REST_URL;
  delete process.env.UPSTASH_REDIS_REST_TOKEN;

  try {
    invalidateMaintenanceCache();
    await setMaintenanceState({
      enabled: true,
      message: 'Migrasi scraper baru',
      startedAt: '2026-11-22T10:00:00.000Z',
      endsAt: '2026-11-22T10:30:00.000Z',
      updatedBy: 'Aomi',
      updatedAt: '2026-11-22T10:00:00.000Z',
    });

    const state = await getMaintenanceState();
    assert.equal(state.enabled, true);
    assert.equal(state.message, 'Migrasi scraper baru');

    const pending = await savePendingAction({
      action: 'disable',
      durationMinutes: null,
      message: '',
      requestedBy: 'Aomi',
      chatId: 111222,
    });
    const consumed = await consumePendingAction(pending.id);
    assert.ok(consumed);
    assert.equal(consumed.action, 'disable');
    assert.equal(await consumePendingAction(pending.id), null);

    await setMaintenanceState({
      enabled: false,
      message: 'Normal',
      startedAt: null,
      endsAt: null,
      updatedBy: 'Aomi',
      updatedAt: '2026-11-22T10:30:00.000Z',
    });
  } finally {
    if (prevUrl !== undefined) process.env.UPSTASH_REDIS_REST_URL = prevUrl;
    if (prevToken !== undefined) process.env.UPSTASH_REDIS_REST_TOKEN = prevToken;
  }
});

test('computeRetryAfterSeconds menjaga batas aman header Retry-After', () => {
  const now = Date.parse('2026-11-22T10:00:00.000Z');
  assert.equal(computeRetryAfterSeconds(null, now), 300);
  assert.equal(computeRetryAfterSeconds('2026-11-22T10:15:00.000Z', now), 900);
  assert.equal(computeRetryAfterSeconds('2026-11-22T09:50:00.000Z', now), 120);
});
