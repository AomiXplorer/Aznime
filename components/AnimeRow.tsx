'use client';

import { useRef } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { AnimeCardItem } from '@/lib/scraper/types';
import { AnimeCard } from './AnimeCard';

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
    <section aria-label={title} className="group/row space-y-3">
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="text-[1.1rem] font-bold text-white">{title}</h2>
        {viewAllHref ? (
          <Link
            href={viewAllHref}
            className="inline-flex items-center gap-0.5 text-[13px] font-semibold text-muted transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
          >
            {viewAllLabel}
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        ) : null}
      </div>

      <div className="relative">
        <button
          type="button"
          onClick={() => scrollByAmount('left')}
          aria-label={`Geser ${title} ke kiri`}
          className="absolute left-0 top-0 z-10 hidden h-[calc(100%-3.5rem)] w-12 cursor-pointer items-center justify-center bg-gradient-to-r from-canvas to-transparent text-white opacity-0 transition-opacity duration-200 group-hover/row:opacity-100 focus-visible:opacity-100 md:flex"
        >
          <ChevronLeft className="h-7 w-7" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={() => scrollByAmount('right')}
          aria-label={`Geser ${title} ke kanan`}
          className="absolute right-0 top-0 z-10 hidden h-[calc(100%-3.5rem)] w-12 cursor-pointer items-center justify-center bg-gradient-to-l from-canvas to-transparent text-white opacity-0 transition-opacity duration-200 group-hover/row:opacity-100 focus-visible:opacity-100 md:flex"
        >
          <ChevronRight className="h-7 w-7" aria-hidden="true" />
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
