'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

const STORAGE_KEY = 'aznime:age-verified';

interface AgeGateProps {
  children: React.ReactNode;
}

/**
 * Gerbang usia untuk seluruh bagian /hentai. Selama belum dikonfirmasi, konten
 * ditutup lapisan penuh dan scroll dikunci. Jawaban disimpan di localStorage
 * supaya penonton tidak ditanya berulang kali di perangkat yang sama.
 */
export function AgeGate({ children }: AgeGateProps) {
  const router = useRouter();
  const [unlocked, setUnlocked] = useState<boolean | null>(null);

  useEffect(() => {
    try {
      setUnlocked(window.localStorage.getItem(STORAGE_KEY) === '1');
    } catch {
      setUnlocked(false);
    }
  }, []);

  const locked = unlocked !== true;

  useEffect(() => {
    if (!locked) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [locked]);

  const confirm = () => {
    try {
      window.localStorage.setItem(STORAGE_KEY, '1');
    } catch {
      /* localStorage bisa diblokir; gerbang tetap terbuka untuk sesi ini. */
    }
    setUnlocked(true);
  };

  return (
    <>
      {children}
      {locked ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="age-gate-title"
          className="fixed inset-0 z-[70] flex items-center justify-center bg-canvas/95 px-5 py-10"
        >
          <div className="w-full max-w-md rounded-xl border border-white/10 bg-surface p-7 shadow-2xl shadow-black/70">
            <span
              aria-hidden="true"
              className="block text-[3.2rem] font-extrabold leading-none tracking-tight text-rose-500"
            >
              18+
            </span>
            <h2 id="age-gate-title" className="mt-3 text-lg font-bold text-white">
              Bagian khusus dewasa
            </h2>
            <p className="mt-2 text-[13.5px] leading-relaxed text-zinc-400">
              Semua judul di halaman ini adalah konten hentai bersubtitle Indonesia. Dengan masuk,
              kamu menyatakan sudah berusia 18 tahun atau lebih dan menontonnya atas kehendak
              sendiri.
            </p>
            <div className="mt-6 flex flex-col gap-2.5 sm:flex-row">
              <button
                type="button"
                onClick={confirm}
                className="inline-flex h-11 flex-1 cursor-pointer items-center justify-center rounded-md bg-white px-5 text-sm font-bold text-black transition-colors duration-150 hover:bg-white/85 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
              >
                Saya sudah 18 tahun
              </button>
              <button
                type="button"
                onClick={() => router.push('/')}
                className="inline-flex h-11 flex-1 cursor-pointer items-center justify-center rounded-md border border-white/12 px-5 text-sm font-semibold text-zinc-300 transition-colors duration-150 hover:border-white/25 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
              >
                Kembali ke beranda
              </button>
            </div>
            <p className="mt-4 text-[11.5px] leading-relaxed text-zinc-500">
              Konten ini tidak ditampilkan di katalog anime, pencarian utama, maupun sitemap.
            </p>
          </div>
        </div>
      ) : null}
    </>
  );
}
