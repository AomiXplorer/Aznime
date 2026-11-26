# Keamanan Aznime

> This document records the legacy Redis configuration. For PostgreSQL mode, see the [hybrid architecture, security review, and cutover runbook](docs/hybrid-database.md).

Dokumen ini menjelaskan postur keamanan Aznime: apa yang dilindungi, di mana
batasnya, dan apa yang harus dilakukan saat ada insiden. Ditulis berdasarkan
audit source code, bukan checklist umum.

Terakhir diaudit: 24 November 2026.

---

## 1. Arsitektur keamanan

Aznime adalah Next.js 16 (App Router) di Vercel, tanpa server tradisional.
Tidak ada database relasional. Seluruh data pengguna disimpan di **Upstash
Redis** yang diakses lewat REST API hanya dari sisi server.

```
Browser
  │  cookie HttpOnly (aznime_session), tanpa token di localStorage
  ▼
Vercel Edge  ── proxy.ts (mode maintenance, bypass cookie)
  │
  ▼
Server Components / Route Handlers
  │  satu-satunya pihak yang memegang UPSTASH_REDIS_REST_TOKEN
  ▼
Upstash Redis (REST, HTTPS)
```

Prinsip yang dipegang:

1. **Server adalah satu-satunya otoritas.** Identitas pengguna selalu berasal
   dari session yang divalidasi di server. `userId` dari body request tidak
   pernah dipercaya.
2. **Token mentah tidak disimpan.** Yang masuk Redis hanya hash token
   (SHA-256 + pepper `AUTH_SECRET`).
3. **Secret tidak pernah menyentuh klien.** Tidak ada variabel sensitif dengan
   prefix `NEXT_PUBLIC_`.
4. **Gagal tertutup untuk data pengguna, gagal terbuka untuk katalog.** Kalau
   Redis mati, rute akun membalas 503, sedangkan rute katalog publik tetap
   jalan tanpa pemeriksaan kuota.

---

## 2. Environment variables

Semua variabel berikut **hanya** dibaca di server. Satu-satunya variabel
publik adalah `NEXT_PUBLIC_SITE_URL` (URL situs, bukan rahasia).

| Variabel | Rahasia | Fungsi | Dampak bila bocor |
| --- | --- | --- | --- |
| `UPSTASH_REDIS_REST_URL` | ya (setengah) | endpoint Redis | penanda akun Redis |
| `UPSTASH_REDIS_REST_TOKEN` | **ya** | akses penuh ke seluruh data | baca/tulis semua akun, session, favorit |
| `AUTH_SECRET` | **ya** | pepper hash token session | hash session bisa dihitung ulang bila token mentah juga bocor |
| `AUTH_URL` | tidak | origin kanonik (cookie Secure, redirect OAuth, CSRF) | salah isi melemahkan cookie |
| `TURNSTILE_SITE_KEY` | tidak | kunci publik Turnstile | aman di klien |
| `TURNSTILE_SECRET_KEY` | **ya** | verifikasi Turnstile | captcha bisa dilewati |
| `GOOGLE_CLIENT_SECRET` | **ya** | OAuth Google | penyalahgunaan aplikasi OAuth |
| `DISCORD_CLIENT_SECRET` | **ya** | OAuth Discord | penyalahgunaan aplikasi OAuth |
| `TELEGRAM_BOT_TOKEN` | **ya** | kontrol bot admin | pengambilalihan bot maintenance |
| `TELEGRAM_WEBHOOK_SECRET` | **ya** | autentikasi webhook | perintah admin palsu |
| `TELEGRAM_ADMIN_IDS` | tidak | daftar admin | bukan rahasia, tapi menentukan siapa yang berwenang |
| `MAINTENANCE_BYPASS_SECRET` | **ya** | penanda tangan link bypass | siapa pun bisa melewati maintenance |
| `GOOGLE_SITE_VERIFICATION` | tidak | verifikasi Search Console | aman |

Aturan yang berlaku:

