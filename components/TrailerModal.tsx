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
      className="m-auto w-[calc(100%-2rem)] max-w-4xl rounded-xl border border-white/15 bg-[#12141a] p-0 text-zinc-100 shadow-2xl"
    >
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <h2 id="trailer-modal-title" className="truncate pr-4 text-sm font-semibold text-zinc-100">
          Trailer — {title}
        </h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Tutup trailer"
          className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-md text-zinc-400 transition-colors duration-150 hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      <div className="relative aspect-video w-full bg-black">
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
