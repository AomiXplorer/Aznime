import { mkdir, open, readFile } from 'node:fs/promises';
import { basename, dirname, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { hashGet, hashGetAll, isRedisConfigured, kvGet, redisCommand } from '../lib/auth/redis';
import { database } from '../lib/db/supabase';
import { accountRow } from '../lib/db/accounts';
import { maintenanceRow } from '../lib/db/maintenance';
import type { StoredUser } from '../lib/auth/users';
import type { MaintenanceState } from '../lib/maintenance';

type Hash = Record<string, string>;
type LegacyValue = string | null | Hash | (string | number)[];
type Snapshot = { format: 1; scope?: 'history'; keys: Record<string, LegacyValue> };
type Item = Record<string, unknown>;
type Entry = { kind: 'history' | 'favorites'; item: Item };

const maintenanceKey = 'aznime:maintenance:state';
const uuid = /^[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}$/i;
const accounts = /^user:([\da-f-]{36})(?::(favorites|history)(:data)?)?$/i;
const lookup = /^(?:user:email:|oauth:(?:google|discord):)/;
const durable = (key: string) => accounts.test(key) || lookup.test(key) || key === maintenanceKey;

function ordered(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(ordered);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => [k, ordered(v)]));
  }
  return value;
}

function canonical(value: unknown): string {
  return JSON.stringify(ordered(value));
}

function digest(snapshot: Snapshot) {
  return createHash('sha256').update(canonical(snapshot)).digest('hex');
}

async function exportSnapshot(historyOnly: boolean): Promise<Snapshot> {
  if (!isRedisConfigured()) throw new Error('Configure the Upstash REST credentials.');
  let cursor = '0';
  const keys = new Set<string>();
  do {
    const [next, values] = await redisCommand<[string | number, string[]]>('SCAN', cursor, 'COUNT', 500);
    cursor = String(next);
    for (const key of values) {
      if (historyOnly) {
        const match = accounts.exec(key);
        if (match?.[2] === 'history') {
          keys.add(key);
          keys.add(`user:${match[1]}`);
        }
      } else if (durable(key)) {
        keys.add(key);
      }
    }
  } while (cursor !== '0');

  const output: Snapshot = { format: 1, ...(historyOnly ? { scope: 'history' as const } : {}), keys: {} };
  const names = [...keys].sort();
  for (let offset = 0; offset < names.length; offset += 16) {
    await Promise.all(names.slice(offset, offset + 16).map(async key => {
      const match = accounts.exec(key);
      output.keys[key] = match
        ? match[2] && !match[3]
          ? await redisCommand<(string | number)[]>('ZREVRANGE', key, 0, -1, 'WITHSCORES')
          : historyOnly && !match[2]
            ? { id: (await hashGet(key, 'id')) ?? '' }
            : await hashGetAll(key)
        : await kvGet(key);
    }));
  }
  return output;
}

function readAccount(raw: LegacyValue): StoredUser | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const { id, username, email, provider, createdAt, updatedAt } = raw;
  if (!id || !uuid.test(id) || !username || !email || email !== email.trim().toLowerCase() ||
      !['email', 'google', 'discord'].includes(provider) || !createdAt || !updatedAt ||
      !Number.isFinite(Date.parse(createdAt)) || !Number.isFinite(Date.parse(updatedAt)) ||
      (provider !== 'email' && !raw.providerId) ||
      (provider === 'email' && !/^scrypt\$\d+\$\d+\$\d+\$[A-Za-z0-9+/=]+\$[A-Za-z0-9+/=]+$/.test(raw.passwordHash || ''))) return null;
  return {
    id, username, email, provider: provider as StoredUser['provider'],
    avatar: raw.avatar || '', providerId: raw.providerId || '', passwordHash: raw.passwordHash || '',
    createdAt: new Date(createdAt).toISOString(), updatedAt: new Date(updatedAt).toISOString(),
  };
}