- `.env` tidak pernah masuk Git (`.gitignore` sudah menutup `.env`, `.env*.local`, `.vercel`).
- `.env.example` hanya berisi nama variabel dan placeholder kosong.
- Nilai secret tidak boleh muncul di README, dokumentasi, komentar, atau pesan error.
- Tidak ada secret di bundle klien: build produksi tidak menghasilkan source map
  browser, dan pencarian nama variabel sensitif di `.next/static` menghasilkan nol kecocokan.

---

## 3. Perlindungan data

| Data | Lokasi | Bentuk |
| --- | --- | --- |
| Password | Redis `user:<id>` | scrypt (N=16384, r=8, p=1, 64 byte) + salt 16 byte acak |
| Token session | cookie + Redis `session:<hash>` | token 32 byte acak; Redis hanya menyimpan hash + pepper |
| Email | Redis `user:<id>`, `user:email:<email>` | plaintext (dibutuhkan untuk login) |
| History tontonan | Redis `user:<id>:history*` | JSON, maksimal 100 entri per akun |
| Favorit | Redis `user:<id>:favorites*` | JSON, maksimal 500 entri per akun |
| Guest history | localStorage browser | hanya sebelum login, milik pengunjung sendiri |

Password tidak pernah ditulis ke log, tidak pernah dikembalikan API, dan
dibandingkan memakai `timingSafeEqual`.

---

## 4. Arsitektur autentikasi dan session

**Pendaftaran dan login email**

- Password di-hash scrypt dengan salt acak per pengguna.
- Login selalu menjalankan scrypt sekali walau email tidak terdaftar, supaya
  waktu respons tidak membocorkan email mana yang ada.
- Pesan gagal login identik untuk email tidak dikenal dan password salah.
- Cloudflare Turnstile diverifikasi di server (`siteverify`), bukan di klien.

**Session**

- Cookie `aznime_session`: `HttpOnly`, `SameSite=Lax`, `Secure` (AUTH_URL https
  atau `VERCEL_ENV=production`), `Path=/`, umur 30 hari.
- Satu akun hanya punya satu session aktif: login baru mencabut session lama.
- Logout menghapus hash session dari Redis **dan** dari indeks session pengguna.
- `getSessionUser()` memeriksa `expiresAt` di server, jadi cookie yang dicuri
  setelah kedaluwarsa tidak berguna.

**OAuth (Google, Discord)**

- `state` acak 24 byte, disimpan di Redis dengan TTL 600 detik, sekali pakai,
  dan harus cocok dengan cookie `aznime_oauth_state_<provider>`.
- `redirect_uri` dipatok ke `AUTH_URL` (bukan berasal dari header Host request).
- `returnTo` dinormalisasi: hanya path relatif same-origin; `//host`,
  `https://host`, dan backslash ditolak.
- Akun dengan email yang sama **tidak** digabung otomatis; pemilik harus masuk
  lewat metode aslinya lebih dulu.

**CSRF**

Setiap `POST`/`DELETE` memeriksa header `Origin` terhadap origin situs
(`isSameOrigin`). Cookie `SameSite=Lax` menjadi lapisan kedua.

---

## 5. Kebijakan akses database

Tidak ada endpoint yang menerima kunci Redis dari klien. Kunci selalu dibentuk
dari `userId` hasil validasi session:

```
user:<uuid>                    hash profil
user:email:<email>             penunjuk email → userId
user:<uuid>:sessions           indeks hash session (TTL 60 hari)
user:<uuid>:history           sorted set history (maks 100)
user:<uuid>:history:data      hash detail history
user:<uuid>:favorites         sorted set favorit (maks 500)
user:<uuid>:favorites:data    hash detail favorit
session:<hash>                isi session (TTL 30 hari)
oauthstate:<state>            state OAuth (TTL 10 menit)
ratelimit:<bucket>:<ip>       penghitung kuota (TTL sesuai jendela)
```

Aturan:

- Setiap operasi data pengguna memakai `userId` dari session, tidak pernah dari body.
- Input dari klien disanitasi dan dipotong panjangnya sebelum menjadi bagian kunci
  (`animeId` 200 karakter, judul 300, poster 500).
