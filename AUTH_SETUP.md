# Aznime: Akun, Riwayat, Favorit, dan Gate Episode

Dokumen ini menjelaskan sistem akun yang berjalan di atas Upstash Redis, apa
saja yang perlu diisi di environment, dan apa yang belum aktif.

Tidak ada nilai secret di dokumen ini. Semua nilai asli ada di environment
Vercel dan di `.env.local` untuk pengembangan lokal.

## 1. Ringkasan

- Tamu bisa menonton episode 1-3 tanpa akun. Episode 4 ke atas wajib login.
- Aturan episode dicek di server (`app/watch/[slug]/page.tsx`), bukan di client.
  Tamu yang membuka episode terkunci tidak menerima iframe, URL embed, atau
  tautan unduhan sama sekali; yang dikirim hanya panel gate.
- Akun memakai email + password (scrypt) atau Google/Discord OAuth.
- Session berupa cookie `HttpOnly` berisi token acak; yang disimpan di Redis
  hanya hash SHA-256 token dengan pepper `AUTH_SECRET`.
- Riwayat tontonan tamu disimpan di localStorage, lalu dimigrasikan ke akun
  setelah login dan server menyatakan `synced: true`.
- Login dan daftar dilindungi Cloudflare Turnstile yang diverifikasi di server.

## 2. Environment

| Nama | Wajib | Keterangan |
| --- | --- | --- |
| `UPSTASH_REDIS_REST_URL` | Ya | URL REST Upstash, bentuk `https://xxx.upstash.io` |
| `UPSTASH_REDIS_REST_TOKEN` | Ya | Token REST Upstash |
| `AUTH_SECRET` | Ya | Pepper hash session. Ganti = semua session batal |
| `AUTH_URL` | Ya | Origin publik, `https://aznime.com` |
| `TURNSTILE_SITE_KEY` | Ya | Site key widget Turnstile (aman di client) |
| `TURNSTILE_SECRET_KEY` | Ya | Secret key, hanya dipakai server |
| `TURNSTILE_HOSTNAME` | Opsional | Kalau diisi, hostname balasan Siteverify harus sama |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Opsional | Tanpa ini tombol Google nonaktif |
| `DISCORD_CLIENT_ID` / `DISCORD_CLIENT_SECRET` | Opsional | Tanpa ini tombol Discord nonaktif |

Catatan: Upstash memberi dua bentuk kredensial. Yang dipakai kode adalah REST
(`https://...` + token), bukan URL `rediss://host:6379`.

## 3. Skema Redis

```
user:{userId}                  hash  id, username, email, avatar, provider,
                                     providerId, passwordHash, createdAt, updatedAt
user:email:{email}             string -> userId (klaim unik lewat SET NX)
oauth:{provider}:{providerId}  string -> userId
session:{sha256(token)}        hash  userId, createdAt, expiresAt, ip, ua (TTL 30 hari)
user:{userId}:sessions         string daftar hash session aktif (untuk rotasi)
user:{userId}:history          zset  animeId -> timestamp terakhir
user:{userId}:history:data     hash  animeId -> JSON item
user:{userId}:favorites        zset  animeId -> timestamp ditambahkan
user:{userId}:favorites:data   hash  animeId -> JSON item
ratelimit:{bucket}             string counter + TTL
oauthstate:{state}             string JSON state OAuth (TTL 10 menit)
```

Riwayat dibatasi 100 anime; zset dan hash dipangkas bersamaan setiap kali
melewati batas. Favorit memakai `animeId` sebagai member zset sehingga anime
yang sama tidak mungkin tersimpan dua kali.

## 4. Endpoint

```
GET  /api/auth/config                 site key Turnstile + status provider
POST /api/auth/register               email, password, confirmPassword, username?, turnstileToken, guestHistory?
POST /api/auth/login                  email, password, turnstileToken, guestHistory?
POST /api/auth/logout
GET  /api/auth/me                     user + jumlah history/favorit
GET  /api/auth/oauth/:provider        redirect ke Google/Discord (?returnTo=)
GET  /api/auth/oauth/:provider/callback
GET  /api/history                     daftar riwayat akun
POST /api/history                     catat satu episode
DELETE /api/history?animeId=          hapus satu entri
POST /api/history/sync                migrasi riwayat tamu
GET  /api/favorites
POST /api/favorites
DELETE /api/favorites?animeId=
```

