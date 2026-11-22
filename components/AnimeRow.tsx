'use client';

import { useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { AnimeCardItem } from '@/lib/scraper/types';
import { AnimeCard } from './AnimeCard';
import { SectionHeading } from './SectionHeading';

interface AnimeRowProps {
  title: string;
  items: AnimeCardItem[];
  viewAllHref?: string;
  viewAllLabel?: string;
  /**
   * Jumlah gambar pertama yang di-preload. Default 0: baris ini selalu berada
   * di bawah fold, dan preload di sini bersaing dengan LCP hero.
   */
  priorityCount?: number;
}

export function AnimeRow({
  title,
  items,
  viewAllHref,
  viewAllLabel = 'Lihat semua',
  priorityCount = 0,
}: AnimeRowProps) {
  const scrollerRef = useRef<HTMLDivElement>(null);

  const scrollByAmount = (dir: 'left' | 'right') => {
    const el = scrollerRef.current;
    if (!el) return;
    const step = Math.max(320, el.clientWidth * 0.8);
    el.scrollBy({ left: dir === 'left' ? -step : step, behavior: 'smooth' });
  };

  if (items.length === 0) return null;

  return (
    <section aria-label={title} className="group/row space-y-5">
      <SectionHeading title={title} href={viewAllHref} linkLabel={viewAllLabel} />

      <div className="relative">
        <button
          type="button"
          onClick={() => scrollByAmount('left')}
          aria-label={`Geser ${title} ke kiri`}
          className="absolute -left-3 top-[calc(50%-1.75rem)] z-10 hidden h-10 w-10 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full border border-line bg-elevated/95 text-ink opacity-0 shadow-lg transition-all duration-150 hover:border-accent hover:bg-accent hover:text-white group-hover/row:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ink md:flex"
        >
          <ChevronLeft className="h-5 w-5" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={() => scrollByAmount('right')}
          aria-label={`Geser ${title} ke kanan`}
          className="absolute -right-3 top-[calc(50%-1.75rem)] z-10 hidden h-10 w-10 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full border border-line bg-elevated/95 text-ink opacity-0 shadow-lg transition-all duration-150 hover:border-accent hover:bg-accent hover:text-white group-hover/row:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ink md:flex"
        >
          <ChevronRight className="h-5 w-5" aria-hidden="true" />
        </button>

        <div
          ref={scrollerRef}
          className="no-scrollbar -mx-4 -my-3 flex snap-x gap-3 overflow-x-auto px-4 py-3 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8"
        >
          {items.map((item, idx) => (
            <div
              key={`${item.kind}-${item.slug || item.url || idx}`}
              className="w-[118px] shrink-0 snap-start sm:w-[140px] lg:w-[164px]"
            >
              <AnimeCard item={item} priority={idx < priorityCount} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