function validItem(item: Item, id: string, kind: Entry['kind']): boolean {
  const timestamp = item[kind === 'history' ? 'updatedAt' : 'addedAt'];
  const nullable = (value: unknown, max: number) => value === null || (typeof value === 'string' && value.length <= max);
  return id.length >= 1 && id.length <= 200 && item.animeId === id &&
    typeof item.title === 'string' && item.title.trim().length > 0 && item.title.length <= 300 &&
    nullable(item.poster, 500) && typeof timestamp === 'number' && Number.isFinite(timestamp) &&
    timestamp >= 0 && timestamp < 8640000000000000 &&
    (kind === 'favorites' || (
      timestamp > 0 && nullable(item.episodeNumber, 20) && nullable(item.episodeSlug, 300) &&
      nullable(item.episodeTitle, 300) && typeof item.position === 'number' &&
      Number.isInteger(item.position) && item.position >= 0
    ));
}

function validate(snapshot: Snapshot) {
  const users = new Map<string, { user: StoredUser | { id: string }; entries: Entry[] }>();
  const historyOnly = snapshot.scope === 'history';
  const expected = new Map<string, string>();
  const issues: Record<string, number> = {};
  const issue = (label: string) => { issues[label] = (issues[label] || 0) + 1; };
  const keys = snapshot.keys;

  for (const [key, raw] of Object.entries(keys)) {
    const match = accounts.exec(key);
    if (historyOnly ? !match || (match[2] && match[2] !== 'history') : !durable(key)) {
      issue('unknown-key');
      continue;
    }
    if (!match || match[2]) continue;
    if (historyOnly) {
      if (!uuid.test(match[1]) || !raw || typeof raw !== 'object' || Array.isArray(raw) ||
          Object.keys(raw).length !== 1 || raw.id !== match[1]) {
        issue('invalid-history-owner');
      } else users.set(raw.id, { user: { id: raw.id }, entries: [] });
      continue;
    }
    const user = readAccount(raw);
    if (!user || user.id !== match[1]) { issue('invalid-user'); continue; }
    users.set(user.id, { user, entries: [] });
    const indexes = [`user:email:${user.email}`];
    if (user.provider !== 'email') indexes.push(`oauth:${user.provider}:${user.providerId}`);
    for (const index of indexes) {
      if (expected.has(index)) issue('duplicate-identity');
      expected.set(index, user.id);
      if (keys[index] !== user.id) issue('missing-or-inconsistent-index');
    }
  }

  for (const [key, raw] of Object.entries(keys)) {
    if (lookup.test(key) && (!expected.has(key) || expected.get(key) !== raw)) issue('orphan-identity-index');
    const match = accounts.exec(key);
    if (match?.[2] && !users.has(match[1])) issue('orphan-library');
  }

  for (const { user, entries } of users.values()) {
    for (const kind of (historyOnly ? ['history'] as const : ['favorites', 'history'] as const)) {
      const index = keys[`user:${user.id}:${kind}`] ?? [];
      const payload = keys[`user:${user.id}:${kind}:data`] ?? {};
      if (!Array.isArray(index) || index.length % 2 || !payload || Array.isArray(payload) || typeof payload !== 'object') {
        issue('invalid-library-shape');
        continue;
      }
      if (index.length / 2 > (kind === 'history' ? 100 : 500)) issue('library-over-cap');
      const seen = new Set<string>();
      for (let i = 0; i < index.length; i += 2) {
        const id = index[i];
        if (typeof id !== 'string' || seen.has(id) || !Object.hasOwn(payload, id)) {
          issue('missing-or-duplicate-library-member');
          continue;
        }
        seen.add(id);
        try {
          const item = JSON.parse(payload[id]) as Item;
          if (!item || typeof item !== 'object' || !validItem(item, id, kind) ||
            Number(index[i + 1]) !== item[kind === 'history' ? 'updatedAt' : 'addedAt']) {
            issue('invalid-or-inconsistent-library-item');
            continue;
          }
          entries.push({ kind, item });
        } catch {
          issue('invalid-library-json');
        }
      }
      if (Object.keys(payload).some(id => !seen.has(id))) issue('orphan-library-payload');
    }
  }

  let maintenance: MaintenanceState | null = null;
  if (Object.hasOwn(keys, maintenanceKey)) {
    try {
      const raw = keys[maintenanceKey];
      if (typeof raw !== 'string') throw new Error();
      const state = JSON.parse(raw) as MaintenanceState;
      if (typeof state.enabled !== 'boolean' || typeof state.message !== 'string' ||
          !state.message.trim() || state.message.length > 500 ||
          (state.updatedBy !== null && typeof state.updatedBy !== 'string')) throw new Error();
      for (const key of ['startedAt', 'endsAt', 'updatedAt'] as const) {
        if (state[key] !== null) {
          if (typeof state[key] !== 'string') throw new Error();
          state[key] = new Date(state[key]).toISOString();
        }
      }
      maintenance = state;
    } catch {
      issue('invalid-maintenance-state');
    }
  }

  return {
    users, maintenance, issues, historyOnly,
    counts: {
      accounts: users.size, maintenance: Number(Boolean(maintenance)),
      favorites: [...users.values()].reduce((n, user) => n + user.entries.filter(e => e.kind === 'favorites').length, 0),
      history: [...users.values()].reduce((n, user) => n + user.entries.filter(e => e.kind === 'history').length, 0),
    },
  };
}

