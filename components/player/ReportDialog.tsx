'use client';

import { useEffect, useRef, useState } from 'react';
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

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener('keydown', onKey);
      window.clearTimeout(timer.current);
    };
  }, [onClose]);

  const copy = async () => {
    const ok = await copyText(text);
    setCopied(ok);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setCopied(false), 2200);
  };

  return (
    <div
      className="fixed inset-0 z-[90] flex items-end justify-center bg-black/70 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="report-title"
    >
      <button
        type="button"
        aria-label="Tutup laporan"
        className="absolute inset-0 cursor-default"
        onClick={onClose}
        tabIndex={-1}
      />
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
            onClick={onClose}
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
            onClick={onClose}
            className="ml-auto inline-flex h-9 cursor-pointer items-center rounded-md px-3 text-[12.5px] font-medium text-zinc-400 transition-colors duration-150 hover:bg-white/[0.06] hover:text-zinc-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
}
