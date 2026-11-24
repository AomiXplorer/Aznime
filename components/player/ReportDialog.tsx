'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Check, Copy, MessageCircle, X } from 'lucide-react';
import { PRIMARY_WHATSAPP_URL } from '@/lib/credits';
import { copyText } from './copy';

interface ReportDialogProps {
  text: string;
  onClose: () => void;
}

/** Dialog "Laporkan masalah pemutar". Dipasang hanya saat terbuka. */
export function ReportDialog({ text, onClose }: ReportDialogProps) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  const dialogRef = useRef<HTMLDialogElement>(null);

  const closeDialog = useCallback(() => {
    if (dialogRef.current?.open) dialogRef.current.close();
    onClose();
  }, [onClose]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const handleCancel = (event: Event) => {
      event.preventDefault();
      closeDialog();
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      closeDialog();
    };
    dialog.addEventListener('cancel', handleCancel);
    document.addEventListener('keydown', handleKeyDown, true);
    dialog.showModal();
    return () => {
      dialog.removeEventListener('cancel', handleCancel);
      document.removeEventListener('keydown', handleKeyDown, true);
      if (dialog.open) dialog.close();
      window.clearTimeout(timer.current);
    };
  }, [closeDialog]);

  const copy = async () => {
    const ok = await copyText(text);
    setCopied(ok);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setCopied(false), 2200);
  };

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="report-title"
      onClick={(event) => {
        if (event.target === event.currentTarget) closeDialog();
      }}
      className="fixed inset-0 m-0 flex h-dvh w-full max-h-none max-w-none items-end justify-center border-0 bg-transparent p-0 backdrop:bg-black/70 sm:items-center sm:p-4"
    >
      <div className="relative w-full max-w-md rounded-t-xl bg-surface p-4 ring-1 ring-white/10 sm:rounded-xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="report-title" className="text-[14px] font-semibold text-white">
              Laporkan masalah pemutar
            </h2>
            <p className="mt-1 text-[12px] leading-relaxed text-zinc-400">
              Salin detail di bawah, lalu kirim ke channel WhatsApp pengelola supaya bisa dicek.
            </p>
          </div>
          <button
            type="button"
            onClick={closeDialog}
            aria-label="Tutup"
            className="-mr-1 -mt-1 inline-flex size-9 cursor-pointer items-center justify-center rounded-md text-zinc-500 transition-colors duration-150 hover:bg-white/[0.06] hover:text-zinc-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>

        <pre className="mt-3 max-h-40 overflow-auto whitespace-pre-wrap rounded-md bg-black/40 p-3 text-[12px] leading-relaxed text-zinc-300">
          {text}
        </pre>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            autoFocus
            onClick={() => void copy()}
            className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-md bg-white px-3.5 text-[12.5px] font-semibold text-black transition-colors duration-150 hover:bg-white/85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
          >
            {copied ? (
              <Check className="size-3.5" aria-hidden="true" />
            ) : (
              <Copy className="size-3.5" aria-hidden="true" />
            )}
            {copied ? 'Detail tersalin' : 'Salin detail'}
          </button>
          {PRIMARY_WHATSAPP_URL ? (
            <a
              href={PRIMARY_WHATSAPP_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-9 items-center gap-1.5 rounded-md px-3 text-[12.5px] font-medium text-zinc-300 transition-colors duration-150 hover:bg-white/[0.06] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
            >
              <MessageCircle className="size-3.5" aria-hidden="true" />
              Buka WhatsApp
            </a>
          ) : null}
          <button
            type="button"
            onClick={closeDialog}
            className="ml-auto inline-flex h-9 cursor-pointer items-center rounded-md px-3 text-[12.5px] font-medium text-zinc-400 transition-colors duration-150 hover:bg-white/[0.06] hover:text-zinc-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
          >
            Tutup
          </button>
        </div>
      </div>
    </dialog>
  );
}
