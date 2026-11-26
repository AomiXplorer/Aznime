import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { after, before, test } from 'node:test';
import { PGlite } from '@electric-sql/pglite';

const db = new PGlite();
const first = 'f24c37a2-84ce-4388-8237-d128977c8311';
const second = 'e24c37a2-84ce-4388-8237-d128977c8312';
const migration = new URL('../../supabase/migrations/20261126143703_hybrid_persistence.sql', import.meta.url);
const profile = (id: string, email: string) => ({
  id, email, username: 'Test Account', provider: 'google', provider_id: id, avatar: '',
  password_hash: '', created_at: '2026-01-01T00:00:00.000Z', updated_at: '2026-01-01T00:00:00.000Z',
});
const history = (animeId: string, updatedAt: number, position = 0) =>
  ({ animeId, title: animeId, updatedAt, position, poster: null, episodeNumber: '2', episodeSlug: 'episode-2', episodeTitle: null });

before(async () => {
  await db.exec('create role anon; create role authenticated; create role service_role bypassrls;');
  await db.exec(await readFile(migration, 'utf8'));
  await db.exec('set role service_role;');
  for (const id of [first, second]) {
    await db.query('select public.aznime_import_account($1::jsonb,$2::jsonb)', [JSON.stringify(profile(id, id + '@example.test')), '[]']);
  }
});
after(async () => db.close());

async function mutate<T>(user: string, kind: string, action: string, items: unknown[], animeId: string | null = null) {
  const { rows } = await db.query<{ result: T }>(
    'select public.aznime_mutate_library($1,$2,$3,$4::jsonb,$5) as result',
    [user, kind, action, JSON.stringify(items), animeId],
  );
  return rows[0].result;
}

test('migration imports accounts, rejects duplicate identities and preserves source snapshots', async () => {
  const id = 'c24c37a2-84ce-4388-8237-d128977c8313';
  const user = profile(id, 'third@example.test');
  const item = { kind: 'history', item: history('imported', 333, 17) };
  for (let i = 0; i < 2; i += 1) {
    await db.query('select public.aznime_import_account($1::jsonb,$2::jsonb)', [JSON.stringify(user), JSON.stringify([item])]);
  }
  await assert.rejects(db.query('select public.aznime_import_account($1::jsonb,$2::jsonb)',
    [JSON.stringify({ ...user, email: 'conflict@example.test' }), JSON.stringify([item])]), { code: '23505' });
  await assert.rejects(db.query('select public.aznime_import_account($1::jsonb,$2::jsonb)',
    [JSON.stringify({ ...user, id: 'a24c37a2-84ce-4388-8237-d128977c8314' }), '[]']), { code: '23505' });
  assert.deepEqual(
    (await db.query('select item from public.aznime_library_entries where user_id = $1', [id])).rows,
    [{ item: item.item }],
  );
});

test('history, watch progress and favorite CRUD use isolated keys and version fences', async () => {
  const original = (await db.query('select history_version from public.aznime_users where id=$1', [first])).rows;
  assert.deepEqual(await mutate(first, 'history', 'put', [history('shared', 200, 90)]), history('shared', 200, 90));
  assert.deepEqual(await mutate(first, 'history', 'put', [history('shared', 100, 1)]), history('shared', 200, 90));
  await mutate(second, 'history', 'put', [history('shared', 400, 12)]);
  const favorite = { animeId: 'shared', title: 'shared', poster: null, addedAt: 100 };
  assert.deepEqual(await mutate(first, 'favorites', 'put', [favorite]), favorite);
  assert.notDeepEqual((await db.query('select history_version from public.aznime_users where id=$1', [first])).rows, original);
  const stats = (id: string) => db.query('select public.aznime_account_counts($1) as stats', [id]);
  assert.deepEqual((await stats(first)).rows, [{ stats: { history: 1, favorites: 1 } }]);
  assert.deepEqual((await stats(second)).rows, [{ stats: { history: 1, favorites: 0 } }]);
  await mutate(first, 'history', 'delete', [], 'shared');
  await mutate(first, 'favorites', 'delete', [], 'shared');
  assert.deepEqual((await stats(first)).rows, [{ stats: { history: 0, favorites: 0 } }]);
  assert.deepEqual((await stats(second)).rows, [{ stats: { history: 1, favorites: 0 } }]);
});

test('history sync returns newest first and enforces the existing bound in storage', async () => {
  const items = Array.from({ length: 150 }, (_, i) => history('series-' + i, 1000 + i, i));
  const results = await mutate<ReturnType<typeof history>[]>(first, 'history', 'sync', items);
  assert.equal(results.length, 100);
  assert.equal(results[0].position, 149);
  assert.equal(results[99].position, 50);
  assert.deepEqual(
    (await db.query("select count(*)::int as total from public.aznime_library_entries where user_id=$1 and kind='history'", [first])).rows,
    [{ total: 100 }],
  );
});

test('untrusted database roles cannot read records or invoke privileged RPCs', async () => {
  for (const role of ['anon', 'authenticated']) {
    await db.exec('reset role; set role ' + role);
    try {
      for (const table of ['aznime_users', 'aznime_library_entries', 'aznime_maintenance']) {
        await assert.rejects(db.query('select 1 from public.' + table), { code: '42501' });
      }
      await assert.rejects(db.query('select public.aznime_account_counts($1)', [first]), { code: '42501' });
      await assert.rejects(mutate(first, 'history', 'delete', [], 'shared'), { code: '42501' });
      await assert.rejects(db.query("select public.aznime_import_account('{}','[]')"), { code: '42501' });
    } finally {
      await db.exec('reset role; set role service_role');
    }
  }
  const tables = await db.query("select relrowsecurity as enabled from pg_class where relname in ('aznime_users','aznime_library_entries','aznime_maintenance')");
  assert.deepEqual(tables.rows, [{ enabled: true }, { enabled: true }, { enabled: true }]);
});
