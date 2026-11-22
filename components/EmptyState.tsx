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
    <div className="flex flex-col items-start rounded-[6px] border border-[#2b2222] bg-surface px-6 py-10">
      <Film className="h-5 w-5 text-zinc-600" aria-hidden="true" />
      <h2 className="mt-4 font-display text-[17px] font-semibold tracking-[-0.02em] text-white">{title}</h2>
      <p className="mt-1.5 max-w-[52ch] text-[13px] leading-relaxed text-zinc-400">{description}</p>
      {actionLabel && actionHref ? (
        <Link
          href={actionHref}
          className="mt-5 inline-flex items-center justify-center rounded-[4px] bg-white px-4 py-2 text-[12.5px] font-semibold text-black transition-colors duration-150 hover:bg-white/85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
        >
          {actionLabel}
        </Link>
      ) : null}
    </div>
  );
}
