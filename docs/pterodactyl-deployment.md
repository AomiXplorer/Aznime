# Deploy AzNime ke Pterodactyl

Produksi aznime.com berjalan di Pterodactyl pada port 3543 melalui Cloudflare Tunnel. Push ke main di AomiXplorer/Aznime memicu rilis baru. Pterodactyl memeriksa main sekitar setiap 90 detik, menjalankan build dan tes, lalu memverifikasi SHA melalui /api/health. Jika aktivasi gagal, proses kembali ke rilis sehat sebelumnya. Vercel tersedia sebagai tujuan rollback DNS. Perpindahan host tidak memerlukan migrasi skema Supabase.

## Server dan startup

- Panel → server 001edc20 → Startup → pilih image Node.js 22. Alokasi utama adalah renei:3543. Egg menambahkan prefix /usr/local/bin/ pada perintah di CMD_RUN.
- Salin scripts/pterodactyl.mjs dari commit yang ditinjau ke /home/container/pterodactyl.mjs. Atur CMD_RUN menjadi node /home/container/pterodactyl.mjs. Simpan package.json dan checkout aplikasi di direktori rilis. Egg menjalankan npm install saat mendeteksi package.json di root container.
- Untuk menjalankan produksi saja, salin scripts/pterodactyl-start.mjs ke /home/container/start-aznime.mjs dan simpan supervisor produksi di /home/container/production/pterodactyl.mjs. Atur CMD_RUN menjadi `node /home/container/start-aznime.mjs` tanpa argumen SHA preview. Wrapper menjalankan produksi di 127.0.0.1:3543, menulis bukti kesiapan loopback, dan tidak memulai proses preview.
- Untuk preview commit, taruh salinan skrip di direktori terpisah, misalnya /home/container/staging/pterodactyl.mjs. Atur CMD_RUN menjadi node /home/container/staging/pterodactyl.mjs --preview SHA, dengan SHA lengkap yang berasal dari repo AzNime di GitHub. Preview hanya mendengarkan pada loopback dan mengirim X-Robots-Tag: noindex, nofollow. Port 3543 dipakai satu proses dalam satu waktu.
- Skrip membuat shared/ dan releases/ relatif terhadap lokasinya. shared/ menyimpan cache npm, repo Git bare, konfigurasi, dan release.json. releases/ menyimpan build aktif dan build sebelumnya.
- Set AZNIME_AUTODEPLOY=1 di produksi untuk mengambil main dari origin GitHub tetap setiap 90 detik melalui HTTPS. Supervisor mensyaratkan fast-forward dan melewati commit yang terakhir gagal. Hak tulis ke main menentukan siapa yang dapat memicu deploy. Jika main sudah memakai commit bertanda tangan, siapkan keyring publik tepercaya sebelum mengaktifkan AZNIME_VERIFY_SIGNED_COMMITS=1.
- Set AZNIME_TUNNEL_HEALTH_URL ke URL HTTPS staging atau produksi yang tepat dengan path /api/health setelah routing tersedia. Pemeriksaan publik mengharuskan respons menyebut SHA kandidat. Proxy atau cache yang menyajikan versi lama akan menggagalkan aktivasi.
- Git, tar, npm, dan Linux dengan dukungan process groups dibutuhkan. npm ci termasuk dev dependencies dari lockfile, npm test, dan npm run build dijalankan pada setiap rilis bersih. Unduhan paket cache dipakai ulang. Build perlu akses keluar ke Google Fonts, npm, GitHub, dan provider data yang digunakan saat prerender.

## Konfigurasi lingkungan

Utamakan variabel Startup individual. Jika variabel tidak tersedia, minta admin hosting menambahkannya pada Egg. Pengaturan saat audit hanya menampilkan GIT_ADDRESS, BRANCH, USERNAME, ACCESS_TOKEN, dan CMD_RUN. Jangan taruh rahasia di CMD_RUN karena nilainya bisa tampil di konsol. Jika admin tidak menyediakan variabel, simpan pasangan key/value lewat SFTP di shared/runtime.env dengan izin 0600 dan akses direktori 0700. Untuk preview, gunakan shared/runtime.env di bawah direktori preview. File di luar rilis bertahan saat deploy dan variabel Startup mempunyai prioritas.

