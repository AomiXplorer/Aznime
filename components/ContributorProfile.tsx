import Image from 'next/image';
import { ArrowUpRight } from 'lucide-react';
import { cn } from '@/lib/cn';
import type {
  Contributor,
  ContributorAvatar as ContributorAvatarData,
  ContributorSocials,
} from '@/lib/credits';
import { WhatsAppIcon } from './icons/WhatsAppIcon';

interface ContributorAvatarProps {
  avatar: ContributorAvatarData;
  active: boolean;
  className?: string;
}

/**
 * Avatar contributor: foto asli untuk Aomi, siluet netral untuk Azura yang
 * belum punya foto. Keduanya memakai bingkai lingkaran dan garis rambut yang
 * sama supaya tinggi optis serta bobotnya konsisten di halaman mana pun.
 * Gambar ditandai dekoratif karena nama sudah ada di sebelahnya.
 */
function ContributorAvatar({ avatar, active, className }: ContributorAvatarProps) {
  const frame = active ? 'ring-white/20' : 'ring-white/12';

  return (
    <span
      aria-hidden="true"
      className={cn('relative block shrink-0 overflow-hidden rounded-full ring-1', frame, className)}
    >
      {avatar.kind === 'image' ? (
        <Image
          src={avatar.src}
          alt=""
          width={96}
          height={96}
          className="h-full w-full object-cover"
        />
      ) : (
        <svg viewBox="0 0 80 80" className="h-full w-full">
          <rect width="80" height="80" fill="#191414" />
          <g fill={active ? '#5c5351' : '#524a48'}>
            <circle cx="40" cy="30" r="12.5" />
            <path d="M40 46.5c-13.6 0-23.2 8.6-24.6 21.1V80h49.2V67.6C63.2 55.1 53.6 46.5 40 46.5Z" />
          </g>
        </svg>
      )}
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

const SOCIAL_LINKS = [
  { key: 'github', label: 'GitHub' },
  { key: 'instagram', label: 'Instagram' },
  { key: 'linkedin', label: 'LinkedIn' },
  { key: 'telegram', label: 'Telegram' },
] as const;

interface SocialLinksProps {
  socials?: ContributorSocials;
  className?: string;
}

/**
 * Link sosial opsional. Hanya field yang terisi yang dirender, dan jika
 * tidak ada satu pun, komponen ini tidak menghasilkan apa-apa.
 * Memakai teks tanpa ikon karena ikon merek di lucide-react sudah deprecated.
 */
function SocialLinks({ socials, className }: SocialLinksProps) {
  if (!socials) return null;

  const items = SOCIAL_LINKS.flatMap(({ key, label }) => {
    const url = socials[key];
    return url ? [{ key, label, url }] : [];
  });

  if (items.length === 0) return null;

  return (
    <ul className={cn('flex flex-wrap items-center gap-x-4 gap-y-1.5', className)}>
      {items.map(({ key, label, url }) => (
        <li key={key}>
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 rounded-sm text-[12px] font-medium text-zinc-400 transition-colors duration-150 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
          >
            {label}
            <ArrowUpRight className="h-3 w-3" aria-hidden="true" />
            <span className="sr-only">(dibuka di tab baru)</span>
          </a>
        </li>
      ))}
    </ul>
  );
}

interface ContributorProfileProps {
  contributor: Contributor;
  variant?: 'editorial' | 'inline' | 'card';
  index?: string;
  className?: string;
}

export function ContributorProfile({
  contributor,
  variant = 'editorial',
  index,
  className,
}: ContributorProfileProps) {
  const { name, role, status, active, avatar, note, whatsapp, socials } = contributor;

  if (variant === 'card') {
    return (
      <article
        className={cn(
          'h-full rounded-md border border-line bg-surface/70 p-5 transition-colors duration-150 hover:border-zinc-700 sm:p-6',
          className
        )}
      >
        <div className="flex items-center gap-4">
          <ContributorAvatar avatar={avatar} active={active} className="h-12 w-12 sm:h-14 sm:w-14" />
          <div className="min-w-0">
            <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-zinc-500">
              {role}
            </p>
            <h3 className="mt-1 font-display text-[clamp(1.45rem,4vw,1.8rem)] font-semibold leading-tight tracking-[-0.04em] text-white">
              {name}
            </h3>
          </div>
        </div>

        <p className="mt-5 min-h-[4.5rem] text-[12.5px] leading-relaxed text-zinc-400">
          {note}
        </p>

        <SocialLinks socials={socials} className="mt-5 border-t border-line pt-4" />
      </article>
    );
  }

  if (variant === 'inline') {
    return (
      <li className={cn('flex items-start gap-4 border-t border-line py-5', className)}>
        <ContributorAvatar avatar={avatar} active={active} className="h-11 w-11" />
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
          <SocialLinks socials={socials} className="mt-2.5" />
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
      <ContributorAvatar avatar={avatar} active={active} className="h-14 w-14 sm:h-20 sm:w-20" />

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

        <SocialLinks socials={socials} className="mt-4" />
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
