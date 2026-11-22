import Link from 'next/link';
import { Film } from 'lucide-react';

interface EmptyStateProps {
  title: string;
  description: string;
  actionLabel?: string;
  actionHref?: string;
}

export function EmptyState({
  title,
  description,
  actionLabel,
  actionHref,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-white/10 bg-surface px-6 py-14 text-center">
      <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-lg border border-white/10 bg-elevated text-zinc-400">
        <Film className="h-5 w-5" aria-hidden="true" />
      </div>
      <h2 className="font-display text-lg font-semibold text-zinc-100">{title}</h2>
      <p className="mt-1.5 max-w-md text-sm text-zinc-400">{description}</p>
      {actionLabel && actionHref ? (
        <Link
          href={actionHref}
          className="mt-6 inline-flex items-center justify-center rounded-md bg-accent px-4 py-2 text-sm font-medium text-white transition-colors duration-150 hover:bg-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ink focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
        >
          {actionLabel}
        </Link>
      ) : null}
    </div>
  );
}