| Pengaturan | Nama variabel |
|---|---|
| Redis wajib untuk akun, sesi, dan rate limit | UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN |
| Prefix Redis untuk preview yang memakai instance bersama | AZNIME_REDIS_KEY_PREFIX (contoh aznime:staging:migration:) |
| Akun dan URL autentikasi | AUTH_SECRET, AUTH_URL |
| Supabase sesuai mode persistence saat ini | AZNIME_PERSISTENCE, AZNIME_HISTORY_PERSISTENCE, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY |
| OAuth | GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, DISCORD_CLIENT_ID, DISCORD_CLIENT_SECRET |
| Turnstile | TURNSTILE_SITE_KEY atau NEXT_PUBLIC_TURNSTILE_SITE_KEY, TURNSTILE_SECRET_KEY, TURNSTILE_HOSTNAME, TURNSTILE_REQUIRED |
| Telegram dan maintenance | TELEGRAM_BOT_TOKEN, TELEGRAM_WEBHOOK_SECRET, TELEGRAM_ADMIN_IDS, MAINTENANCE_BYPASS_SECRET |
| Canonical, verifikasi dan override sumber opsional | NEXT_PUBLIC_SITE_URL atau APP_URL, GOOGLE_SITE_VERIFICATION, HIDORISTREAM_BASE_URL, MALZ_API_BASE_URL, MANGASUSUKU_API_BASE_URL, NEKOPOI_API_BASE_URL |
| Tunnel dan deploy | CLOUDFLARE_TUNNEL_TOKEN, AZNIME_BIND_HOST, AZNIME_AUTODEPLOY, AZNIME_VERIFY_SIGNED_COMMITS, AZNIME_TUNNEL_HEALTH_URL, SERVER_PORT |

Set AUTH_URL dan NEXT_PUBLIC_SITE_URL ke URL HTTPS lingkungan yang tepat. Pertahankan AUTH_SECRET dan mode persistence produksi saat cutover agar sesi dan data tetap terbaca. SUPABASE_ANON_KEY muncul di Vercel dan hanya direferensikan alat migrasi lokal di repo, sehingga aplikasi tidak membutuhkannya. Salin nilai deployment produksi langsung dari dashboard yang berwenang atau pengelola rahasia. Jika nilai sensitif disembunyikan Vercel, ambil dari sumber aslinya di provider. Gunakan Redis, Supabase, OAuth, dan Telegram staging terpisah saat menguji operasi yang menulis. Tambahkan callback /api/auth/oauth/google/callback dan /api/auth/oauth/discord/callback pada hostname staging ke masing-masing provider.

Jika preview memakai instance Redis produksi, set AZNIME_REDIS_KEY_PREFIX dengan format aznime:staging:NAMA: dan gunakan AUTH_SECRET tersendiri. Jalankan preview dari direktori rilis yang semua build-nya mendukung prefix, termasuk build rollback. Prefix diterapkan ke rate limit, sesi, akun, cache, dan status maintenance di klien Redis. Instance bersama tetap memakai kuota dan izin token yang sama.

## Tunnel, DNS, dan Turnstile

