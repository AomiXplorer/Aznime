# Aznime — Platform Streaming Anime Subtitle Indonesia

Platform streaming anime berbasis **Next.js App Router**, **TypeScript**, dan **Tailwind CSS** dengan scraper server-side, infinite scrolling, trailer **AniList**, dan pemutar multi-server (`iframe`, `video`, `hls.js`).

## Fitur Utama

- **Beranda gaya katalog streaming**: hero layar penuh yang berganti otomatis, Top 10 populer, baris Episode terbaru / Sedang tayang / Baru tamat.
- **Server tercepat otomatis**: saat episode dibuka, browser mengukur waktu respons semua server paralel dan memakai yang pertama merespons (server direct HLS/MP4 diberi toleransi 250 ms). Jika server macet >10 detik atau gagal diputar, pemutar pindah ke server tercepat berikutnya. Memilih server manual menonaktifkan perpindahan otomatis.
- **Katalog & filter**: status, tipe, genre, urutan; infinite scrolling dengan `IntersectionObserver`.
- **Pencarian cepat** (`Ctrl+K`) dengan overlay beranimasi, debounce, navigasi keyboard, dan halaman `/search`.
- **Detail anime & trailer AniList**, daftar episode, unduhan batch, rekomendasi.
- **Jadwal tayang** harian di `/schedule`.

## Struktur Direktori

- `lib/scraper/` — modul scraper server-side.
- `lib/anilist.ts` — integrasi AniList untuk trailer dan banner.
- `app/api/` — Route Handlers (`/api/anime`, `/api/search`, `/api/filters`).
- `app/` — halaman App Router; `app/template.tsx` memberi transisi antar halaman.
- `components/` — komponen UI.

## Environment Variables

Lihat `.env.example`. Domain produksi sudah **https://aznime.web.id** dan menjadi
default di `lib/site.ts`, jadi tidak perlu env apa pun untuk deploy normal.

- `NEXT_PUBLIC_SITE_URL` *(opsional)* — override URL publik untuk metadata, Open Graph,
  `robots.txt`, dan `sitemap.xml` (mis. saat staging di domain lain).
- `HIDORISTREAM_BASE_URL` *(opsional)* — override domain upstream scraper.

Variabel `VERCEL_URL` / `VERCEL_PROJECT_PRODUCTION_URL` tidak lagi dipakai.

## Pengembangan Lokal

```bash
npm install
npm run test
npm run lint
npm run build
npm run dev
```
