# AzNime hybrid database

[Baseline audit and Redis key inventory](hybrid-initial-audit.md)

## Data ownership

| Data | Storage after cutover | Implementation |
| --- | --- | --- |
| Profiles, email and provider identities, existing scrypt credentials | Supabase PostgreSQL | `aznime_users` preserves the application UUID. Unique email and partial unique provider identity indexes replace Redis claims. |
| Favorites, watch history and episode progress | Supabase PostgreSQL | `aznime_library_entries` has a composite primary key and a cascading user FK. The JSON payload preserves the API contract. The order index uses user, collection, recorded milliseconds and anime ID. |
| Maintenance desired state | Supabase PostgreSQL | `aznime_maintenance` is a singleton. Date fields use UTC-compatible `timestamptz`. The existing 5-second process cache remains. |
| Existing sessions, OAuth state, rate limits, Telegram confirmations | Upstash Redis | Cookie names, token hashes and signing secret remain compatible. Confirmation and OAuth consumption are atomic. Rate-limit increments and TTL writes are atomic. |
| External catalog and assets | Existing providers | Next.js fetch/ISR, process caches, and existing Upstash provider mappings remain in use. |
| Reports, preferences and guest history | Existing client behavior | The report dialog copies text locally. Guest history syncs to an account on request. Device preferences stay local. |

The versioned migration is [20261126143703_hybrid_persistence.sql](../supabase/migrations/20261126143703_hybrid_persistence.sql). Existing application authentication remains authoritative. PostgreSQL handles atomic library mutations, per-account serialization, stale progress rejection, and the existing favorites/history caps of 500/100. The indexed newest-first query returns the existing bounded list in one request. There is no API pagination contract to migrate. If a list endpoint later needs cursor pagination, use the existing `(recorded_ms, anime_id)` composite ordering.

Vercel uses the official Supabase JavaScript client over HTTPS to the Data API. Each warm process reuses its client. There are no direct PostgreSQL sockets in Vercel; the Data API owns the database connections. Supabase functions use invoker security, a pinned search path, and are granted only to the server role. The app client uses a 5-second deadline and no automatic browser-style session persistence.

## Redis cache policy

- Favorites cache TTL is 90 seconds. History TTL is 30 seconds. Keys are `aznime:pg:v1:<kind>:<account-uuid>`; auth and credentials are never cached here.
- On reads, check Redis first, then compare its version to the current PostgreSQL account collection version. A valid hit skips the row query. A miss loads the bounded list. Concurrent fills for that user and version share an in-process promise.
- Mutations commit the list and its new version atomically, then delete the Redis entry best-effort. Failed invalidation and stale in-flight fills cannot serve an old snapshot on a subsequent read. Use the app mutation RPC for edits so cache versions change with stored rows.
- Cache requests time out after 500 ms. Errors skip the cache. Payloads larger than 128 KiB skip Redis writes. Lower latency on hits comes from fetching one database version column instead of the whole list; hits still require that PostgreSQL check. No stale cache is served when the database is unavailable.
- Complete Redis failure still affects authentication, credential rate limiting, OAuth and sessions. An authenticated operation that can already validate its identity can complete with a cache-only failure. Existing public rate-limit degradation and maintenance's last-known/default policy remain in effect.

## Configuration

