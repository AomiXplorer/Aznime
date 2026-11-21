import type { AnimeCardItem } from '@/lib/scraper/types';
import { AnimeCard } from './AnimeCard';
import { cn } from '@/lib/cn';

interface AnimeGridProps {
  items: AnimeCardItem[];
  priorityCount?: number;
  className?: string;
}

export function AnimeGrid({ items, priorityCount = 0, className }: AnimeGridProps) {
  return (
    <div
      className={cn(
        'grid grid-cols-3 gap-x-3 gap-y-6 sm:grid-cols-4 sm:gap-x-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7',
        className
      )}
    >
      {items.map((item, idx) => (
        <AnimeCard
          key={`${item.kind}-${item.slug || item.url || idx}`}
          item={item}
          priority={idx < priorityCount}
        />
      ))}
    </div>
  );
}
