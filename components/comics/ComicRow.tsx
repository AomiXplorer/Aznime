'use client';

import { useRef } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { ComicCard, type CatalogCardItem } from './ComicCard';

interface ComicRowProps {
  title: string;
  items: CatalogCardItem[];
  viewAllHref?: string;
  aspect?: '2/3' | '3/4';
  /** Keterangan satu baris di bawah judul, mis. nama sumber. */
  note?: string;
}

/**
 * Baris komik/webtoon. Sama seperti baris anime: garis tipis sebagai kepala,
 * kartu digulir mendatar dengan tombol panah di layar lebar.
 */
export function ComicRow({ title, items, viewAllHref, aspect = '2/3', note }: ComicRowProps) {
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
        <div className="min-w-0">
          <h2 className="font-display text-[17px] font-semibold tracking-[-0.02em] text-white sm:text-[19px]">
            {title}
          </h2>
          {note ? <p className="mt-0.5 text-[11.5px] text-zinc-500">{note}</p> : null}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {viewAllHref ? (
            <Link
              href={viewAllHref}
              className="mr-1 inline-flex items-center text-[12px] font-medium text-zinc-400 transition-colors duration-150 hover:text-white"
            >
              Semua
            </Link>
          ) : null}
          <button
            type="button"
            aria-label={`Geser ${title} ke kiri`}
            onClick={() => scrollByAmount('left')}
            className="hidden h-8 w-8 cursor-pointer items-center justify-center rounded-[4px] border border-white/10 text-zinc-400 transition-colors hover:border-white/30 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 sm:inline-flex"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            aria-label={`Geser ${title} ke kanan`}
            onClick={() => scrollByAmount('right')}
            className="hidden h-8 w-8 cursor-pointer items-center justify-center rounded-[4px] border border-white/10 text-zinc-400 transition-colors hover:border-white/30 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 sm:inline-flex"
          >
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>

      <div
        ref={scrollerRef}
        className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:gap-3.5 sm:px-0 [&::-webkit-scrollbar]:hidden"
      >
        {items.map((item) => (
          <ComicCard
            key={item.id}
            item={item}
            aspect={aspect}
            sizes="(max-width: 639px) 31vw, (max-width: 767px) 22vw, (max-width: 1023px) 16vw, 200px"
            className="w-[31vw] shrink-0 snap-start sm:w-[22vw] md:w-[15.5vw] lg:w-[calc((100%-5*14px)/6)]"
          />
        ))}
      </div>
    </section>
  );
}
