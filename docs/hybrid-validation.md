# Hybrid implementation validation

## Results

| Check | Result |
| --- | --- |
| TypeScript and Next.js production build | Passed on the workspace Node 24 runtime. |
| Repository tests | 107 passed, including actual PostgreSQL execution in PGlite. |
| Disposable service stack | PostgreSQL 17.12, PostgREST 13.0.4 and Redis 7.2.12. PostgREST used genuine JWT database roles. Loopback HTTP adapters forwarded the Supabase API prefix and Redis REST commands to those engines. |
| Redis → PostgreSQL | Real scan, backup, import, replay and full verification of an account, history/progress, and maintenance state passed. The original Redis session and password still authenticated through Next.js. No source record was deleted. |
| Connection, CRUD and API compatibility | Official Supabase client and Redis REST client connected. Registration/login/logout, duplicate-account handling, stats, favorites, progress, sync, response contracts and per-account access passed on the real application build. |
| PostgreSQL authorization | SQL tests denied table/RPC operations to both untrusted roles. The anonymous Data API smoke also failed to read or call the protected objects as expected. |
| Concurrent requests and order | Twelve parallel history writes kept the newest progress; SQL tests verified merge order and the 100-entry history bound. Bounded favorites remain capped at 500. No cursor API existed at baseline. |
| Cache hit, miss and recovery | The live transport exercised fills and hits. Simulated transport failure limited to optional Redis cache keys left writes available. Once Redis recovered, the database version fenced the stale entry even though deletion had failed. |
| Full dependency failure | With Redis unavailable, credential operations returned 503 and remained fail-closed. With PostgREST stopped, authenticated history returned 503 without stale data. |
| Hosted Supabase, Upstash and Vercel cutover | Pending. The connected Supabase account listed no accessible project, and no production credentials were present in this environment. No hosted data or environment configuration was changed. |

The reusable HTTP check is [hybrid-smoke.ts](../scripts/hybrid-smoke.ts). The disposable run additionally seeded legacy Redis data and injected transport outages. It used generated test accounts and disposable credentials. It did not require provider OAuth credentials or attempt a live Google/Discord callback.

## History-only mode

The history-only follow-up passed the production build and the same disposable PostgreSQL/PostgREST/Redis testing. The history backup contained only the account UUID and history data. Replaying the import preserved progress, existing Redis sessions and logins, and the profile and maintenance tables stayed empty. Favorites writes and stats were also checked in Redis mode. The new SQL test verifies that history creates an owner without requiring a profile.

## File inventory

- Audit and operations: `docs/hybrid-initial-audit.md`, `docs/hybrid-database.md`, `docs/hybrid-validation.md`, `SECURITY.md`, `.env.example`, `.gitignore`.
- Schema and new services: `supabase/migrations/20261126143703_hybrid_persistence.sql`, `supabase/migrations/20261126145536_history_only_cutover.sql`, `lib/db/config.ts`, `lib/db/supabase.ts`, `lib/db/accounts.ts`, `lib/db/library.ts`, `lib/db/library-cache.ts`, `lib/db/maintenance.ts`.
- Application wiring: `lib/auth/users.ts`, `lib/auth/favorites.ts`, `lib/auth/history.ts`, `lib/auth/http.ts`, `lib/auth/redis.ts`, `lib/auth/rate-limit.ts`, `lib/auth/oauth.ts`, `lib/maintenance.ts`, `app/api/auth/me/route.ts`, `app/api/history/sync/route.ts`, `app/api/maintenance/status/route.ts`.
- Migration, tests and dependencies: `scripts/redis-to-postgres.ts`, `scripts/hybrid-smoke.ts`, `lib/db/hybrid.test.ts`, `lib/api-guard.test.ts`, `package.json`, `package-lock.json`.
