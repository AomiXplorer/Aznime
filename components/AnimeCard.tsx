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
        className="block rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ink focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
      >
        <div className="relative aspect-[2/3] w-full overflow-hidden rounded bg-surface ring-1 ring-white/[0.06] transition-transform duration-200 ease-out group-active:scale-[0.97]">
          <AnimeImage
            src={item.poster}
            alt={displayTitle}
            priority={priority}
            sizes="(max-width: 640px) 33vw, (max-width: 1024px) 20vw, 170px"
          />
          {ep ? (
            <span className="absolute left-0 top-2 bg-accent px-1.5 py-1 text-[11px] font-bold leading-none text-white">
              {ep}
            </span>
          ) : null}
          {item.isHot ? (
            <span className="absolute right-0 top-2 bg-canvas/85 px-1.5 py-1 text-[11px] font-semibold leading-none text-ink">
              Hot
            </span>
          ) : null}
          {/* Satu-satunya umpan balik hover: garis crimson yang memanjang. */}
          <span
            aria-hidden="true"
            className="absolute inset-x-0 bottom-0 h-0.5 origin-left scale-x-0 bg-accent transition-transform duration-200 ease-out group-hover:scale-x-100 group-focus-visible:scale-x-100"
          />
        </div>

        <h3 className="mt-2 line-clamp-2 min-h-[2.5rem] text-[13px] font-semibold leading-5 text-ink/90 transition-colors duration-150 group-hover:text-ink">
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