- Array dari klien dibatasi sebelum diproses (history tamu maksimal 200 entri).
- Tidak ada endpoint untuk membaca seluruh kunci Redis.
- Token Redis hanya ada di environment server; tidak ada jalur dari browser.

---

## 6. Kebijakan keamanan API

| Endpoint | Akses | Rate limit | Catatan |
| --- | --- | --- | --- |
| `GET /api/anime` | publik | 120/menit/IP | katalog |
| `GET /api/search` | publik | 60/menit/IP | pencarian |
| `GET /api/filters` | publik | 60/menit/IP | opsi filter |
| `GET /api/malz/episodes` | publik | 60/menit/IP | daftar episode; `id` ≤ 200 char, `page` ≤ 100.000 |
| `GET /api/malz/minimum` | publik | 30/menit/IP | `id` ≤ 200 char, `highest` ≤ 100.000, `perPage` ≤ 500 |
| `GET /api/nekopoi/search` | publik | 30/menit/IP | khusus /hentai |
| `GET /api/img` | publik | 300/menit/IP | proksi gambar, host allowlist |
| `GET /api/auth/config` | publik | 60/menit/IP | hanya kunci publik Turnstile + status provider |
| `GET /api/maintenance/status` | publik | 120/menit/IP | status maintenance, selalu lewat cache-bypass |
| `POST /api/auth/login` | publik | 20/menit/IP + 8/menit/email | Turnstile + CSRF |
| `POST /api/auth/register` | publik | 5/menit/IP | Turnstile + CSRF |
| `POST /api/auth/logout` | publik | 30/menit/IP | CSRF; mencabut session di server |
| `GET /api/auth/me` | publik (opsional sesi) | 120/menit/IP | balas `user: null` bila tamu |
| `GET/POST/DELETE /api/favorites` | **sesi wajib** | 120/menit/IP | hanya data milik sendiri |
| `GET/POST/DELETE /api/history` | **sesi wajib** | 120/menit/IP | hanya data milik sendiri |
| `POST /api/history/sync` | **sesi wajib** | 20/menit/IP | maksimal 200 entri |
| `GET /api/auth/oauth/[provider]` | publik | 20/menit/IP | pembuatan state (menulis 1 kunci Redis per permintaan) |
| `GET /api/auth/oauth/[provider]/callback` | publik | 30/menit/IP | state + cookie harus cocok |
| `POST /api/telegram/webhook` | header secret | – | `X-Telegram-Bot-Api-Secret-Token`, timing-safe |
| `GET /api/maintenance/bypass` | token HMAC | 30/menit/IP | token ber-tanda tangan + kedaluwarsa |

Semua body JSON dibaca lewat `readJsonBody`, yang menolak body di atas
512 KB sebelum di-parse. Semua input yang dipakai menyusun URL upstream
(`id`, `page`, `highest`, `perPage`, `u`, `t`, `a`) dipotong panjangnya dan
dibatasi rentangnya, sehingga tidak ada parameter yang bisa dipanjangkan atau
diperbesar untuk memperberat server.

Tidak ada endpoint admin berbasis web. Kontrol maintenance hanya lewat bot
Telegram yang memverifikasi `TELEGRAM_ADMIN_IDS`, sehingga tidak ada panel admin
yang bisa diakses dari browser dan tidak ada role yang bisa diubah lewat request.

---

## 7. Strategi rate limiting

- Penghitung fixed-window di Redis (`INCR` + `EXPIRE`), satu tulis per percobaan.
- Kunci memuat IP yang sudah disanitasi: `x-real-ip` milik platform dipakai lebih
  dulu, lalu hop **terakhir** `x-forwarded-for`. Entri pertama XFF tidak dipercaya
  karena bisa ditulis klien.
- Login dibatasi ganda: per IP dan per email, supaya satu email tidak bisa
  di-brute force dari banyak IP dan satu IP tidak bisa menyapu banyak email.
- Rute publik memakai `rateLimitGuard` dan membalas **429** dengan header
  `Retry-After`.
- Bila Redis tidak tersedia, rute publik **fail-open** (permintaan diteruskan,
  kejadian dicatat di log) supaya katalog tidak ikut mati. Rute akun fail-closed.
