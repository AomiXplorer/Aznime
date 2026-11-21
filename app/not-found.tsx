import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-2xl flex-col items-center justify-center px-4 py-24 text-center">
      <p className="font-mono text-sm font-semibold text-rose-400">404</p>
      <h1 className="mt-2 font-display text-2xl font-bold text-white sm:text-3xl">
        Halaman Tidak Ditemukan
      </h1>
      <p className="mt-2 text-sm text-zinc-400">
        Anime atau episode yang Anda cari tidak tersedia atau alamat tautannya telah berubah.
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Link
          href="/"
          className="rounded-md bg-[#be123c] px-4 py-2 text-sm font-medium text-white transition-colors duration-150 hover:bg-[#9f1239]"
        >
          Kembali ke Beranda
        </Link>
        <Link
          href="/anime"
          className="rounded-md border border-white/15 bg-[#12141a] px-4 py-2 text-sm font-medium text-zinc-200 transition-colors duration-150 hover:border-white/30 hover:text-white"
        >
          Jelajahi Katalog
        </Link>
      </div>
    </div>
  );
}
