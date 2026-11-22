'use client';

import { useId, type Ref } from 'react';
import { cn } from '@/lib/cn';

interface AdultNoticeProps {
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  note?: string;
  /** `page` dipakai gerbang penuh, `compact` untuk dialog di atas halaman lain. */
  size?: 'compact' | 'page';
  confirmRef?: Ref<HTMLButtonElement>;
}

/**
 * Kartu peringatan 18+ yang dipakai bersama oleh dialog masuk hentai dan
 * gerbang usia halaman /hentai, supaya keduanya tidak pernah berbeda gaya.
 */
export function AdultNotice({
  title,
  description,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
  note,
  size = 'compact',
  confirmRef,
}: AdultNoticeProps) {
  const uid = useId();
  const titleId = `${uid}-title`;
  const descriptionId = `${uid}-desc`;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      className={cn(
        'w-full rounded-[10px] border border-white/[0.09] bg-[#12141a] shadow-2xl shadow-black/70',
        size === 'page' ? 'max-w-md p-6' : 'max-w-sm p-5'
      )}
    >
      <div className="flex items-center gap-2">
        <span className="inline-flex h-[22px] items-center rounded-[3px] bg-accent px-1.5 text-[11px] font-bold leading-none tracking-wide text-white">
          18+
        </span>
        <span className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
          Konten dewasa
        </span>
      </div>

      <h2
        id={titleId}
        className={cn(
          'mt-3 font-bold text-white',
          size === 'page' ? 'text-[19px] leading-tight' : 'text-[16.5px] leading-snug'
        )}
      >
        {title}
      </h2>

      <p id={descriptionId} className="mt-2 text-[13px] leading-relaxed text-zinc-400">
        {description}
      </p>

      {note ? (
        <p className="mt-2.5 text-[11.5px] leading-relaxed text-zinc-500">{note}</p>
      ) : null}

      <div className="mt-5 flex flex-col gap-2 sm:flex-row-reverse">
        <button
          ref={confirmRef}
          type="button"
          onClick={onConfirm}
          className="inline-flex h-10 flex-1 cursor-pointer items-center justify-center rounded-md bg-white px-4 text-[13px] font-bold text-black transition-colors duration-150 hover:bg-white/85 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#12141a]"
        >
          {confirmLabel}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex h-10 flex-1 cursor-pointer items-center justify-center rounded-md border border-white/[0.12] px-4 text-[13px] font-semibold text-zinc-300 transition-colors duration-150 hover:border-white/25 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
        >
          {cancelLabel}
        </button>
      </div>
    </div>
  );
}
