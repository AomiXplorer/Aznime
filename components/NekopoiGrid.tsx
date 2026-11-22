import type { AnimeCardItem } from '@/lib/scraper/types';
import { nekopoiAnimeSlugFromSlug, nekopoiEpisodeSlugFromSlug } from '@/lib/nekopoi';
import { AnimeCard } from './AnimeCard';
import { cn } from '@/lib/cn';

interface NekopoiGridProps {
  items: AnimeCardItem[];
  priorityCount?: number;
  className?: string;
}

/**
 * Kartu Nekopoi memakai slug berawalan, jadi tujuannya dihitung di sini:
 * seri menuju halaman sinopsis, episode/post 3D-JAV menuju pemutar.
 */
export function nekopoiCardHref(item: Pick<AnimeCardItem, 'slug' | 'kind'>): string {
  if (!item.slug) return '/hentai';
  const episodeSlug = nekopoiEpisodeSlugFromSlug(item.slug);
  if (episodeSlug || item.kind === 'episode') {
    const inner = episodeSlug || item.slug;
    return `/hentai/watch/${encodeURIComponent(inner)}`;
  }
  const animeSlug = nekopoiAnimeSlugFromSlug(item.slug) || item.slug;
  return `/hentai/${encodeURIComponent(animeSlug)}`;
}

export function NekopoiGrid({ items, priorityCount = 0, className }: NekopoiGridProps) {
  return (
    <div
      className={cn(
        'grid grid-cols-3 gap-x-3 gap-y-6 sm:grid-cols-4 sm:gap-x-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7',
        className
      )}
    >
      {items.map((item, idx) => (
        <AnimeCard
          key={`${item.kind}-${item.slug || idx}`}
          item={item}
          href={nekopoiCardHref(item)}
          badge="18+"
          priority={idx < priorityCount}
        />
      ))}
    </div>
  );
}
