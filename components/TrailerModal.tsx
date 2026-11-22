'use client';

import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import type { AniListTrailer } from '@/lib/scraper/types';

interface TrailerModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  trailer: AniListTrailer | null;
}

export function TrailerModal({ open, onClose, title, trailer }: TrailerModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open) {
      if (!dialog.open) dialog.showModal();
    } else if (dialog.open) {
      dialog.close();
    }
  }, [open]);

  if (!trailer?.id || trailer.site !== 'youtube') {
    return null;
  }

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="trailer-modal-title"
      onClose={onClose}
      onClick={(e) => {
        if (e.target === dialogRef.current) onClose();
      }}
      className="m-auto w-[calc(100%-2rem)] max-w-4xl rounded-2xl border border-line bg-surface p-0 text-ink shadow-2xl backdrop:bg-black/80"
    >
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
        <h2 id="trailer-modal-title" className="truncate pr-4 font-display text-sm font-bold text-ink">
          Trailer — {title}
        </h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Tutup trailer"
          className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-lg text-muted transition-colors duration-150 hover:bg-elevated hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ink"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      <div className="relative aspect-video w-full bg-[#050407]">
        {open ? (
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${encodeURIComponent(trailer.id)}?autoplay=1&rel=0`}
            title={`Trailer ${title}`}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className="h-full w-full border-0"
          />
        ) : null}
      </div>
    </dialog>
  );
}
