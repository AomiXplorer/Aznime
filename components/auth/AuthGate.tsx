'use client';

import { useEffect, useRef } from 'react';
import { Lock } from 'lucide-react';
import { useAuth } from './AuthProvider';

interface AuthGateProps {
  seriesTitle: string;
  episodeNumber: string | null;
  returnTo: string;
}

/**
 * Tampil menggantikan pemutar ketika tamu membuka episode 4 ke atas. Tidak ada
 * iframe, URL embed, atau tautan unduhan yang dikirim ke browser pada kondisi
 * ini; server hanya mengirim panel gate ini.
 */
export function AuthGate({ seriesTitle, episodeNumber, returnTo }: AuthGateProps) {
  const { openAuth, user } = useAuth();
  const openedRef = useRef(false);

  useEffect(() => {
    if (openedRef.current || user) return;
    openedRef.current = true;
    openAuth('login', returnTo);
  }, [openAuth, returnTo, user]);

  return (
    <div className="relative aspect-video w-full overflow-hidden border border-line bg-surface">
      <div className="flex h-full flex-col items-center justify-center gap-3 px-5 py-8 text-center">
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-line text-accent">
          <Lock className="h-4 w-4" aria-hidden="true" />
        </span>
        <h2 className="max-w-[26ch] text-[17px] leading-snug text-white sm:text-[19px]">
          Lanjutkan pengalaman menontonmu
        </h2>
        <p className="max-w-[46ch] text-[12.5px] leading-relaxed text-zinc-400">
          Episode {episodeNumber || 'ini'} dari {seriesTitle} hanya tersedia untuk anggota. Buat akun gratis
          untuk melanjutkan menonton dan menyimpan riwayat serta daftar favoritmu.
        </p>
        <div className="mt-1 flex flex-wrap items-center justify-center gap-2">
          <button
            type="button"
            onClick={() => openAuth('login', returnTo)}
            className="inline-flex h-9 cursor-pointer items-center rounded-[4px] bg-accent-strong px-4 text-[12.5px] font-semibold text-white transition-colors duration-150 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
          >
            Masuk
          </button>
          <button
            type="button"
            onClick={() => openAuth('signup', returnTo)}
            className="inline-flex h-9 cursor-pointer items-center rounded-[4px] border border-line px-4 text-[12.5px] font-medium text-zinc-200 transition-colors duration-150 hover:border-zinc-600 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
          >
            Daftar gratis
          </button>
        </div>
        <p className="mt-1 text-[11px] text-zinc-600">Episode 1-3 tetap bisa ditonton tanpa akun.</p>
      </div>
    </div>
  );
}
