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
      className="flex flex-col items-center justify-center rounded-2xl border border-line-accent bg-surface px-6 py-12 text-center"
    >
      <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl border border-line-accent bg-accent-soft text-accent-ink">
        <AlertTriangle className="h-5 w-5" aria-hidden="true" />
      </div>
      <h2 className="font-display text-lg font-bold text-ink">{title}</h2>
      <p className="mt-1.5 max-w-md text-sm text-muted">{message}</p>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="mt-5 inline-flex h-10 cursor-pointer items-center gap-2 rounded-lg bg-accent px-5 text-sm font-bold text-white transition-colors duration-150 hover:bg-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ink focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
        >
          <RotateCcw className="h-4 w-4" aria-hidden="true" />
          Coba Lagi
        </button>
      ) : null}
    </div>
  );
}