1. Cloudflare Zero Trust → Networks → Connectors → Cloudflare Tunnels → Create a tunnel. Gunakan connector cloudflared. Ambil token langsung dari dashboard dan simpan sebagai CLOUDFLARE_TUNNEL_TOKEN. Instal biner Linux sesuai arsitektur di shared/bin/cloudflared (izin 0755), dengan SHA-256 dari rilis resmi Cloudflare. Proses supervisor memulai connector, meneruskan sinyal dan mencoba ulang dengan jeda hingga 60 detik.
2. Untuk connector di container yang sama, jalankan pemeriksaan dari namespace connector ke http://127.0.0.1:3543/api/health sebelum menambah route. Jika connector terpisah, gunakan alamat privat origin yang benar-benar dapat dijangkau. Untuk koneksi lintas container, set AZNIME_BIND_HOST=0.0.0.0 setelah firewall membatasi akses port 3543 ke connector. Set AZNIME_TRUST_CLOUDFLARE=1 hanya saat origin hanya bisa dijangkau connector yang tepercaya, agar rate limit memakai CF-Connecting-IP. Supervisor mengaktifkannya otomatis untuk connector yang berbagi loopback. Panel, SSH, dan SFTP tetap di luar tunnel.
3. Setelah izin DNS staging dikonfirmasi, buat Published Application Route staging.aznime.com ke origin yang lulus pemeriksaan. Aktifkan Cloudflare Access untuk pengujian UI bila sesuai. Pemeriksaan publik supervisor memerlukan akses ke /api/health, jadi uji rute itu melalui connector atau gunakan probe lokal jika Access menghalanginya. Batasi akses ke /api/diag lewat Cloudflare jika endpoint ini hanya dibutuhkan operator. Debug route tersebut membuat beberapa permintaan upstream setiap kali dipanggil.
4. Cloudflare dashboard → Turnstile → Add widget → pilih Managed → tambahkan hostname staging. Simpan site key dan secret key staging, set TURNSTILE_HOSTNAME=staging.aznime.com dan TURNSTILE_REQUIRED=1. Login dan daftar memeriksa Siteverify dan menyimpan hash token sekali pakai di Redis. Uji token valid, kosong, salah, kedaluwarsa, dan dua penggunaan token yang sama. Uji Google dan Discord OAuth melalui callback mereka yang terpisah. Gunakan widget dengan hostname aznime.com saat cutover. Untuk Telegram, gunakan bot staging dan set webhook ke /api/telegram/webhook dengan secret header yang sesuai.
5. Sebelum cutover, uji katalog, detail, pemutaran, pencarian, thumbnail, manhwa, login, registrasi, OAuth, Telegram, API, SEO, restart, serta deploy dan rollback. Simpan DNS Vercel untuk apex dan www. Setelah staging lulus dan pemilik menyetujui perubahan, arahkan apex dan www ke tunnel produksi. Next.js mengarahkan www ke apex sambil mempertahankan path dan query. Verifikasi HTTPS dan health yang mengembalikan SHA rilis. Pertahankan deployment Vercel untuk fallback.

## Backup, restart, log, dan rollback

- Backup shared/release.json, kedua rilis yang sehat dan skrip startup melalui Backups di panel. Simpan konfigurasi rahasia di pengelola rahasia dan cadangkan Redis serta Supabase lewat fasilitas provider. Dokumentasikan DNS lama sebelum cutover. Gunakan prosedur pemulihan yang sudah diuji pada data staging.
- Restart melalui Console → Restart. Untuk perubahan shared/runtime.env, restart setelah menyimpan konfigurasi. Baca log Console dengan awalan [deploy], [tunnel], dan [aznime]. UI Resources menampilkan CPU, RAM dan disk. /api/health memeriksa proses aplikasi. Uji login, database, dan upstream secara terpisah.
- Kandidat hanya dijadikan rilis aktif setelah build, tes, dan pemeriksaan HTTP lolos. Jika gagal saat aktivasi, rilis sebelumnya dinyalakan lagi dan SHA yang gagal tercatat di release.json. Rollback manual dilakukan dengan mematikan auto-deploy, menghentikan proses, mengganti current di shared/release.json ke SHA sebelumnya yang masih tersimpan, dan menyalakan ulang. Jika perlu mengembalikan trafik publik ke Vercel, pulihkan DNS terdokumentasi melalui prosedur cutover yang disetujui.
- Jika port tampil terbuka pada panel tetapi origin loopback tidak dapat dijangkau connector di container lain, periksa lokasi connector dan firewall. Jika build gagal, periksa akses HTTPS ke registry dan Google Fonts, cache npm yang dapat ditulis, serta binary native Sharp/SWC yang sesuai dengan arsitektur image. Pergantian proses pada satu alokasi dapat menimbulkan jeda singkat. Rilis lain tidak dibangun di atas direktori rilis aktif.

## Snapshot DNS cutover

Cloudflare menyimpan DNS situs, dan file /home/container/production/shared/dns-before-cutover.json memuat record Vercel untuk pemulihan apex dan www. Jika rollback DNS diperlukan, pulihkan record alamat apex dan CNAME www dari snapshot, lalu verifikasi kedua hostname melalui HTTPS. TXT verifikasi domain dipertahankan saat cutover.
