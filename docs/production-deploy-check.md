# Verifikasi deploy produksi Pterodactyl

Produksi AzNime di `aznime.com` mengambil commit terbaru dari cabang `main` GitHub secara otomatis. Untuk memicu rilis, commit perubahan ke `main`. Supervisor memeriksa cabang sekitar setiap 90 detik, membangun dan menjalankan tes, lalu mengaktifkan rilis yang lolos.

## Memastikan rilis aktif

1. Buka `https://aznime.com/api/health` dengan cache browser dinonaktifkan.
2. Pastikan respons berisi `"ok":true` dan nilai `release` sama dengan SHA commit terbaru di `main`.
3. Pastikan halaman utama `https://aznime.com/` dapat dibuka. `https://www.aznime.com/` harus mengarah ke domain utama.
4. Jika build atau pemeriksaan kesehatan gagal, supervisor mempertahankan rilis sehat sebelumnya. Periksa log server sebelum mencoba ulang.

Perintah startup produksi menggunakan `/home/container/start-aznime.mjs` tanpa argumen preview. Perintah ini menjalankan supervisor produksi dan pemeriksaan kesiapan, tanpa memulai server staging.
