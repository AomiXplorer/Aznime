# Initial AzNime storage audit

Baseline `7fbba37`. This audit covers production code paths and repository configuration. Live Redis key counts and contents were unavailable, so the key inventory is inferred from code. No production data was read.

| Class | Redis keys | Shape and lifetime | Current access and decision |
| --- | --- | --- | --- |
| A · persistent | `user:<uuid>` | Profile/credential hash, no TTL | HGETALL/HSET in users service. Move intact to PostgreSQL, including password hashes and account timestamps. |
| A · persistent | `user:email:<normalized-email>` | String ID; temporary claim `pending` can persist, no TTL | GET, SET, SET NX. Replace with a unique PostgreSQL email constraint. Validate claim and ownership during import. |
| A · persistent | `oauth:<google-or-discord>:<provider-id>` | String user ID, no TTL | GET/SET. Replace with unique provider identity without linking users by email. |
| A · persistent | `user:<uuid>:favorites`, `user:<uuid>:favorites:data` | Sorted set and hash of JSON, no TTL, 500 displayed | ZREVRANGE/ZADD/ZREM/ZCARD, HGETALL/HSET/HDEL. Move items and order, retain the cap. |
| A · persistent | `user:<uuid>:history`, `user:<uuid>:history:data` | Sorted set and hash of episode metadata and progress JSON, no TTL, 100 displayed | Same commands as favorites plus ZSCORE and REST pipeline on sync. Move progress and device merge, serialize mutations. |
| A · persistent | `aznime:maintenance:state` | Singleton JSON, no TTL; 5s process cache | GET/SET via a separate REST wrapper. Move the desired state, preserve operational behavior. |
| B · temporary | `session:<peppered-sha256-token>`, `user:<uuid>:sessions` | Session hash 30d; comma-separated index normally 60d. Legacy rewrite paths can clear index TTL. | HGETALL/HSET/GET/SET/DEL/EXPIRE. Leave sessions and cookies in place. |
| B · temporary | `oauthstate:<random>` | JSON return path and time, 600s | SET EX, GET/DEL. Retain in Redis. |
| B · temporary | `ratelimit:<bucket>` | Fixed-window counter; seconds configured at each call | INCR/EXPIRE. Includes login IP/email, registration IP, and guards for public API, OAuth, image/video, favorites and history. Keep fail-closed credential limits and existing public best-effort policy. |
| B · temporary | `aznime:maintenance:pending:<id>` | Telegram action JSON, 300s | SET EX, GET/DEL, DEL on cancellation. Keep in Redis with existing development fallback. |
| C · cacheable | `malz:anime-slug:<slug>`, `malz:ep-slug:<slug>` | External identifiers, 90d | GET/SET EX. Keep provider authoritative. |
| C · cacheable | `aznime:cover:<sha1>` | AniList/CDN URL or negative sentinel | GET/SET EX. Positive 30d and negative 6h in Redis, with process cache above it. |
| D · external | No owned Redis records | Hidori, Malz, Nekopoi, Komiku, WEBTOON, AniList and YouTube supply catalog/media. Telegram, Turnstile, Google and Discord supply integrations. | Keep existing provider and Next.js fetch/ISR, process caches and inflight deduplication. |

## Call paths and deployment

- Redis REST is initialized on demand in `lib/auth/redis.ts` with Upstash URL/token and a 5s deadline. Its pipeline batches operations without SQL-style atomicity. The second REST implementation in `lib/maintenance.ts` uses a 2.5s deadline.
- Auth routes are `/api/auth/register`, `/login`, `/logout`, `/me`, OAuth start/callback and public config. Passwords are scrypt hashes. Sessions use an HttpOnly cookie and a peppered token hash. OAuth preserves Google/Discord identity and does not auto-link by email. Account pages and watch gating use the same session validation.
- `/api/favorites`, `/api/history`, `/api/history/sync` and `/api/auth/me` resolve ownership from the session. Favorites and history page/client entry points share these services. On login, local guest history is merged into the account.
- Maintenance runs through middleware, status/bypass routes and Telegram webhook. Explicit configuration and confirmation are user-driven. No repository scheduler, job queue, or production cron is declared. Existing provider refresh runs on demand.
- No PostgreSQL, ORM, Supabase Auth or Supabase schema existed at baseline. Vercel uses Next.js serverless routes. Environment variables cover Upstash, auth/OAuth, Turnstile, Telegram, bypass signing and external source overrides. Secret values were neither read nor printed.
- Preferences (theater, player settings, age gate) and guest history are browser-local. There is no account preference API, separate bookmarks table, comments API, or submitted-report store. The player report workflow copies prepared text to the clipboard. Neither browser-local nor nonexistent records are migration inputs.

## Risks before any cutover

Redis email claims and OAuth mappings can be orphaned because legacy user creation spans multiple commands. List members and hashes can diverge, and history sync can exceed the display cap. Validate and report disagreement, keep source data intact, and do not silently discard records. Freeze durable writes throughout the authoritative export/validation/switch to avoid missing changes. After PostgreSQL accepts new writes, reverting to the old Redis dataset would hide newer records. No live cutover or deletion is authorized by a passing local test.

## Redis-backed route quota inventory

| Routes | Bucket and quota |
| --- | --- |
| `/api/search`, `/api/filters`, `/api/malz/episodes`, `/api/auth/config` | `search`, `filters`, `malz-episodes`, `auth-config` each 60/min/IP |
| `/api/anime`, `/api/favorites`, `/api/history`, `/api/auth/me`, `/api/maintenance/status` | `anime`, `favorites`, `history`, `auth-me`, `maintenance-status` each 120/min/IP across methods |
| `/api/malz/minimum`, `/api/nekopoi/search`, `/api/auth/logout`, `/api/auth/oauth/[provider]/callback`, `/api/maintenance/bypass` | each 30/min/IP under its own bucket |
| `/api/history/sync`, `/api/auth/oauth/[provider]` | `history-sync` and `oauth-start` each 20/min/IP |
| `/api/video`, `/api/img` | `video` 240/min/IP and `img` 1,800/min/IP |
| `/api/auth/register`, `/api/auth/login` | `register:ip` 5/10m, `login:ip` 20/10m and `login:email` 8/10m. Credential routes fail closed. |
| `/api/telegram/webhook` | No generic rate-limit bucket. Webhook secret and configured admin IDs govern maintenance access. |

Redis participation through global maintenance middleware applies to other matched routes as well. Auth and data routes install no-store response headers. Existing session create/revoke steps and logout degradation span multiple Redis calls; they are unchanged by the PostgreSQL migration and warrant separate review if stricter session consistency is required.
