import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-2xl flex-col items-center justify-center px-4 py-24 text-center">
      <p className="font-mono text-sm font-bold tabular-nums text-accent-ink">404</p>
      <h1 className="mt-2 font-display text-2xl font-bold text-ink sm:text-3xl">
        Halaman Tidak Ditemukan
      </h1>
      <p className="mt-2 text-sm text-muted">
        Anime atau episode yang Anda cari tidak tersedia atau alamat tautannya telah berubah.
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Link
          href="/"
          className="inline-flex h-10 items-center rounded-lg bg-accent px-5 text-sm font-bold text-white transition-colors duration-150 hover:bg-accent-hover"
        >
          Kembali ke Beranda
        </Link>
        <Link
          href="/anime"
          className="inline-flex h-10 items-center rounded-lg border border-line bg-surface px-5 text-sm font-semibold text-ink transition-colors duration-150 hover:border-line-accent hover:bg-elevated"
        >
          Jelajahi Katalog
        </Link>
      </div>
    </div>
  );
}