- Rute yang menulis ke Redis tetap dibatasi walau butuh sesi, karena satu akun
  sah pun tidak boleh bisa membanjiri Redis: favorit/history 120/menit,
  sinkron history 20/menit (satu permintaan menulis sampai 200 entri).
- `POST /api/auth/login` menolak password di atas 128 karakter sebelum hashing,
  supaya satu permintaan tidak bisa memaksa scrypt mengolah string raksasa.

---

## 8. Security headers

Dikirim untuk semua respons dari `next.config.ts`:

| Header | Nilai |
| --- | --- |
| `Content-Security-Policy` | `default-src 'self'`, `frame-ancestors 'none'`, `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`, skrip dari self + `challenges.cloudflare.com`, `frame-src https:` (iframe pemutar) |
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains; preload` |
| `X-Content-Type-Options` | `nosniff` |
| `X-Frame-Options` | `DENY` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `Permissions-Policy` | kamera, mikrofon, geolokasi, payment, usb dimatikan |
| `Cross-Origin-Opener-Policy` | `same-origin` |

`X-XSS-Protection` sengaja **tidak** dikirim: header itu sudah dihapus dari
standar dan `mode=block` pada browser lama bisa disalahgunakan. Perlindungan XSS
dipegang CSP dan escaping React.

CSP masih memuat `script-src 'unsafe-inline'` dan `style-src 'unsafe-inline'`
karena Next menyisipkan skrip bootstrap inline tanpa nonce. Menghapusnya akan
mematikan hidrasi React. `script-src 'unsafe-eval'` hanya ditambahkan pada
development untuk stack trace React; header production tidak mengizinkannya.
Sisa direktif tetap menutup plugin/objek, penyalahgunaan `<base>`, pengiriman
form lintas domain, dan clickjacking.

---

## 9. Prosedur rotasi secret

Rotasi dilakukan dari dashboard penyedia, **bukan** dengan mengubah nilai di
source code. Setelah rotasi, deploy ulang karena Vercel menempelkan environment
saat build.

| Secret | Langkah | Dampak |
| --- | --- | --- |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash → Redis → REST API → rotate token, perbarui env Vercel, redeploy | semua session tetap sah (token Redis bukan penanda tangan session) |
| `AUTH_SECRET` | buat string acak ≥32 karakter, perbarui env, redeploy | **semua session aktif langsung tidak valid**; semua pengguna harus login ulang |
| `GOOGLE_CLIENT_SECRET` / `DISCORD_CLIENT_SECRET` | reset di konsol OAuth, perbarui env, redeploy | login OAuth gagal sampai nilai baru aktif |
| `TURNSTILE_SECRET_KEY` | rotate di Cloudflare, perbarui env, redeploy | verifikasi captcha gagal sampai nilai baru aktif |
| `TELEGRAM_BOT_TOKEN` | `/revoke` lewat BotFather, perbarui env, set ulang webhook | bot maintenance mati sampai diaktifkan lagi |
| `TELEGRAM_WEBHOOK_SECRET` | buat nilai baru, perbarui env, panggil ulang `setWebhook` dengan `secret_token` | webhook menolak semua update sampai disetel ulang |
| `MAINTENANCE_BYPASS_SECRET` | buat nilai baru, perbarui env, redeploy | link bypass lama langsung tidak berlaku |

Setelah rotasi: cek log Vercel untuk lonjakan 401/503, lalu pastikan login,
OAuth, dan panel maintenance berfungsi.

---

## 10. Checklist insiden

1. **Identifikasi** — endpoint/secret apa yang terdampak, sejak kapan, dari IP mana.
2. **Batasi** — rotasi secret terkait (lihat bagian 9). Untuk dugaan penyalahgunaan
   akun: login baru otomatis mencabut session lama akun tersebut.
3. **Hentikan** — bila perlu, aktifkan maintenance lewat bot Telegram untuk
   menghentikan trafik sementara tanpa menghapus data.
4. **Periksa** — log Vercel: 429/401/503 yang tidak wajar, error `[api:*]`,
   percobaan `/api/maintenance/bypass` dengan token tidak valid.
5. **Pulihkan** — deploy ulang dari commit terakhir yang diketahui baik.
6. **Catat** — tulis temuan, dampak, dan tindakan. Jangan simpan nilai secret
   di catatan; cukup nama variabel dan waktu rotasi.
7. **Tinjau** — perbarui dokumen ini bila penyebabnya mengubah desain.

Yang **tidak** boleh dilakukan saat insiden: menghapus kunci Redis secara massal,
mereset database, atau mengubah data pengguna untuk "membersihkan" jejak.

---

## 11. Checklist deploy produksi

- [ ] `npm run lint` (tsc) bersih
- [ ] `npm test` lulus semua
- [ ] `next build` sukses
- [ ] Tidak ada secret di diff: `git diff --cached | grep -iE "token|secret|password"`
- [ ] `.env` tidak ter-track: `git ls-files | grep -E "^\.env$"` kosong
- [ ] `AUTH_URL` = `https://aznime.com`
- [ ] `AUTH_SECRET` terisi minimal 32 karakter
- [ ] `UPSTASH_REDIS_REST_URL` berawalan `https://` (bukan `rediss://`)
- [ ] `TELEGRAM_WEBHOOK_SECRET` dan `TELEGRAM_ADMIN_IDS` terisi
- [ ] Setelah deploy: `curl -sI https://aznime.com/ | grep -i content-security-policy` mengembalikan header
- [ ] Login, logout, favorit, history, dan pemutar diuji di produksi
- [ ] `/api/favorites` tanpa cookie membalas 401

