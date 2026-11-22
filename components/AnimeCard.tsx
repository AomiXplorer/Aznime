import Link from 'next/link';
import { memo } from 'react';
import type { AnimeCardItem } from '@/lib/scraper/types';
import { AnimeImage } from './AnimeImage';
import { cn } from '@/lib/cn';

interface AnimeCardProps {
  item: AnimeCardItem;
  priority?: boolean;
  className?: string;
}

export function getAnimeItemHref(item: Pick<AnimeCardItem, 'slug' | 'kind'>): string {
  if (!item.slug) return '/anime';
  const encoded = encodeURIComponent(item.slug);
  return item.kind === 'episode' ? `/watch/${encoded}` : `/anime/${encoded}`;
}

function episodeLabel(item: AnimeCardItem): string | null {
  if (item.episodeNumber !== null && item.episodeNumber !== undefined) return `EP ${item.episodeNumber}`;
  return item.episode || null;
}

function AnimeCardComponent({ item, priority = false, className }: AnimeCardProps) {
  const href = getAnimeItemHref(item);
  const displayTitle = item.seriesTitle || item.title;
  const ep = episodeLabel(item);

  return (
    <article className={cn('group relative cv-item', className)}>
      <Link
        href={href}
        /* Prefetch tiap kartu membuat puluhan permintaan RSC saat grid digulir.
           Dimatikan supaya scroll di HP tetap ringan; halaman tetap cepat dibuka. */
        prefetch={false}
        className="block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ink focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
      >
        <div className="relative aspect-[2/3] w-full overflow-hidden rounded-xl bg-surface ring-1 ring-white/[0.06] transition-all duration-200 ease-out group-hover:ring-accent/50 group-active:scale-[0.97]">
          <AnimeImage
            src={item.poster}
            alt={displayTitle}
            priority={priority}
            sizes="(max-width: 640px) 33vw, (max-width: 1024px) 20vw, 170px"
            className="transition-transform duration-300 ease-out group-hover:scale-[1.03]"
          />
          {ep ? (
            <span className="absolute left-0 top-0 rounded-br-lg bg-accent px-2 py-1 font-mono text-[11px] font-bold leading-none tabular-nums text-white">
              {ep}
            </span>
          ) : null}
          {item.isHot ? (
            <span className="absolute right-0 top-0 rounded-bl-lg border-b border-l border-accent/30 bg-canvas/85 px-2 py-1 text-[11px] font-semibold leading-none text-accent-ink">
              Hot
            </span>
          ) : null}
        </div>

        <h3 className="mt-2.5 line-clamp-2 min-h-[2.5rem] text-[13px] font-semibold leading-5 text-ink/90 transition-colors duration-150 group-hover:text-accent-ink">
          {displayTitle}
        </h3>
        {item.type || item.status ? (
          <p className="mt-0.5 flex h-4 gap-2 truncate text-xs text-muted">
            {item.type ? <span>{item.type}</span> : null}
            {item.status ? <span className="text-faint">{item.status}</span> : null}
          </p>
        ) : (
          <p className="mt-0.5 h-4" />
        )}
      </Link>
    </article>
  );
}

/* Kartu katalog bisa muncul ratusan kali pada halaman infinite scroll.
   memo mencegah re-render saat state filter/halaman berubah. */
export const AnimeCard = memo(AnimeCardComponent);
