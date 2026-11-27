# Multi-source film scraper

Katalog `/film` tidak lagi bergantung pada satu sumber. Halaman hanya memanggil
**Movie Service** (`@/lib/scrapers`), dan service itu yang mengatur sumber,
timeout, fallback, normalisasi, filter, dan deduplikasi.

```
/film, /api/film, beranda
        ↓
 getMovies() / getMovieDetail() / getFilmFeed()      lib/scrapers/index.ts
        ↓
   Source Manager                                     lib/scrapers/manager.ts
        ↓
   Registry (priority)                                lib/scrapers/registry.ts
        ↓
   Adapter → rumahfilm/source.ts (+ sumber lain)
        ↓
 normalize → content filter → deduplicate             normalize.ts / filter.ts / deduplicate.ts
```

## Struktur

| File | Fungsi |
| --- | --- |
| `types.ts` | `Movie`, `FilmSource`, `ScrapeMode`, `SourceStatus`, `MoviesResult` |
| `registry.ts` | Daftar sumber + pengurutan priority |
| `manager.ts` | Fallback/aggregate, timeout, isolasi error, cache, detail |
| `health.ts` | Status `healthy / degraded / unavailable` + cooldown (in-memory) |
| `normalize.ts` | Bentuk `Movie` seragam, validasi URL/poster/tahun, kunci judul |
| `filter.ts` | Filter konten yang sama untuk semua sumber |
| `deduplicate.ts` | ID eksternal → judul+tahun → judul |
| `cards.ts` | `Movie` → kartu UI yang sudah ada |
| `rumahfilm/source.ts` | Adapter RumahFilm (scraper lama tidak diubah) |
| `manager.test.ts` | Tes fallback, timeout, cooldown, aggregate, dedupe, filter |

## Perilaku

- **Mode `fallback` (bawaan)**: sumber berikutnya hanya dicoba bila sumber sebelumnya
  gagal (HTTP error, timeout, error jaringan, parser error) atau mengembalikan hasil kosong.
- **Mode `aggregate`**: semua sumber aktif diambil bersamaan lalu digabung dan
  di-dedupe. Sumber priority tinggi menang, field kosong diisi dari duplikat.
  Pakai `getMovies({ mode: 'aggregate' })`.
- **Halaman kosong**: kosong di halaman 1 → fallback. Kosong di halaman > 1
  dianggap akhir katalog (bukan kegagalan), supaya sumber cadangan tidak
  ditembak untuk setiap halaman terakhir. Error di halaman mana pun tetap jatuh
  ke sumber berikutnya untuk halaman itu.
- **Timeout**: bawaan 8000 ms per sumber (`FILM_SOURCE_TIMEOUT_MS`), bisa
  ditimpa per sumber lewat properti `timeout` atau per panggilan lewat
  `getMovies({ timeout })`. RumahFilm diberi 15000 ms karena rantai fetch-nya
  memang punya beberapa percobaan.
- **Cooldown**: 3 kegagalan beruntun → `unavailable`, dilewati selama
  `FILM_SOURCE_COOLDOWN_MS` (bawaan 60000). Setelah itu dicoba lagi.
- **Kegagalan total**: `getMovies` tidak pernah melempar; hasilnya `offline: true`
  sehingga empty/error state yang sudah ada yang tampil.
- **Cache**: hasil manager di-cache 10 menit (2 menit bila berasal dari sumber
  cadangan, 1 menit bila offline) dengan dedupe request yang sedang berjalan.
  Cache internal RumahFilm tetap dipakai di bawahnya.
- **Log**: satu baris per sumber, mis. `[source] RumahFilm: timeout`. Tidak ada HTML mentah.
- **Detail film**: kartu dari sumber utama tetap `/film/<slug>`; kartu dari
  sumber cadangan membawa `?src=<id>` agar detail ditanyakan ke sumber yang tepat.

## Menambah sumber baru

1. Buat adapter yang mengimplementasikan `FilmSource`:

```ts
// lib/scrapers/source-b/source.ts
import type { FilmSource } from '../types';

export const sourceB: FilmSource = {
  id: 'source-b',
  name: 'Source B',
  priority: 2,
  async scrapeMovies({ page = 1, signal } = {}) {
    // fetch + parse. Lempar error bila gagal; manager yang menangani fallback.
    return { movies: [/* Movie[] */], pagination: undefined };
  },
  // opsional: async getMovieDetail(slug) { ... }
};
```

2. Tambahkan ke `filmSources` di `registry.ts`.

Tidak ada perubahan di `/app/film/page.tsx` atau `/components/*`. Adapter cukup
mengisi `title`, `slug`, `url`, `sourceUrl`; `poster`, `year`, `rating`, `genres`,
`externalIds` (TMDB/IMDb) opsional. Metadata `source` diisi manager.

## Validasi sumber baru (sebelum masuk registry production)

- Sumber dapat diakses dan HTML-nya dapat di-parse
- Judul dan URL valid; poster tidak rusak
- Tidak mengembalikan konten di luar scope (dewasa, dsb.)
- Parser tidak menghasilkan duplikat berlebihan
- Sumber memakai fetch biasa pada konten publik. Di luar scope: bypass
  proteksi/CAPTCHA/autentikasi, proxy berputar, crawler terdistribusi,
  scraping URL streaming, downloader

## Tes

```
npm test
```

`lib/scrapers/manager.test.ts` mencakup skenario PRD: A→HTTP 500 lalu B berhasil;
A dan B timeout lalu C berhasil; semua gagal (tidak crash, `offline: true`).