| Variable | Environment and purpose |
| --- | --- |
| `AZNIME_PERSISTENCE` | Server. Leave unset or `redis` before the cutover; use `postgres` only after import and validation. A typo fails instead of selecting a different store. |
| `AZNIME_HISTORY_PERSISTENCE` | Server. Leave unset or `redis` until a history-only cutover is verified. Use `postgres` to move history and progress while the other owned records remain in Redis. |
| `SUPABASE_URL` | Server. HTTPS project origin without an API path. HTTP loopback is permitted outside Vercel production for local validation. |
| `SUPABASE_SERVICE_ROLE_KEY` | Server. Use the managed project's service-role/secret key. Do not place it in a browser variable, output, report, or checked-in file. |
| `SUPABASE_ANON_KEY` | Only the disposable integration smoke test uses this to verify anonymous denial. AzNime does not initialize a browser Supabase client. |
| `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | Server. Keep the existing production credentials. Use the HTTPS REST origin. |
| `AUTH_SECRET`, `AUTH_URL` and provider/security env | Keep the existing values. In particular, changing `AUTH_SECRET` invalidates existing session token hashes. |

Use the Vercel environment scope for the intended deployment and an isolated project for preview or smoke testing. Do not run integration smoke against production databases. Monitor service errors and read/write latency in Vercel, rate-limit and Redis metrics in Upstash, and Supabase Query Performance or `pg_stat_statements` for library and account reads. Examine execution plans for the indexed list query under representative load before changing the 100/500 limits.

## History-only cutover

Apply both versioned migrations, then keep `AZNIME_PERSISTENCE=redis` and switch only `AZNIME_HISTORY_PERSISTENCE=postgres` after validation. PostgreSQL records the application account UUID and history/progress. The migration reads only that ID from the Redis profile hash. Emails, password hashes, favorites and maintenance stay in Redis. The history transaction and cache protections remain the same.

For each backup, validation, import and verify command below, set `AZNIME_MIGRATION_SCOPE=history` and use a separate ignored snapshot file such as `.aznime-backups/history-cutover.json`. The importer rejects a file from the other scope. Before the final backup, freeze all production history mutations, including guest-history merges through registration and login. Block those mutations on old deployment URLs and drain in-flight writes before switching. Keep the original Redis history keys. Once new PostgreSQL history writes are enabled, a direct fallback to the old Redis data would hide those writes, so freeze and reconcile before reverting. A later full cutover needs a reviewed snapshot that reflects the then-current PostgreSQL history. A pre-cutover Redis history snapshot may conflict and the full importer will stop.

## Backup, import and cutover

1. Verify the target project, access policy, active application branch, and direct/preview deployment routes. Apply the versioned SQL migration on the intended Supabase project and verify grants through the Data API. Deploy the code in Redis mode first. Test on disposable storage before changing production.
2. Back up existing durable Redis keys to a private encrypted location. The CLI uses `SCAN` and reads only recognized durable key values. Backups contain emails, credential hashes and viewing history. Keep them in the ignored `.aznime-backups/` directory, restrict file access, and never upload them to Git or paste them into a support request. The export command creates a new `0600` file and reports only counts, issue categories and a digest.
3. Establish a write freeze at ingress for all durable routes, including registration, OAuth account creation, login guest-history sync, favorites/history writes and maintenance commands. Disable access to older writer deployments and drain in-flight operations. The Redis snapshot spans multiple commands. Digest comparisons before and after import detect changes across the observed snapshots. They do not replace a write freeze or stopping older writers. Leave sessions and cache keys in Redis.
4. Take a fresh frozen snapshot, validate it, then import. Investigate any orphan, duplicate, score mismatch, malformed record or caps exceeded before cutover. The importer never prunes records to pass validation. It inserts one account transactionally, rejects conflicting existing records, supports safe replay while frozen, and then checks every imported record and exact table totals. Use an empty destination for the first import.

```sh
node --env-file=.env.local --import tsx scripts/redis-to-postgres.ts backup .aznime-backups/cutover.json
node --env-file=.env.local --import tsx scripts/redis-to-postgres.ts validate .aznime-backups/cutover.json
node --env-file=.env.local --import tsx scripts/redis-to-postgres.ts import .aznime-backups/cutover.json --confirm-frozen-source
node --env-file=.env.local --import tsx scripts/redis-to-postgres.ts verify .aznime-backups/cutover.json
```

5. While writes are frozen, deploy `AZNIME_PERSISTENCE=postgres` with the validated credentials. Check legacy sessions, accounts and collections read through the live app. Verify the prior Redis-only deployment cannot still write durable records. Restore ingress and test a dedicated account end to end. Observe errors and cache metrics.
6. Retain the old Redis durable keys and encrypted backup through the observation window. No cleanup command is provided. Cleanup is a separately approved data-retention action after backup/restore and reconciliation are verified.

### Rollback

Before opening PostgreSQL writes, return to the previous Redis-mode deployment if needed. Keep the snapshot and leave both databases intact. After opening PostgreSQL writes, Redis only contains the pre-cutover durable snapshot. Freeze writes again and roll forward using PostgreSQL, or perform a separately reviewed reverse reconciliation that accounts for inserts, updates and deletes before restoring Redis mode. A direct rollback to Redis after accepting PostgreSQL mutations would hide newer data.

## Security review

| Area | Controls and remaining checks |
| --- | --- |
| Browser credential exposure | Only server modules construct database/Redis clients. Client components use type-only imports for DTOs. HTTP responses keep the existing public user shape and no-store cache headers. Test production credential scopes before deploying. |
| Row authorization | Existing cookie validation resolves the server-owned application UUID. Body IDs are ignored for ownership. Queries filter by that UUID. RLS is enabled and grants to anonymous and authenticated Supabase roles are revoked on all new tables and functions. The server key bypasses RLS; authorization in the Next.js routes remains mandatory. |
| Input and SQL | App validation and same-origin mutation checks remain in place. Filters, RPC parameters and prepared local test queries carry values separately from SQL. No dynamic SQL in migrations. |
| Replay and abuse | OAuth state and maintenance confirmation are atomically consumed. Credential rate limits remain fail-closed; public limits retain the existing degradation policy. Session cookies and replay protections retain their baseline behavior. |
| Cache isolation | Per-user keys and unique database revisions prevent cross-account cache hits and stale versions. A Redis credential remains security-sensitive because Redis holds live sessions. |
| Operational logging | Runtime storage failures are returned as the existing generic account error. Migration errors report categories and counts, not key names or values. Do not log raw provider error payloads, JWTs or snapshot contents. |
| Follow-up scope | Hosted configuration and platform grants require verification. The baseline last-known maintenance fallback and guest/browser records have their original behavior. No public database or comments/report submission endpoints were added. |

## Validation commands

```sh
npm run lint
node --import tsx --test lib/*.test.ts lib/**/*.test.ts
npm run build
# Start a separate local AzNime instance in postgres mode against disposable services.
AZNIME_RUN_HYBRID_SMOKE=1 node --env-file=.env.local --import tsx scripts/hybrid-smoke.ts
```

The PostgreSQL tests apply the actual migration to PGlite. The HTTP smoke checks real endpoints, creates disposable accounts, and checks authorization, stable response shapes, versioned cache behavior and concurrent progress. It requires an anonymous test key and a local AzNime origin (`AZNIME_SMOKE_ORIGIN` defaults to `http://127.0.0.1:3041`). A passing local integration run is not a production migration.
