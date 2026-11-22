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

/**
 * Baris katalog. Kepala baris memakai satu garis tipis dengan judul menempel
 * di atasnya dan jumlah judul sebagai angka nyata, bukan label hiasan.
 */
export function AnimeRow({
  title,
  items,
  viewAllHref,
  viewAllLabel = 'Semua',
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
    <section aria-label={title} className="group/row">
      <div className="mb-3 flex items-end justify-between gap-4 border-b border-[#2b2222] pb-2">
        <div className="flex items-baseline gap-2.5">
          <h2 className="font-display text-[17px] font-semibold tracking-[-0.02em] text-white">{title}</h2>
          <span className="text-[11px] tabular-nums text-zinc-500">{items.length} judul</span>
        </div>
        {viewAllHref ? (
          <Link
            href={viewAllHref}
            className="inline-flex items-center gap-0.5 text-[12px] font-medium text-zinc-400 transition-colors duration-150 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
          >
            {viewAllLabel}
            <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        ) : null}
      </div>

      <div className="relative">
        <button
          type="button"
          onClick={() => scrollByAmount('left')}
          aria-label={`Geser ${title} ke kiri`}
          className="absolute left-1 top-1/2 z-10 hidden h-9 w-9 -translate-y-[calc(50%+1.5rem)] cursor-pointer items-center justify-center rounded-[4px] border border-white/15 bg-[#131010] text-white opacity-0 transition-opacity duration-150 hover:border-white/35 group-hover/row:opacity-100 focus-visible:opacity-100 md:flex"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={() => scrollByAmount('right')}
          aria-label={`Geser ${title} ke kanan`}
          className="absolute right-1 top-1/2 z-10 hidden h-9 w-9 -translate-y-[calc(50%+1.5rem)] cursor-pointer items-center justify-center rounded-[4px] border border-white/15 bg-[#131010] text-white opacity-0 transition-opacity duration-150 hover:border-white/35 group-hover/row:opacity-100 focus-visible:opacity-100 md:flex"
        >
          <ChevronRight className="h-4 w-4" aria-hidden="true" />
        </button>

        <div
          ref={scrollerRef}
          className="no-scrollbar -mx-4 -my-2 flex snap-x gap-3 overflow-x-auto overscroll-x-contain px-4 py-2 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8"
        >
          {items.map((item, idx) => (
            <div
              key={`${item.kind}-${item.slug || item.url || idx}`}
              className="w-[118px] shrink-0 snap-start sm:w-[138px] lg:w-[158px]"
            >
              <AnimeCard item={item} priority={idx < priorityCount} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
