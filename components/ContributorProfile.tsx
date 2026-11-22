import { ArrowUpRight } from 'lucide-react';
import { cn } from '@/lib/cn';
import type { Contributor, ContributorMotif } from '@/lib/credits';
import { WhatsAppIcon } from './icons/WhatsAppIcon';

interface ContributorMarkProps {
  motif: ContributorMotif;
  active: boolean;
  className?: string;
}

/**
 * Placeholder artwork berbasis SVG: cakram matahari untuk Aomi, bulan sabit
 * untuk Azura. Tanpa foto wajah dan tanpa emoji, jadi tetap tajam di semua
 * ukuran dan tidak bergantung pada aset biner.
 */
function ContributorMark({ motif, active, className }: ContributorMarkProps) {
  const hairline = active ? 'rgba(239,232,224,0.38)' : 'rgba(239,232,224,0.18)';
  const ink = active ? 'rgba(239,232,224,0.82)' : 'rgba(239,232,224,0.42)';

  return (
    <span className={cn('inline-flex shrink-0 items-center justify-center', className)} aria-hidden="true">
      <svg viewBox="0 0 80 80" className="h-full w-full">
        <circle cx="40" cy="40" r="39" fill="#131010" stroke="#2b2222" strokeWidth="1" />
        {motif === 'sun' ? (
          <g fill="none" strokeLinecap="round">
            <path d="M14 54h52" stroke={hairline} strokeWidth="1" />
            <path d="M20 54a20 20 0 0 1 40 0" stroke={ink} strokeWidth="1.4" opacity="0.5" />
            <path d="M27 54a13 13 0 0 1 26 0" stroke={ink} strokeWidth="1.4" opacity="0.85" />
            <path d="M34 54a6 6 0 0 1 12 0" fill="#e11d48" stroke="none" />
          </g>
        ) : (
          <g>
            <circle cx="40" cy="40" r="17" fill={ink} />
            <circle cx="47.5" cy="33.5" r="15.5" fill="#131010" />
            <circle cx="40" cy="40" r="26" fill="none" stroke={hairline} strokeWidth="1" />
          </g>
        )}
      </svg>
    </span>
  );
}

interface StatusDotProps {
  active: boolean;
}

function StatusDot({ active }: StatusDotProps) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'inline-block h-1.5 w-1.5 rounded-full',
        active ? 'bg-accent' : 'border border-[#867c7a] bg-transparent'
      )}
    />
  );
}

interface ContributorProfileProps {
  contributor: Contributor;
  variant?: 'editorial' | 'inline';
  index?: string;
  className?: string;
}

export function ContributorProfile({
  contributor,
  variant = 'editorial',
  index,
  className,
}: ContributorProfileProps) {
  const { name, role, status, active, motif, note, whatsapp } = contributor;

  if (variant === 'inline') {
    return (
      <li className={cn('flex items-start gap-4 border-t border-line py-5', className)}>
        <ContributorMark motif={motif} active={active} className="h-11 w-11" />
        <div className="min-w-0">
          <p className="font-display text-[15px] font-semibold leading-tight tracking-[-0.02em] text-white">
            {name}
          </p>
          <p className="mt-1 flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.22em] text-zinc-500">
            <span>{role}</span>
            <StatusDot active={active} />
            <span>{status}</span>
          </p>
          {whatsapp ? (
            <a
              href={whatsapp.url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-flex items-center gap-1.5 rounded-sm text-[12px] font-medium text-[#fda4af] transition-colors duration-150 hover:text-[#fecdd3] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
            >
              <WhatsAppIcon className="h-3.5 w-3.5" />
              WhatsApp
              <ArrowUpRight className="h-3 w-3" aria-hidden="true" />
              <span className="sr-only">(dibuka di tab baru)</span>
            </a>
          ) : (
            <p className="mt-2 text-[11.5px] text-zinc-500">WhatsApp belum tersedia</p>
          )}
        </div>
      </li>
    );
  }

  return (
    <article
      className={cn(
        'grid grid-cols-[56px_minmax(0,1fr)] items-start gap-x-5 gap-y-6 py-9 sm:grid-cols-[80px_minmax(0,1fr)] sm:gap-x-7 md:grid-cols-[80px_minmax(0,1fr)_auto] md:items-center md:gap-x-10',
        className
      )}
    >
      <ContributorMark motif={motif} active={active} className="h-14 w-14 sm:h-20 sm:w-20" />

      <div className="min-w-0">
        <p className="flex items-center gap-2.5 text-[10px] font-medium uppercase tracking-[0.26em] text-zinc-500">
          {index ? <span className="tabular-nums">{index}</span> : null}
          {index ? <span aria-hidden="true" className="h-px w-5 bg-line" /> : null}
          <span>{role}</span>
        </p>

        <h3
          className={cn(
            'mt-2.5 font-display font-semibold leading-none tracking-[-0.045em]',
            active
              ? 'text-[clamp(2rem,7vw,2.75rem)] text-white'
              : 'text-[clamp(1.6rem,5.5vw,2rem)] text-zinc-200'
          )}
        >
          {name}
        </h3>

        <p className="mt-3.5 flex items-center gap-2 text-[12.5px]">
          <span className="text-[10px] font-medium uppercase tracking-[0.22em] text-zinc-500">
            Status
          </span>
          <StatusDot active={active} />
          <span className={active ? 'font-medium text-[#fda4af]' : 'text-zinc-400'}>{status}</span>
        </p>

        <p className="mt-2.5 max-w-[44ch] text-[13px] leading-relaxed text-zinc-400">{note}</p>
      </div>

      {whatsapp ? (
        <div className="col-span-2 md:col-span-1 md:justify-self-end">
          <a
            href={whatsapp.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-12 w-full cursor-pointer items-center justify-center gap-2.5 rounded-md border border-[#3a2b2d] bg-surface px-5 text-[13px] font-semibold text-white transition-colors duration-150 hover:border-[#6d2637] hover:bg-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 md:w-auto"
          >
            <WhatsAppIcon className="h-4 w-4 text-[#fda4af]" />
            {whatsapp.label}
            <ArrowUpRight className="h-3.5 w-3.5 text-zinc-500" aria-hidden="true" />
            <span className="sr-only">(dibuka di tab baru)</span>
          </a>
        </div>
      ) : null}
    </article>
  );
}
