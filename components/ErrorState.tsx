'use client';

import { AlertTriangle, RotateCcw } from 'lucide-react';

interface ErrorStateProps {
  title?: string;
  message: string;
  onRetry?: () => void;
}

export function ErrorState({
  title = 'Gagal memuat data',
  message,
  onRetry,
}: ErrorStateProps) {
  return (
    <div
      role="alert"
      className="flex flex-col items-center justify-center rounded-lg border border-rose-500/30 bg-[#12141a] px-6 py-12 text-center"
    >
      <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-lg border border-rose-500/30 bg-rose-950/40 text-rose-400">
        <AlertTriangle className="h-5 w-5" aria-hidden="true" />
      </div>
      <h2 className="font-display text-lg font-semibold text-zinc-100">{title}</h2>
      <p className="mt-1.5 max-w-md text-sm text-zinc-400">{message}</p>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="mt-5 inline-flex cursor-pointer items-center gap-2 rounded-md bg-[#be123c] px-4 py-2 text-sm font-medium text-white transition-colors duration-150 hover:bg-[#9f1239] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0b0e]"
        >
          <RotateCcw className="h-4 w-4" aria-hidden="true" />
          Coba Lagi
        </button>
      ) : null}
    </div>
  );
}
