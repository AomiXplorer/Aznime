import { MessageCircle } from 'lucide-react';
import { CREDITS } from '@/lib/credits';
import { cn } from '@/lib/cn';

interface CreditListProps {
  /**
   * `panel` dipakai di dalam menu hamburger (baris penuh, menyatu dengan latar),
   * `inline` dipakai di footer (lebih ringkas).
   */
  variant?: 'panel' | 'inline';
  className?: string;
}

export function CreditList({ variant = 'panel', className }: CreditListProps) {
  if (variant === 'inline') {
    return (
      <ul className={cn('flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[13px]', className)}>
        {CREDITS.map((credit) => (
          <li key={credit.name} className="flex items-center gap-1.5">
            <span className="text-zinc-400">Credit</span>
            <a
              href={credit.channelUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`${credit.channelLabel} (dibuka di tab baru)`}
              className="inline-flex items-center gap-1 font-semibold text-zinc-300 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
            >
              {credit.name}
              <MessageCircle className="h-3.5 w-3.5" aria-hidden="true" />
            </a>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <div className={cn('space-y-1', className)}>
      <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">Credit</p>
      <ul className="space-y-1">
        {CREDITS.map((credit) => (
          <li key={credit.name}>
            <a
              href={credit.channelUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`${credit.channelLabel} (dibuka di tab baru)`}
              className="flex items-center justify-between gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-zinc-300 transition-colors hover:bg-white/[0.06] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
            >
              <span className="flex items-center gap-2">
                <span
                  aria-hidden="true"
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent/15 text-[11px] font-bold text-accent"
                >
                  {credit.name.charAt(0)}
                </span>
                {credit.name}
              </span>
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-zinc-400">
                WhatsApp
                <MessageCircle className="h-3.5 w-3.5" aria-hidden="true" />
              </span>
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