async function verifyDatabase(report: ReturnType<typeof validate>) {
  const db = database();
  const expected = [
    ['aznime_users', 'id', report.counts.accounts], ['aznime_library_entries', 'user_id', report.counts.history + report.counts.favorites],
    ['aznime_maintenance', 'singleton', report.counts.maintenance],
  ] as const;
  if (report.historyOnly) {
    const { error, count } = await db.from('aznime_library_entries').select('user_id', { count: 'exact', head: true }).eq('kind', 'history');
    if (error || count !== report.counts.history) throw new Error('Target count mismatch: history');
  }
  for (const [table, column, total] of report.historyOnly ? [] : expected) {
    const { error, count } = await db.from(table).select(column, { count: 'exact', head: true });
    if (error || count !== total) throw new Error(`Target count mismatch: ${table}`);
  }
  for (const { user, entries } of report.users.values()) {
    if (report.historyOnly) {
      const { data, error } = await db.from('aznime_library_entries').select('kind,item')
        .eq('user_id', user.id).eq('kind', 'history').order('anime_id', { ascending: true }).limit(100);
      const sorted = (items: Entry[]) => [...items].sort((a, b) => String(a.item.animeId).localeCompare(String(b.item.animeId)));
      if (error || !data || canonical(sorted(data)) !== canonical(sorted(entries))) throw new Error('Target history content mismatch.');
      continue;
    }
    if (!('email' in user)) throw new Error('Invalid backup account.');
    const row = accountRow(user);
    const [account, library] = await Promise.all([
      db.from('aznime_users').select('id,username,email,avatar,provider,provider_id,password_hash,created_at,updated_at').eq('id', user.id).single(),
      db.from('aznime_library_entries').select('kind,item').eq('user_id', user.id).range(0, 599),
    ]);
    if (account.error || library.error || !account.data || !library.data) throw new Error('Target verification read failed.');
    const actual = { ...account.data,
      created_at: new Date(account.data.created_at).toISOString(),
      updated_at: new Date(account.data.updated_at).toISOString(),
    };
    const sorted = (items: Entry[]) => [...items].sort((a, b) =>
      a.kind.localeCompare(b.kind) || String(a.item.animeId).localeCompare(String(b.item.animeId)));
    if (canonical(actual) !== canonical(row) || canonical(sorted(library.data)) !== canonical(sorted(entries))) {
      throw new Error('Target account or library content mismatch.');
    }
  }
  if (report.maintenance) {
    const { data, error } = await db.from('aznime_maintenance')
      .select('singleton,enabled,message,started_at,ends_at,updated_by,updated_at').eq('singleton', true).single();
    if (error || !data) throw new Error('Target maintenance verification read failed.');
    for (const key of ['started_at', 'ends_at', 'updated_at'] as const) {
      if (data[key]) data[key] = new Date(data[key]).toISOString();
    }
    if (canonical(data) !== canonical(maintenanceRow(report.maintenance))) throw new Error('Target maintenance content mismatch.');
  }
}