Semua endpoint data mengambil `userId` dari session. `animeId` yang dikirim
client hanya dipakai sebagai kunci data di dalam ruang milik user itu sendiri,
jadi tidak ada celah IDOR.

## 5. Keamanan yang diterapkan

- Password: scrypt N=16384, r=8, p=1, salt acak 16 byte, dibandingkan dengan
  `timingSafeEqual`.
- Session: token 32 byte acak, cookie `HttpOnly`, `SameSite=Lax`, `Secure` saat
  `AUTH_URL` https, umur 30 hari, dan session lama dicabut saat login baru.
- CSRF: setiap POST/DELETE harus berasal dari origin situs sendiri.
- Rate limit: login 20/IP dan 8/email per 10 menit, daftar 5/IP per 10 menit.
- Login dengan email tidak dikenal tetap menjalankan scrypt sekali supaya waktu
  respons tidak membocorkan apakah email terdaftar.
- OAuth: `state` disimpan di Redis (TTL 10 menit) dan divalidasi di callback.
  Akun dengan email yang sudah terdaftar **tidak** digabung otomatis; callback
  mengembalikan `auth_error=email_exists`.
- Turnstile diverifikasi lewat Siteverify di server, memakai `node:https`.

## 6. Konfigurasi manual

### Upstash Redis
1. Buat database di console.upstash.com.
2. Salin `UPSTASH_REDIS_REST_URL` dan `UPSTASH_REDIS_REST_TOKEN` (tab REST, bukan
   halaman "Connect" yang menampilkan `rediss://`).

### Cloudflare Turnstile
1. dash.cloudflare.com > Turnstile > Add widget.
2. Nama `Aznime`, hostname `aznime.com` dan `www.aznime.com`, mode Managed.
3. Salin Site Key dan Secret Key. Secret key harus diawali `0x4AAAAAAA` dan
   diterima Siteverify; kalau Siteverify menjawab `invalid-input-secret`, nilai
   yang disalin salah atau tidak lengkap.

### Google OAuth
1. console.cloud.google.com > APIs & Services > OAuth consent screen (External).
2. Scope `openid`, `email`, `profile`.
3. Credentials > Create credentials > OAuth client ID > Web application.
4. Redirect URI: `https://aznime.com/api/auth/oauth/google/callback`.

### Discord OAuth
1. discord.com/developers/applications > New Application.
2. OAuth2 > Redirects: `https://aznime.com/api/auth/oauth/discord/callback`.
3. Salin Application ID (Client ID) dan Client Secret.

### Vercel
Tambahkan semua variabel di atas pada project `znimevbu` untuk target
Production (dan Preview bila dipakai), lalu deploy ulang.

## 7. Hasil pengujian

Lokal, dengan Upstash asli:

- `npm test`: 71 test lulus (12 di antaranya baru: kebijakan episode, validasi
  input, hashing password, merge riwayat, validasi favorit).
- `npm run build`: lulus.
- Register dengan riwayat tamu: `synced: true`, riwayat tamu muncul di akun.
- `POST /api/history` menyimpan, `DELETE` menghapus, riwayat tetap ada setelah
  logout lalu login lagi.
- `POST /api/history/sync` menggabungkan tanpa duplikat dan memakai timestamp
  terbaru (episode tamu 2 menjadi 4 ketika data tamu lebih baru).
- Favorit ditambahkan dua kali tetap satu entri.
- `POST` dengan `Origin` asing: 403. Tanpa session: 401.
- Episode 3 sebagai tamu: iframe ada. Episode 5 sebagai tamu: gate ada, tanpa
  iframe dan tanpa URL embed. Episode 5 setelah login: iframe ada.

## 8. Batasan yang jujur

- Secret Turnstile yang diberikan pemilik ditolak Cloudflare
  (`invalid-input-secret`). Selama itu terjadi, server mencatat peringatan dan
  melewati verifikasi supaya login tidak mati total; widget tetap tampil di
  form. Setelah secret yang benar dipasang, verifikasi aktif otomatis tanpa
  perubahan kode.
- Player memakai iframe pihak ketiga yang tidak mengirim posisi playback, jadi
  `position` di riwayat masih 0.
- OAuth dengan email yang sudah terdaftar tidak digabung otomatis. UI untuk
  menautkan akun belum ada.
- `AUTH_URL` hanya diisi untuk Production; preview memakai origin request
  sendiri untuk CSRF.
