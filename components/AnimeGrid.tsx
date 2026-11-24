import type { AnimeCardItem } from '@/lib/scraper/types';
import { AnimeCard } from './AnimeCard';
import { cn } from '@/lib/cn';

/**
 * Grid berpindah 3 → 4 → 5 → 6 → 7 kolom, jadi daftar dengan jumlah tetap
 * (mis. 14 judul) hampir selalu menyisakan baris terakhir yang bolong.
 * Kelas ini memangkas sisa item per rentang breakpoint dengan CSS saja,
 * tanpa JavaScript dan tanpa layout shift saat hidrasi. Dirancang untuk 14
 * item: 12 di 3/4/6 kolom, 10 di 5 kolom, dan 14 di 7 kolom, sehingga selalu
 * berakhir pada baris penuh. Tiap rentang dibatasi dua sisi supaya tidak
 * saling menimpa dan tidak perlu mengembalikan `display`.
 */
const FILL_ROWS = [
  'max-sm:[&>*:nth-child(n+13)]:hidden',
  'sm:max-md:[&>*:nth-child(n+13)]:hidden',
  'md:max-lg:[&>*:nth-child(n+11)]:hidden',
  'lg:max-xl:[&>*:nth-child(n+13)]:hidden',
].join(' ');

interface AnimeGridProps {
  items: AnimeCardItem[];
  priorityCount?: number;
  className?: string;
  tone?: 'dark' | 'light';
  /** Sembunyikan item sisa agar baris terakhir selalu penuh. Untuk daftar 14 item. */
  fillRows?: boolean;
}

export function AnimeGrid({ items, priorityCount = 0, className, tone, fillRows = false }: AnimeGridProps) {
  return (
    <div
      className={cn(
        'grid grid-cols-3 gap-x-3 gap-y-6 sm:grid-cols-4 sm:gap-x-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7',
        fillRows && FILL_ROWS,
        className
      )}
    >
      {items.map((item, idx) => (
        <AnimeCard
          key={`${item.kind}-${item.slug || item.url || idx}`}
          item={item}
          priority={idx < priorityCount}
          tone={tone}
        />
      ))}
    </div>
  );
}
