import Link from 'next/link';
import { Play } from 'lucide-react';
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

export function AnimeCard({ item, priority = false, className }: AnimeCardProps) {
  const href = getAnimeItemHref(item);
  const displayTitle = item.seriesTitle || item.title;
  const meta = [item.type, item.status].filter(Boolean).join('  ');
  const ep = episodeLabel(item);

  return (
    <article className={cn('group relative', className)}>
      <Link
        href={href}
        className="block rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
      >
        <div className="relative aspect-[2/3] w-full overflow-hidden rounded-md bg-surface shadow-md shadow-black/40 transition-all duration-300 ease-out group-hover:-translate-y-1 group-hover:shadow-xl group-hover:shadow-black/60 group-active:translate-y-0 group-active:scale-[0.96]">
          <AnimeImage
            src={item.poster}
            alt={displayTitle}
            priority={priority}
            sizes="(max-width: 640px) 33vw, (max-width: 1024px) 20vw, 170px"
            className="transition-transform duration-500 ease-out group-hover:scale-[1.06]"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 flex items-center justify-center bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100"
          >
            <span className="flex h-11 w-11 scale-75 items-center justify-center rounded-full bg-white text-black transition-transform duration-300 group-hover:scale-100">
              <Play className="ml-0.5 h-5 w-5 fill-current" />
            </span>
          </div>
          {ep ? (
            <span className="absolute left-1.5 top-1.5 rounded bg-accent px-1.5 py-0.5 text-[11px] font-bold leading-none text-white shadow">
              {ep}
            </span>
          ) : null}
          {item.isHot ? (
            <span className="absolute right-1.5 top-1.5 rounded bg-black/70 px-1.5 py-0.5 text-[11px] font-semibold leading-none text-amber-300">
              Hot
            </span>
          ) : null}
        </div>

        <h3 className="mt-2 line-clamp-2 min-h-[2.5rem] text-[13px] font-semibold leading-5 text-zinc-100 transition-colors group-hover:text-white">
          {displayTitle}
        </h3>
        <p className="mt-0.5 h-4 truncate text-xs text-muted">{meta}</p>
      </Link>
    </article>
  );
}
