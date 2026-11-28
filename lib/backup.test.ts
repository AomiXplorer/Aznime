import assert from 'node:assert/strict';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { gunzipSync } from 'node:zlib';
import { createPanelBackup, formatBytes } from './backup';

async function makePanelRoot(): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), 'aznime-panel-'));
  const release = 'abc1234';

  await mkdir(path.join(root, 'production', 'shared'), { recursive: true });
  await mkdir(path.join(root, 'production', 'releases', release, 'lib'), { recursive: true });
  await mkdir(path.join(root, 'production', 'releases', release, 'node_modules', 'pkg'), {
    recursive: true,
  });
  await mkdir(path.join(root, 'production', 'releases', release, '.next', 'cache'), {
    recursive: true,
  });

  await writeFile(path.join(root, 'start-aznime.mjs'), 'node production/pterodactyl.mjs\n');
  await writeFile(path.join(root, 'production', 'pterodactyl.mjs'), 'supervisor\n');
  await writeFile(
    path.join(root, 'production', 'shared', 'release.json'),
    JSON.stringify({ current: release, previous: null })
  );
  await writeFile(path.join(root, 'production', 'shared', 'runtime.env'), 'A=1\n');
  await writeFile(path.join(root, 'production', 'releases', release, 'lib', 'a.ts'), 'export {};\n');
  await writeFile(
    path.join(root, 'production', 'releases', release, 'node_modules', 'pkg', 'index.js'),
    'dep\n'
  );
  await writeFile(path.join(root, 'production', 'releases', release, '.next', 'cache', 'x.js'), 'x\n');

  return root;
}

test('arsip panel memuat data server tanpa node_modules, .next, dan cache', async () => {
  const root = await makePanelRoot();
  const previous = process.env.AZNIME_PANEL_ROOT;
  process.env.AZNIME_PANEL_ROOT = root;

  try {
    const file = await createPanelBackup();
    const raw = gunzipSync(file.data).toString('utf8');

    assert.match(file.filename, /^aznime-panel-abc1234-\d{8}-\d{4}\.tar\.gz$/);
    assert.ok(raw.includes('start-aznime.mjs'), 'skrip start ikut');
    assert.ok(raw.includes('production/pterodactyl.mjs'), 'pengawas rilis ikut');
    assert.ok(raw.includes('production/shared/runtime.env'), 'runtime.env ikut');
    assert.ok(raw.includes('production/releases/abc1234/lib/a.ts'), 'rilis aktif ikut');
    assert.ok(!raw.includes('node_modules'), 'node_modules tidak boleh ikut');
    assert.ok(!raw.includes('.next/cache'), 'hasil build tidak boleh ikut');
  } finally {
    if (previous === undefined) delete process.env.AZNIME_PANEL_ROOT;
    else process.env.AZNIME_PANEL_ROOT = previous;
  }
});

test('arsip panel ditolak saat folder panel tidak ditemukan', async () => {
  const previous = process.env.AZNIME_PANEL_ROOT;
  process.env.AZNIME_PANEL_ROOT = path.join(tmpdir(), 'aznime-tidak-ada-xyz');

  try {
    await assert.rejects(createPanelBackup(), /Folder panel tidak ditemukan/);
  } finally {
    if (previous === undefined) delete process.env.AZNIME_PANEL_ROOT;
    else process.env.AZNIME_PANEL_ROOT = previous;
  }
});

test('formatBytes menulis ukuran yang mudah dibaca', () => {
  assert.equal(formatBytes(512), '512 B');
  assert.equal(formatBytes(2048), '2 KB');
  assert.equal(formatBytes(5 * 1024 * 1024), '5.0 MB');
});