async function main() {
  const [command, file, confirmation] = process.argv.slice(2);
  if (!file || !['backup', 'validate', 'import', 'verify'].includes(command)) {
    throw new Error('Usage: redis-to-postgres.ts backup|validate|import|verify <snapshot.json> [--confirm-frozen-source]');
  }
  const path = resolve(file);
  if (dirname(path) !== resolve('.aznime-backups') || !basename(path).endsWith('.json')) {
    throw new Error('Use a .json snapshot in .aznime-backups/.');
  }

  const scope = process.env.AZNIME_MIGRATION_SCOPE?.trim();
  if (scope && scope !== 'full' && scope !== 'history') throw new Error('Configure AZNIME_MIGRATION_SCOPE as full or history.');
  const historyOnly = scope === 'history';
  let snapshot: Snapshot;
  if (command === 'backup') {
    snapshot = await exportSnapshot(historyOnly);
    await mkdir(dirname(path), { recursive: true, mode: 0o700 });
    const handle = await open(path, 'wx', 0o600);
    try { await handle.writeFile(canonical(snapshot)); } finally { await handle.close(); }
  } else {
    snapshot = JSON.parse(await readFile(path, 'utf8')) as Snapshot;
    if (snapshot.format !== 1 || !snapshot.keys || typeof snapshot.keys !== 'object' || Array.isArray(snapshot.keys) ||
        snapshot.scope !== (historyOnly ? 'history' : undefined)) throw new Error('Invalid backup format or scope.');
  }
  const report = validate(snapshot);
  const counts = historyOnly ? { historyOwners: report.counts.accounts, history: report.counts.history } : report.counts;
  console.log(JSON.stringify({ mode: command, sha256: digest(snapshot), counts, issues: report.issues }));
  if (Object.keys(report.issues).length) throw new Error('Snapshot needs reconciliation. Source data remains intact.');

  if (command === 'import') {
    if (confirmation !== '--confirm-frozen-source') throw new Error('Import requires an acknowledged write freeze.');
    if (digest(await exportSnapshot(historyOnly)) !== digest(snapshot)) throw new Error('Redis changed since the backup. Take a fresh frozen snapshot.');
    const db = database();
    for (const { user, entries } of report.users.values()) {
      const { error } = historyOnly
        ? await db.rpc('aznime_import_history', { p_user: user.id, p_items: entries.map(entry => entry.item) })
        : 'email' in user
          ? await db.rpc('aznime_import_account', { p_user: accountRow(user), p_entries: entries })
          : { error: { code: 'missing-account' } };
      if (error) throw new Error(`Account import stopped (${error.code || 'storage error'}). Rerun after review.`);
    }
    if (report.maintenance) {
      const { error } = await db.from('aznime_maintenance').upsert(maintenanceRow(report.maintenance),
        { onConflict: 'singleton', ignoreDuplicates: true });
      if (error) throw new Error('Maintenance import stopped.');
    }
    await verifyDatabase(report);
    if (digest(await exportSnapshot(historyOnly)) !== digest(snapshot)) {
      throw new Error('Redis changed during import. Keep writes frozen and reconcile before cutover.');
    }
    console.log('Import verified against snapshot.');
  } else if (command === 'verify') {
    await verifyDatabase(report);
    console.log('Target verified against snapshot.');
  }
}

main().catch(error => {
  const messages = /^(Configure|Usage:|Use a|Invalid backup|Snapshot needs|Import requires|Redis changed|Account import|Target |Maintenance import)/;
  console.error(error instanceof Error && messages.test(error.message) ? error.message : 'Migration stopped. Check configuration or storage availability.');
  process.exitCode = 1;
});
