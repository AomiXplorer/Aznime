'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AdultNotice } from './AdultNotice';

const STORAGE_KEY = 'aznime:age-verified';

interface AgeGateProps {
  children: React.ReactNode;
  /** Teks gerbang. Bawaannya untuk bagian hentai; bagian lain mengisinya sendiri. */
  description?: string;
  note?: string;
}

/**
 * Gerbang usia untuk seluruh bagian /hentai dan /manhwa18. Selama belum dikonfirmasi, konten
 * ditutup lapisan penuh dan scroll dikunci. Jawaban disimpan di localStorage
 * supaya penonton tidak ditanya berulang kali di perangkat yang sama; gerbang
 * per klik tetap ada di panel tipe katalog.
 */
const DEFAULT_DESCRIPTION =
  'Semua judul di halaman ini adalah hentai bersubtitle Indonesia. Dengan masuk, kamu menyatakan sudah berusia 18 tahun atau lebih.';

const DEFAULT_NOTE = 'Judul di sini tidak muncul di katalog anime, pencarian utama, maupun sitemap.';

export function AgeGate({ children, description, note }: AgeGateProps) {
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
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-canvas/95 px-4 py-10">
          <AdultNotice
            size="page"
            title="Bagian khusus dewasa"
            description={description ?? DEFAULT_DESCRIPTION}
            note={note ?? DEFAULT_NOTE}
            confirmLabel="Saya sudah 18 tahun"
            cancelLabel="Kembali ke beranda"
            onConfirm={confirm}
            onCancel={() => router.push('/')}
          />
        </div>
      ) : null}
    </>
  );
}
