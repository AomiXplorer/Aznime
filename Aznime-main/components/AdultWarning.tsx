'use client';

import { useEffect, useRef } from 'react';
import { AdultNotice } from './AdultNotice';

interface AdultWarningProps {
  open: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Peringatan 18+ yang muncul tepat saat penonton memilih tipe Hentai di
 * katalog, sebelum halaman dewasa dibuka. Muncul setiap kali dipilih, bukan
 * sekali per perangkat: ini gerbang masuk, bukan pengingat.
 */
export function AdultWarning({ open, onConfirm, onCancel }: AdultWarningProps) {
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    confirmRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onCancel();
      }
    };
    window.addEventListener('keydown', onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center p-4 sm:items-center">
      <button
        type="button"
        aria-label="Tutup peringatan usia"
        onClick={onCancel}
        className="absolute inset-0 cursor-default bg-black/80"
      />
      <div className="page-enter relative w-full max-w-sm">
        <AdultNotice
          title="Masuk ke bagian 18+?"
          description="Kamu akan membuka katalog hentai bersubtitle Indonesia. Lanjutkan hanya jika kamu sudah berusia 18 tahun atau lebih."
          confirmLabel="Ya, saya 18+"
          cancelLabel="Batal"
          onConfirm={onConfirm}
          onCancel={onCancel}
          confirmRef={confirmRef}
        />
      </div>
    </div>
  );
}
