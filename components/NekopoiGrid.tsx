import type { AnimeCardItem } from '@/lib/scraper/types';
import { nekopoiCardHref } from '@/lib/nekopoi-links';
import { AnimeCard } from './AnimeCard';
import { cn } from '@/lib/cn';

interface NekopoiGridProps {
  items: AnimeCardItem[];
  priorityCount?: number;
  className?: string;
}

/**
 * Grid bagian /hentai. Kartu di sini tidak menampilkan baris genre/status
 * karena seluruh isi bagian ini sudah hentai, dan label 18+ cukup satu kali di
 * judul halaman. Nomor episode tetap muncul sebagai penanda di poster.
 */
export function NekopoiGrid({ items, priorityCount = 0, className }: NekopoiGridProps) {
  return (
    <div
      className={cn(
        'grid grid-cols-3 gap-x-3 gap-y-6 sm:grid-cols-4 sm:gap-x-4 md:grid-cols-5 lg:grid-cols-6',
        className
      )}
    >
      {items.map((item, idx) => (
        <AnimeCard
          key={`${item.kind}-${item.slug || idx}`}
          item={item}
          href={nekopoiCardHref(item)}
          showMeta={false}
          priority={idx < priorityCount}
        />
      ))}
    </div>
  );
}
