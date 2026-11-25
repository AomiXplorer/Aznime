import Image from 'next/image';
import { ArrowUpRight } from 'lucide-react';
import { cn } from '@/lib/cn';
import type {
  Contributor,
  ContributorAvatar as ContributorAvatarData,
  ContributorSocials,
} from '@/lib/credits';
import { WhatsAppIcon } from './icons/WhatsAppIcon';

function GitHubIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
      <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844a9.59 9.59 0 0 1 2.504.337c1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.02 10.02 0 0 0 22 12.017C22 6.484 17.522 2 12 2Z" />
    </svg>
  );
}

function InstagramIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
    </svg>
  );
}

function LinkedInIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
      <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.75M6.88 8.56a1.68 1.68 0 0 0 1.68-1.68c0-.93-.75-1.69-1.68-1.69a1.69 1.69 0 0 0-1.69 1.69c0 .93.76 1.68 1.69 1.68m1.39 9.94v-8.37H5.5v8.37h2.77Z" />
    </svg>
  );
}

function TelegramIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
      <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
    </svg>
  );
}

interface ContributorAvatarProps {
  avatar: ContributorAvatarData;
  active: boolean;
  className?: string;
}

function ContributorAvatar({ avatar, active, className }: ContributorAvatarProps) {
  const frame = active
    ? 'ring-[#fda4af]/30 group-hover:ring-[#fda4af]/50'
    : 'ring-white/15 group-hover:ring-white/30';

  return (
    <span
      aria-hidden="true"
      className={cn(
        'relative block shrink-0 overflow-hidden rounded-full bg-[#191414] ring-1 transition-all duration-200',
        frame,
        className
      )}
    >
      {avatar.kind === 'image' ? (
        <Image
          src={avatar.src}
          alt=""
          width={96}
          height={96}
          unoptimized
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
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
  { key: 'github', label: 'GitHub', Icon: GitHubIcon },
  { key: 'instagram', label: 'Instagram', Icon: InstagramIcon },
  { key: 'linkedin', label: 'LinkedIn', Icon: LinkedInIcon },
  { key: 'telegram', label: 'Telegram', Icon: TelegramIcon },
] as const;

function getSocialItems(socials?: ContributorSocials) {
  if (!socials) return [];
  return SOCIAL_LINKS.flatMap(({ key, label, Icon }) => {
    const url = socials[key];
    return url ? [{ key, label, url, Icon }] : [];
  });
}

interface SocialLinksProps {
  socials?: ContributorSocials;
  className?: string;
}

function InlineSocialLinks({ socials, className }: SocialLinksProps) {
  const items = getSocialItems(socials);
  if (items.length === 0) return null;

  return (
    <ul className={cn('flex flex-wrap items-center gap-2', className)}>
      {items.map(({ key, label, url, Icon }) => (
        <li key={key}>
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[#3a2b2d] bg-surface px-2.5 text-[11.5px] font-medium text-white transition-colors duration-150 hover:border-[#6d2637] hover:bg-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
          >
            <Icon className="h-3.5 w-3.5 shrink-0 text-[#fda4af]" />
            {label}
            <ArrowUpRight className="h-3 w-3 text-zinc-500" aria-hidden="true" />
            <span className="sr-only">(dibuka di tab baru)</span>
          </a>
        </li>
      ))}
    </ul>
  );
}

const ACTION_BUTTON_CLASS =
  'inline-flex h-11 w-full cursor-pointer items-center justify-center gap-2.5 rounded-md border border-[#3a2b2d] bg-surface px-5 text-[13px] font-semibold text-white transition-colors duration-150 hover:border-[#6d2637] hover:bg-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 md:w-auto';

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
  const { name, role, status, active, avatar, note, whatsapp, socials } = contributor;

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
          <InlineSocialLinks socials={socials} className="mt-2.5" />
        </div>
      </li>
    );
  }

  const socialItems = getSocialItems(socials);
  const hasActions = Boolean(whatsapp) || socialItems.length > 0;

  return (
    <article
      className={cn(
        'group grid grid-cols-[56px_minmax(0,1fr)] items-start gap-x-5 gap-y-6 py-9 sm:grid-cols-[80px_minmax(0,1fr)] sm:gap-x-7 md:grid-cols-[80px_minmax(0,1fr)_auto] md:items-center md:gap-x-10',
        className
      )}
    >
      <ContributorAvatar avatar={avatar} active={active} className="h-14 w-14 sm:h-20 sm:w-20" />

      <div className="min-w-0">
        <p className="flex items-center gap-2.5 text-[10px] font-medium uppercase tracking-[0.26em] text-zinc-500">
          {index ? <span className="tabular-nums text-zinc-400">{index}</span> : null}
          {index ? (
            <span
              aria-hidden="true"
              className={cn('h-px w-5', active ? 'bg-accent/70' : 'bg-line')}
            />
          ) : null}
          <span>{role}</span>
        </p>

        <h3
          className={cn(
            'mt-2.5 font-display font-semibold leading-none tracking-[-0.045em] transition-colors duration-150',
            active
              ? 'text-[clamp(2rem,7vw,2.75rem)] text-white'
              : 'text-[clamp(1.6rem,5.5vw,2rem)] text-zinc-200 group-hover:text-white'
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

      {hasActions ? (
        <div className="col-span-2 flex flex-col gap-2.5 sm:flex-row sm:flex-wrap md:col-span-1 md:justify-end md:justify-self-end">
          {whatsapp ? (
            <a
              href={whatsapp.url}
              target="_blank"
              rel="noopener noreferrer"
              className={ACTION_BUTTON_CLASS}
            >
              <WhatsAppIcon className="h-4 w-4 shrink-0 text-[#fda4af]" />
              {whatsapp.label}
              <ArrowUpRight className="h-3.5 w-3.5 text-zinc-500" aria-hidden="true" />
              <span className="sr-only">(dibuka di tab baru)</span>
            </a>
          ) : null}

          {socialItems.map(({ key, label, url, Icon }) => (
            <a
              key={key}
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className={ACTION_BUTTON_CLASS}
            >
              <Icon className="h-4 w-4 shrink-0 text-[#fda4af]" />
              {label}
              <ArrowUpRight className="h-3.5 w-3.5 text-zinc-500" aria-hidden="true" />
              <span className="sr-only">(dibuka di tab baru)</span>
            </a>
          ))}
        </div>
      ) : null}
    </article>
  );
}