---

## 12. Batasan audit

Audit ini berbasis pembacaan source code, dependency scan, dan pengujian lokal.
Yang **tidak** dicakup:

- Pengujian penetrasi terhadap produksi (tidak dilakukan, sesuai batasan tugas).
- Pengujian beban dan brute force nyata.
- Audit keamanan pihak ketiga (Upstash, Cloudflare, Google, Discord, Telegram,
  serta sumber data anime) — hanya sisi integrasi Aznime yang diperiksa.
- Kebocoran yang berasal dari perangkat atau browser pengguna.
- Kepatuhan formal (ISO 27001, SOC 2, PCI DSS).

Aznime tidak bisa disebut "100% aman". Yang bisa dikatakan: kerentanan yang
ditemukan pada audit ini sudah diperbaiki dan diuji, dan postur dasarnya
(header, session, otorisasi, pembatasan kuota) sekarang jauh lebih kuat.

### Yang masih terbuka (butuh keputusan pemilik)

Ini bukan kelalaian yang tersembunyi, tapi hal yang sengaja dibiarkan karena
memperbaikinya berarti mengubah arsitektur atau perilaku yang sedang berjalan:

1. **`script-src 'unsafe-inline'` pada CSP.** Next menyisipkan skrip bootstrap
   inline tanpa nonce. Menutupnya butuh middleware nonce dan pengujian ulang
   seluruh halaman. Mitigasi sekarang: `object-src 'none'`, `base-uri 'self'`,
   dan semua output React di-escape.
2. **OAuth belum memakai PKCE.** Google dan Discord memakai alur confidential
   client (client secret hanya di server) ditambah `state` sekali pakai yang
   diikat ke cookie, jadi kode otorisasi tidak bisa dipakai ulang. PKCE akan
   menambah satu lapis lagi bila alur ini suatu saat dibuka untuk klien publik.
3. **`POST /api/auth/register` menjawab "email sudah terdaftar".** Ini
   memudahkan penyerang memeriksa apakah sebuah email punya akun. Dibiarkan
   karena tanpa pesan itu pengguna sah bingung saat mendaftar. Login sendiri
   tidak membocorkan hal ini.
4. **`npm run lint` (`tsc --noEmit`) sempat gagal total** karena merge 496d8cb
   memotong header `buildMalzDetail`. Sudah diperbaiki; jalankan `npm run lint`
   sebelum push supaya kejadian ini tidak terulang.
5. **Secret rotation** untuk kredensial yang pernah ada di repo contoh pada
   commit lama tetap disarankan bila nilai itu pernah dipakai di produksi.
